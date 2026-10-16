import { Hono, type MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { InvitationRepository } from './domain/invitations/invitation';
import type { OpportunityRepository } from './domain/opportunities/opportunity';
import type { EngagementRepository } from './domain/engagement/engagement';
import type { OpportunityFeedbackInput } from '../shared/engagement-contract';
import type { TelemetryRepository } from './domain/telemetry/telemetry';
import type { ParticipantEventInput } from '../shared/telemetry-contract';

export interface AppDependencies {
  invitations: InvitationRepository;
  opportunities: OpportunityRepository;
  engagements: EngagementRepository;
  telemetry: TelemetryRepository;
}

type Variables = {
  invitationId: string;
  participantCode: string;
};

const SESSION_COOKIE = 'encontrei_session';
const SESSION_MAX_AGE_SECONDS = 28 * 24 * 60 * 60;
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DECISION_EFFECTS = new Set(['changed', 'confirmed', 'no_effect']);
const RESULT_CATEGORIES = new Set(['found_relevant', 'found_other', 'nothing', 'not_applicable']);
const FEEDBACK_FIELDS = new Set([
  'wentToBeach',
  'followedWindow',
  'decisionEffect',
  'resultCategory',
  'informationCorrect',
  'comment',
]);

function requiresSecureCookie(requestUrl: string): boolean {
  const { hostname } = new URL(requestUrl);
  return hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '[::1]';
}

function parseFeedback(value: unknown): OpportunityFeedbackInput | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Record<string, unknown>;
  const comment = candidate.comment;
  if (
    Object.keys(candidate).some((key) => !FEEDBACK_FIELDS.has(key))
    ||
    typeof candidate.wentToBeach !== 'boolean'
    || typeof candidate.followedWindow !== 'boolean'
    || typeof candidate.decisionEffect !== 'string'
    || !DECISION_EFFECTS.has(candidate.decisionEffect)
    || typeof candidate.resultCategory !== 'string'
    || !RESULT_CATEGORIES.has(candidate.resultCategory)
    || typeof candidate.informationCorrect !== 'boolean'
    || (comment !== undefined && typeof comment !== 'string')
    || (typeof comment === 'string' && comment.trim().length > 500)
    || (!candidate.wentToBeach && candidate.followedWindow)
    || (!candidate.wentToBeach && candidate.resultCategory !== 'not_applicable')
    || (candidate.wentToBeach && candidate.resultCategory === 'not_applicable')
  ) {
    return null;
  }
  const trimmedComment = typeof comment === 'string' ? comment.trim() : '';
  return {
    wentToBeach: candidate.wentToBeach,
    followedWindow: candidate.followedWindow,
    decisionEffect: candidate.decisionEffect as OpportunityFeedbackInput['decisionEffect'],
    resultCategory: candidate.resultCategory as OpportunityFeedbackInput['resultCategory'],
    informationCorrect: candidate.informationCorrect,
    ...(trimmedComment ? { comment: trimmedComment } : {}),
  };
}

function parseParticipantEvent(value: unknown): ParticipantEventInput | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !['id', 'name', 'opportunityId', 'localDate'].includes(key))
    || typeof body.id !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id)) return null;
  if (body.name === 'opportunity_viewed' || body.name === 'feedback_started') {
    if (typeof body.opportunityId !== 'string' || body.opportunityId.length < 1
      || body.opportunityId.length > 200 || body.localDate !== undefined) return null;
    return { id: body.id, name: body.name, opportunityId: body.opportunityId };
  }
  if (body.name === 'radar_viewed' || body.name === 'day_changed' || body.name === 'map_opened') {
    if (typeof body.localDate !== 'string' || !LOCAL_DATE.test(body.localDate)
      || !Number.isFinite(Date.parse(`${body.localDate}T00:00:00.000Z`))
      || new Date(`${body.localDate}T00:00:00.000Z`).toISOString().slice(0, 10) !== body.localDate
      || body.opportunityId !== undefined) return null;
    return { id: body.id, name: body.name, localDate: body.localDate };
  }
  return null;
}

