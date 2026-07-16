import { describe, expect, it } from 'vitest';
import { createApp, type AppDependencies } from './app';

const opportunity = {
  id: 'opp-camburi-20260716',
  beach: {
    id: 'camburi',
    name: 'Praia de Camburi',
    municipality: 'Vitória',
    latitude: -20.2839,
    longitude: -40.2896,
  },
  recommendedStartUtc: '2026-07-16T08:30:00.000Z',
  recommendedEndUtc: '2026-07-16T10:30:00.000Z',
  scoreBand: 'high' as const,
  confidence: 'medium' as const,
  summary: 'Boa janela de maré após circulação recente.',
  restrictionStatus: 'needs_verification' as const,
  tideStationName: 'Porto de Tubarão',
};

function dependencies(): AppDependencies {
  return {
    invitations: {
      accept: async (token) => token === 'convite-valido'
        ? { participantCode: 'P-001', sessionToken: 'sessao-segura' }
        : null,
      findParticipantBySession: async (session) => session === 'sessao-segura'
        ? { participantCode: 'P-001' }
        : null,
    },
    opportunities: {
      listByLocalDate: async (date) => date === '2026-07-16' ? [opportunity] : [],
      findPublishedById: async (id) => id === opportunity.id
        ? {
            ...opportunity,
            breakdown: [{
              factor: 'tide',
              contribution: 30,
              maxContribution: 30,
              explanation: 'Maré mínima dentro da janela.',
            }],
            sources: [{
              label: 'CHM — Porto de Tubarão',
              url: 'https://www.marinha.mil.br/chm/',
              updatedAt: '2026-07-15T12:00:00.000Z',
            }],
            restrictionSummary: 'Verifique as regras locais antes da busca.',
          }
        : null,
    },
  };
}

describe('participant API', () => {
  it('exchanges a valid invitation for a secure session cookie', async () => {
    const response = await createApp(dependencies()).request('/api/invitations/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'convite-valido' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ participantCode: 'P-001' });
    expect(response.headers.get('set-cookie')).toContain(
      'encontrei_session=sessao-segura; Max-Age=2419200; Path=/; HttpOnly; Secure; SameSite=Strict',
    );
  });

  it('does not create a session for an invalid invitation', async () => {
    const response = await createApp(dependencies()).request('/api/invitations/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'invalido' }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('requires a participant session to list opportunities', async () => {
    const response = await createApp(dependencies()).request(
      '/api/opportunities?date=2026-07-16',
    );

    expect(response.status).toBe(401);
  });

  it('lists opportunities for an authenticated participant and local date', async () => {
    const response = await createApp(dependencies()).request(
      '/api/opportunities?date=2026-07-16',
      { headers: { cookie: 'encontrei_session=sessao-segura' } },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      date: '2026-07-16',
      opportunities: [opportunity],
    });
  });

  it('returns a published opportunity detail to an authenticated participant', async () => {
    const response = await createApp(dependencies()).request(
      `/api/opportunities/${opportunity.id}`,
      { headers: { cookie: 'encontrei_session=sessao-segura' } },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: opportunity.id,
      breakdown: [{ factor: 'tide', contribution: 30 }],
    });
  });
});
