import { Hono, type MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { InvitationRepository } from './domain/invitations/invitation';
import type { OpportunityRepository } from './domain/opportunities/opportunity';

export interface AppDependencies {
  invitations: InvitationRepository;
  opportunities: OpportunityRepository;
}

type Variables = {
  participantCode: string;
};

const SESSION_COOKIE = 'encontrei_session';
const SESSION_MAX_AGE_SECONDS = 28 * 24 * 60 * 60;
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

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
      secure: true,
      sameSite: 'Strict',
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: '/',
    });

    return context.json({ participantCode: invitation.participantCode });
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
    await next();
  };

  app.use('/api/opportunities', requireParticipant);
  app.use('/api/opportunities/*', requireParticipant);

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

  app.notFound((context) => context.json({ error: 'Rota não encontrada.' }, 404));

  return app;
}
