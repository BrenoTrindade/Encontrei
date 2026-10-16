import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { D1EngagementRepository } from './repositories/d1-engagement-repository';
import { D1InvitationRepository } from './repositories/d1-invitation-repository';
import { D1OpportunityRepository } from './repositories/d1-opportunity-repository';
import { sha256 } from './repositories/crypto';
import { D1TelemetryRepository } from './repositories/d1-telemetry-repository';

/** Executes real repository SQL; only the D1 transport is adapted to local SQLite. */
function sqliteD1(sqlite: DatabaseSync): D1Database {
  function prepare(sql: string, values: SQLInputValue[] = []) {
    const statement = sqlite.prepare(sql);
    return {
      bind: (...parameters: SQLInputValue[]) => prepare(sql, parameters),
      first: async () => statement.get(...values) ?? null,
      all: async () => ({ results: statement.all(...values), success: true }),
      run: async () => ({ success: true, meta: statement.run(...values) }),
    };
  }
  return { prepare } as unknown as D1Database;
}

const databases: DatabaseSync[] = [];
afterEach(() => { for (const database of databases.splice(0)) database.close(); });

async function participantApp() {
  const sqlite = new DatabaseSync(':memory:');
  databases.push(sqlite);
  for (const file of readdirSync('migrations').filter((name) => name.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(`migrations/${file}`, 'utf8'));
  }
  sqlite.exec(readFileSync('scripts/seed-dev.sql', 'utf8'));
  // The development seed predates normalized breakdowns; fixtures use the current contract.
  sqlite.exec(`UPDATE opportunity_snapshot SET breakdown_json = '[{"factor":"tide","normalizedValue":0.8,"contribution":24,"maxContribution":30,"explanation":"Maré prevista."}]';`);
  const database = sqliteD1(sqlite);
  const clock = () => new Date('2026-07-16T12:00:00.000Z');
  const app = createApp({
    invitations: new D1InvitationRepository(database),
    opportunities: new D1OpportunityRepository(database, clock),
    engagements: new D1EngagementRepository(database, clock),
    telemetry: new D1TelemetryRepository(database),
  });
  const accepted = await app.request('/api/invitations/accept', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: 'piloto-demo' }),
  });
  const cookie = accepted.headers.get('set-cookie')!.split(';')[0];
  return { app, sqlite, cookie };
}