export function createApp(dependencies: AppDependencies) {
  const app = new Hono<{ Variables: Variables }>();

  app.get('/api/health', (context) => context.json({ status: 'ok' }));

  app.post('/api/invitations/accept', async (context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: 'Envie um convite válido.' }, 400);
    }

    const token = typeof body === 'object'
      && body !== null
      && 'token' in body
      && typeof body.token === 'string'
      ? body.token.trim()
      : '';

    if (token.length === 0) {
      return context.json({ error: 'Envie um convite válido.' }, 400);
    }

    const invitation = await dependencies.invitations.accept(token);
    if (!invitation) {
      return context.json({ error: 'Convite inválido ou revogado.' }, 401);
    }

    setCookie(context, SESSION_COOKIE, invitation.sessionToken, {
      httpOnly: true,
      secure: requiresSecureCookie(context.req.url),
      sameSite: 'Strict',
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: '/',
    });

    return context.body(null, 204);
  });

  const requireParticipant: MiddlewareHandler<{ Variables: Variables }> = async (
    context,
    next,
  ) => {
    const sessionToken = getCookie(context, SESSION_COOKIE);
    if (!sessionToken) {
      return context.json({ error: 'Abra seu link individual de convite.' }, 401);
    }

    const participant = await dependencies.invitations.findParticipantBySession(sessionToken);
    if (!participant) {
      return context.json({ error: 'Sessão expirada ou revogada.' }, 401);
    }

    context.set('participantCode', participant.participantCode);
    context.set('invitationId', participant.invitationId);
    await next();
  };

  app.use('/api/opportunities', requireParticipant);
  app.use('/api/opportunities/*', requireParticipant);
  app.use('/api/saved-opportunities', requireParticipant);
  app.use('/api/saved-opportunities/*', requireParticipant);
  app.use('/api/events', requireParticipant);
  app.use('/api/telemetry/*', requireParticipant);

  app.get('/api/telemetry/consent', async (context) => context.json({
    enabled: await dependencies.telemetry.isEnabled(context.get('invitationId')),
  }));

  app.post('/api/telemetry/consent', async (context) => {
    const body: unknown = await context.req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Object.keys(body).length !== 1
      || !('enabled' in body) || typeof body.enabled !== 'boolean') {
      return context.json({ error: 'Informe enabled como verdadeiro ou falso.' }, 400);
    }
    await dependencies.telemetry.setEnabled(context.get('invitationId'), body.enabled);
    return context.body(null, 204);
  });

  app.post('/api/events', async (context) => {
    const body: unknown = await context.req.json().catch(() => null);
    const event = parseParticipantEvent(body);
    if (!event) return context.json({ error: 'Evento inválido.' }, 400);
    const invitationId = context.get('invitationId');
    if (!await dependencies.telemetry.isEnabled(invitationId)) {
      return context.json({ error: 'Medição opcional desativada.' }, 403);
    }
    if (event.opportunityId && !await dependencies.engagements.getState(invitationId, event.opportunityId)) {
      return context.json({ error: 'Oportunidade não encontrada.' }, 404);
    }
    await dependencies.telemetry.record(invitationId, event);
    return context.body(null, 204);
  });

  app.get('/api/saved-opportunities', async (context) => context.json({
    opportunities: await dependencies.opportunities.listSaved(context.get('invitationId')),
  }));

  app.get('/api/saved-opportunities/:id', async (context) => {
    const opportunity = await dependencies.opportunities.findSavedById(
      context.get('invitationId'), context.req.param('id'),
    );
    if (!opportunity) return context.json({ error: 'Oportunidade não encontrada no seu histórico.' }, 404);
    return context.json(opportunity);
  });

  app.get('/api/opportunities', async (context) => {
    const date = context.req.query('date') ?? '';
    if (!LOCAL_DATE.test(date)) {
      return context.json({ error: 'Use uma data no formato YYYY-MM-DD.' }, 400);
    }

    const opportunities = await dependencies.opportunities.listByLocalDate(date);
    return context.json({ date, opportunities });
  });

  app.get('/api/opportunities/:id', async (context) => {
    const opportunity = await dependencies.opportunities.findPublishedById(
      context.req.param('id'),
    );
    if (!opportunity) {
      return context.json({ error: 'Oportunidade não encontrada ou expirada.' }, 404);
    }

    return context.json(opportunity);
  });

  app.post('/api/opportunities/:id/save', async (context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: 'Informe se você pretende ir nesta janela.' }, 400);
    }
    if (
      typeof body !== 'object'
      || body === null
      || Object.keys(body).length !== 1
      || !('intentToGo' in body)
      || typeof body.intentToGo !== 'boolean'
    ) {
      return context.json({ error: 'intentToGo deve ser verdadeiro ou falso.' }, 400);
    }

    const state = await dependencies.engagements.save(
      context.get('invitationId'),
      context.req.param('id'),
      body.intentToGo,
    );
    if (!state) {
      return context.json({ error: 'Oportunidade não encontrada ou expirada.' }, 404);
    }
    return context.json(state);
  });

  app.get('/api/opportunities/:id/engagement', async (context) => {
    const state = await dependencies.engagements.getState(
      context.get('invitationId'),
      context.req.param('id'),
    );
    if (!state) {
      return context.json({ error: 'Oportunidade não encontrada ou expirada.' }, 404);
    }
    return context.json(state);
  });

  app.delete('/api/opportunities/:id/save', async (context) => {
    const removed = await dependencies.engagements.remove(
      context.get('invitationId'),
      context.req.param('id'),
    );
    if (!removed) {
      return context.json({ error: 'Oportunidade não encontrada ou expirada.' }, 404);
    }
    return context.body(null, 204);
  });

  app.post('/api/opportunities/:id/feedback', async (context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: 'Envie um feedback válido.' }, 400);
    }
    const feedback = parseFeedback(body);
    if (!feedback) {
      return context.json({ error: 'Confira os campos e as opções do feedback.' }, 400);
    }
    const submitted = await dependencies.engagements.submitFeedback(
      context.get('invitationId'),
      context.req.param('id'),
      feedback,
    );
    if (!submitted) {
      return context.json({ error: 'Oportunidade não encontrada ou expirada.' }, 404);
    }
    return context.body(null, 204);
  });

  app.notFound((context) => context.json({ error: 'Rota não encontrada.' }, 404));

  return app;
}
