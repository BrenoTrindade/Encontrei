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
  confidenceReasons: ['Circulação usa uma estimativa atual.'],
  summary: 'Boa janela de maré após circulação recente.',
  restrictionStatus: 'needs_verification' as const,
  stale: false,
  expiresAt: '2026-07-19T03:00:00.000Z',
  tideStationName: 'Porto de Tubarão',
  tideStationDistanceKm: 5.2,
};

function dependencies(): AppDependencies {
  return {
    invitations: {
      accept: async (token) => token === 'convite-valido'
        ? { participantCode: 'P-001', sessionToken: 'sessao-segura' }
        : null,
      findParticipantBySession: async (session) => session === 'sessao-segura'
        ? { invitationId: 'invite-001', participantCode: 'P-001' }
        : null,
    },
    opportunities: {
      listByLocalDate: async (date) => date === '2026-07-16' ? [opportunity] : [],
      findPublishedById: async (id) => id === opportunity.id
        ? {
            ...opportunity,
            breakdown: [{
              factor: 'tide',
              normalizedValue: 1,
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
    engagements: {
      getState: async (_invitationId, opportunityId) => opportunityId === opportunity.id
        ? { saved: false, intentToGo: null, savedAt: null, feedbackSubmitted: false, feedback: null }
        : null,
      save: async (_invitationId, opportunityId, intentToGo) => opportunityId === opportunity.id
        ? {
            saved: true,
            intentToGo,
            savedAt: '2026-07-16T12:00:00.000Z',
            feedbackSubmitted: false,
            feedback: null,
          }
        : null,
      remove: async (_invitationId, opportunityId) => opportunityId === opportunity.id,
      submitFeedback: async (_invitationId, opportunityId) => opportunityId === opportunity.id,
    },
  };
}

describe('participant API', () => {
  it('exchanges a valid invitation for a secure session cookie', async () => {
    const response = await createApp(dependencies()).request('https://encontrei.example/api/invitations/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'convite-valido' }),
    });

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(response.headers.get('set-cookie')).toContain(
      'encontrei_session=sessao-segura; Max-Age=2419200; Path=/; HttpOnly; Secure; SameSite=Strict',
    );
  });

  it('allows the development session cookie on localhost HTTP', async () => {
    const response = await createApp(dependencies()).request('http://127.0.0.1:5173/api/invitations/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'convite-valido' }),
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('set-cookie')).toBe(
      'encontrei_session=sessao-segura; Max-Age=2419200; Path=/; HttpOnly; SameSite=Strict',
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

  it('saves an opportunity with an explicit intent to go', async () => {
    const response = await createApp(dependencies()).request(
      `/api/opportunities/${opportunity.id}/save`,
      {
        method: 'POST',
        headers: {
          cookie: 'encontrei_session=sessao-segura',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ intentToGo: true }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      saved: true,
      intentToGo: true,
      savedAt: '2026-07-16T12:00:00.000Z',
      feedbackSubmitted: false,
      feedback: null,
    });
  });

  it('rejects unexpected save fields so personal data is not collected accidentally', async () => {
    const response = await createApp(dependencies()).request(
      `/api/opportunities/${opportunity.id}/save`,
      {
        method: 'POST',
        headers: {
          cookie: 'encontrei_session=sessao-segura',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          intentToGo: true,
          coordinates: '-20.3155,-40.3128',
        }),
      },
    );

    expect(response.status).toBe(400);
  });

  it('returns the participant engagement state for an opportunity', async () => {
    const response = await createApp(dependencies()).request(
      `/api/opportunities/${opportunity.id}/engagement`,
      { headers: { cookie: 'encontrei_session=sessao-segura' } },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      saved: false,
      intentToGo: null,
      savedAt: null,
      feedbackSubmitted: false,
      feedback: null,
    });
  });

  it('removes a saved opportunity without exposing participant identifiers', async () => {
    const response = await createApp(dependencies()).request(
      `/api/opportunities/${opportunity.id}/save`,
      {
        method: 'DELETE',
        headers: { cookie: 'encontrei_session=sessao-segura' },
      },
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });

  it('accepts structured feedback linked to the pseudonymous invitation', async () => {
    const response = await createApp(dependencies()).request(
      `/api/opportunities/${opportunity.id}/feedback`,
      {
        method: 'POST',
        headers: {
          cookie: 'encontrei_session=sessao-segura',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          wentToBeach: true,
          followedWindow: true,
          decisionEffect: 'confirmed',
          resultCategory: 'nothing',
          informationCorrect: true,
          comment: 'A janela pareceu correta.',
        }),
      },
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });

  it('rejects unexpected feedback fields so personal data is not collected accidentally', async () => {
    const response = await createApp(dependencies()).request(
      `/api/opportunities/${opportunity.id}/feedback`,
      {
        method: 'POST',
        headers: {
          cookie: 'encontrei_session=sessao-segura',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          wentToBeach: false,
          followedWindow: false,
          decisionEffect: 'no_effect',
          resultCategory: 'not_applicable',
          informationCorrect: false,
          phone: 'não deve ser coletado',
        }),
      },
    );

    expect(response.status).toBe(400);
  });
});