describe('participant history with persisted SQLite data', () => {
  it('requires opt-in before collecting minimal events and stops collection when disabled', async () => {
    const { app, sqlite, cookie } = await participantApp();
    const event = { id: '87955a0c-16b3-45c3-b174-f5dfd1f689e5', name: 'radar_viewed', localDate: '2026-07-16' };
    const send = (body: unknown) => app.request('/api/events', {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    expect((await send(event)).status).toBe(403);
    expect((await app.request('/api/telemetry/consent', {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ enabled: true }),
    })).status).toBe(204);
    expect((await send({ ...event, latitude: -20.3 })).status).toBe(400);
    expect((await send({ ...event, name: 'arbitrary_event' })).status).toBe(400);
    expect((await send({ ...event, localDate: '2026-02-30' })).status).toBe(400);
    expect((await send({ id: crypto.randomUUID(), name: 'opportunity_viewed', opportunityId: 'missing' })).status).toBe(404);
    expect((await app.request('/api/events', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(event),
    })).status).toBe(401);
    expect((await send(event)).status).toBe(204);
    expect((await send(event)).status).toBe(204);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM participant_event').get()).toMatchObject({ count: 1 });
    expect((await app.request('/api/telemetry/consent', {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ enabled: false }),
    })).status).toBe(204);
    expect((await send({ ...event, id: crypto.randomUUID() })).status).toBe(403);
  });

  it('keeps a saved recommendation accessible for feedback after replacement and expiry', async () => {
    const { app, sqlite, cookie } = await participantApp();
    const id = 'opp-camburi-20260715';
    const saved = await app.request(`/api/opportunities/${id}/save`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ intentToGo: true }),
    });
    expect(saved.status).toBe(200);
    // A later refresh replaces this recommendation; its original content must remain reviewable.
    sqlite.exec(`UPDATE opportunity_snapshot SET status='hidden', stale_at='2026-07-16T10:00:00.000Z', expires_at='2026-07-16T11:00:00.000Z' WHERE id='${id}';`);
    const history = await app.request('/api/saved-opportunities', { headers: { cookie } });
    expect(history.status).toBe(200);
    expect(await history.json()).toMatchObject({ opportunities: [{ id, historical: true, intentToGo: true }] });
    const detail = await app.request(`/api/saved-opportunities/${id}`, { headers: { cookie } });
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({ id, historical: true, confidence: 'medium' });
    const feedback = {
      wentToBeach: true, followedWindow: true, decisionEffect: 'confirmed',
      resultCategory: 'nothing', informationCorrect: true, comment: 'Retorno após a visita.',
    };
    const submitted = await app.request(`/api/opportunities/${id}/feedback`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(feedback),
    });
    expect(submitted.status).toBe(204);
    const state = await app.request(`/api/opportunities/${id}/engagement`, { headers: { cookie } });
    expect(await state.json()).toMatchObject({ saved: true, feedbackSubmitted: true, feedback });
    const edit = { ...feedback, decisionEffect: 'changed', comment: 'Atualização depois de consultar o histórico.' };
    expect((await app.request(`/api/opportunities/${id}/feedback`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(edit),
    })).status).toBe(204);
    const restored = await app.request(`/api/opportunities/${id}/engagement`, { headers: { cookie } });
    expect(await restored.json()).toMatchObject({ feedback: edit });
    expect((await app.request(`/api/opportunities/${id}/save`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ intentToGo: false }),
    })).status).toBe(404);
    expect((await app.request(`/api/opportunities/${id}/save`, { method: 'DELETE', headers: { cookie } })).status).toBe(204);
    const afterRemove = await app.request('/api/saved-opportunities', { headers: { cookie } });
    expect(await afterRemove.json()).toMatchObject({ opportunities: [{ id, saved: false, feedbackSubmitted: true }] });
  });

  it('isolates historical recommendations and feedback between invitations', async () => {
    const { app, sqlite, cookie } = await participantApp();
    const id = 'opp-camburi-20260715';
    await app.request(`/api/opportunities/${id}/save`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ intentToGo: true }),
    });
    sqlite.exec(`UPDATE opportunity_snapshot SET status='hidden' WHERE id='${id}';`);
    sqlite.prepare(`INSERT INTO invitation (id, token_hash, participant_code, issued_at, session_hash)
      VALUES ('other-invite', 'other-hash', 'OTHER', '2026-07-16T00:00:00.000Z', ?)`)
      .run(await sha256('other-session'));
    const otherCookie = 'encontrei_session=other-session';
    expect((await app.request('/api/saved-opportunities')).status).toBe(401);
    const otherHistory = await app.request('/api/saved-opportunities', { headers: { cookie: otherCookie } });
    expect(await otherHistory.json()).toEqual({ opportunities: [] });
    for (const path of [`/api/saved-opportunities/${id}`, `/api/opportunities/${id}/engagement`]) {
      expect((await app.request(path, { headers: { cookie: otherCookie } })).status).toBe(404);
    }
    expect((await app.request(`/api/opportunities/${id}/feedback`, {
      method: 'POST', headers: { cookie: otherCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ wentToBeach: false, followedWindow: false, decisionEffect: 'no_effect',
        resultCategory: 'not_applicable', informationCorrect: false }),
    })).status).toBe(404);
    expect((await app.request(`/api/opportunities/${id}/save`, {
      method: 'DELETE', headers: { cookie: otherCookie },
    })).status).toBe(404);
  });
});
