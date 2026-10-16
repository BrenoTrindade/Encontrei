import type { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { AdminService } from './admin/admin-service';
import { D1InvitationRepository } from './repositories/d1-invitation-repository';
import { D1OpportunityRepository } from './repositories/d1-opportunity-repository';
import { D1EngagementRepository } from './repositories/d1-engagement-repository';
import { D1TelemetryRepository } from './repositories/d1-telemetry-repository';
import { createTestDatabase } from './testing/database';

const SECRET = 'integration-only-secret-12345678901234567890';
const databases: DatabaseSync[] = [];
afterEach(() => { for (const database of databases.splice(0)) database.close(); });

function setup() {
  const { sqlite, database } = createTestDatabase(); databases.push(sqlite);
  let now = new Date('2026-07-16T12:00:00.000Z');
  const clock = () => now;
  const dependencies = {
    invitations: new D1InvitationRepository(database),
    opportunities: new D1OpportunityRepository(database, clock),
    engagements: new D1EngagementRepository(database, clock),
    telemetry: new D1TelemetryRepository(database), admin: new AdminService(database, SECRET, clock),
  };
  const app = createApp(dependencies);
  const login = async (secret = SECRET) => app.request('https://encontrei.test/api/admin/session', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ secret }),
  });
  return { sqlite, database, app, dependencies, login, advance: (ms: number) => { now = new Date(now.getTime() + ms); } };
}

describe('administrator access and pilot reporting', () => {
  it('separates participant cookies, prevents cross-origin writes, expires and revokes admin sessions', async () => {
    const { app, database, dependencies, login, advance } = setup();
    expect((await app.request('/api/admin/pilot-summary', { headers: { cookie: 'encontrei_session=participant' } })).status).toBe(401);
    expect((await app.request('/api/admin/session', { method: 'POST', headers: { origin: 'https://other.test' }, body: '{}' })).status).toBe(403);
    const accepted = await login();
    expect(accepted.status).toBe(204);
    expect(accepted.headers.get('set-cookie')).toContain('HttpOnly; Secure; SameSite=Strict');
    const cookie = accepted.headers.get('set-cookie')!.split(';')[0];
    expect((await app.request('/api/admin/session', { headers: { cookie } })).status).toBe(204);
    const rotated = createApp({ ...dependencies, admin: new AdminService(database, `${SECRET}-rotated`) });
    expect((await rotated.request('/api/admin/session', { headers: { cookie } })).status).toBe(401);
    expect((await app.request('/api/admin/session', { method: 'DELETE', headers: { cookie } })).status).toBe(204);
    expect((await app.request('/api/admin/session', { headers: { cookie } })).status).toBe(401);
    const next = await login();
    advance(3_600_000);
    expect((await app.request('/api/admin/session', { headers: { cookie: next.headers.get('set-cookie')!.split(';')[0] } })).status).toBe(401);
  });

  it('limits repeated authentication attempts and recovers after the window', async () => {
    const { login, advance } = setup();
    for (let count = 0; count < 10; count++) expect((await login('wrong')).status).toBe(401);
    expect((await login()).status).toBe(429);
    advance(900_000);
    expect((await login()).status).toBe(204);
  });

  it('aggregates observed actions, exports no credentials, and deletes only the confirmed invitation', async () => {
    const { app, sqlite, login } = setup();
    const participant = await app.request('/api/invitations/accept', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: 'piloto-demo' }),
    });
    const participantCookie = participant.headers.get('set-cookie')!.split(';')[0];
    const payload = (body: unknown) => ({ method: 'POST', headers: { cookie: participantCookie, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    await app.request('/api/opportunities/opp-camburi-20260715/save', payload({ intentToGo: true }));
    await app.request('/api/opportunities/opp-camburi-20260715/feedback', payload({
      wentToBeach: true, followedWindow: true, decisionEffect: 'changed', resultCategory: 'nothing', informationCorrect: false,
    }));
    sqlite.exec(`INSERT INTO invitation (id, token_hash, participant_code, issued_at) VALUES ('other', 'other-hash', 'OTHER', '2026-07-15T00:00:00Z');
      INSERT INTO participant_event (id, invitation_id, event_name, local_date, occurred_at)
      VALUES ('event-1', 'invite-demo', 'radar_viewed', '2026-07-20', '2026-07-20T03:30:00Z');
      UPDATE invitation SET participant_code='=1+1' WHERE id='invite-demo';`);
    const loggedIn = await login();
    const cookie = loggedIn.headers.get('set-cookie')!.split(';')[0];
    const summaryResponse = await app.request('/api/admin/pilot-summary', { headers: { cookie } });
    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.headers.get('cache-control')).toBe('no-store');
    expect(await summaryResponse.json()).toMatchObject({
      totals: { invited: 2, accepted: 1, telemetryEnabled: 0, saves: 1, intentions: 1, feedbacks: 1,
        changedDecision: 1, confirmedDecision: 0, followedWindow: 1, incorrectInformation: 1 },
      weeklyActivity: [{ weekStart: '2026-07-13', participants: 1 }, { weekStart: '2026-07-20', participants: 1 }],
      participants: [{ code: '=1+1', telemetryEnabled: false, radarViews: 1, weeksWithActivity: 2 }, { code: 'OTHER', weeksWithActivity: 0 }],
    });
    const exported = await app.request('/api/admin/export?format=json', { headers: { cookie } });
    const json = await exported.text();
    expect(json).not.toMatch(/token_hash|session_hash|secret_hash|ADMIN_SECRET/);
    expect(JSON.parse(json).records.feedback).toHaveLength(1);
    const csv = await app.request('/api/admin/export?format=csv', { headers: { cookie } });
    expect(await csv.text()).toContain('"\'=1+1"');
    const remove = (confirmation: string) => app.request('/api/admin/participants/invite-demo', {
      method: 'DELETE', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ confirmation }),
    });
    expect((await remove('wrong')).status).toBe(404);
    expect((await remove('=1+1')).status).toBe(204);
    expect((await app.request('/api/opportunities?date=2026-07-15', { headers: { cookie: participantCookie } })).status).toBe(401);
    const remaining = await app.request('/api/admin/export?format=json', { headers: { cookie } });
    expect(await remaining.json()).toMatchObject({ records: { participants: [{ id: 'other' }], events: [], saves: [], feedback: [] } });
    const after = await app.request('/api/admin/pilot-summary', { headers: { cookie } });
    expect(await after.json()).toMatchObject({ recentActions: [{ action: 'participant_data_deleted' }] });
  });
});
