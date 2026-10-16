import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AdminService } from './admin-service';
import { participantsCsv } from './pilot-report';

const COOKIE = 'encontrei_admin_session';

export function createAdminApp(admin?: AdminService) {
  const app = new Hono();
  app.use('*', async (context, next) => {
    context.header('Cache-Control', 'no-store');
    if (!admin?.configured) return context.json({ error: 'Configure o segredo administrativo no ambiente.' }, 503);
    if (context.req.method !== 'GET') {
      const origin = context.req.header('Origin');
      if ((origin && origin !== new URL(context.req.url).origin)
        || context.req.header('Sec-Fetch-Site') === 'cross-site') {
        return context.json({ error: 'Origem não permitida.' }, 403);
      }
    }
    if (context.req.path.endsWith('/session') && context.req.method === 'POST') return next();
    if (!await admin.authorized(getCookie(context, COOKIE) ?? '')) {
      return context.json({ error: 'Entre como administrador.' }, 401);
    }
    await next();
  });

  app.post('/session', async (context) => {
    const body: unknown = await context.req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Object.keys(body).length !== 1
      || !('secret' in body) || typeof body.secret !== 'string' || body.secret.length > 256) {
      return context.json({ error: 'Informe o segredo administrativo.' }, 400);
    }
    const result = await admin!.login(body.secret);
    if (result.status === 'limited') {
      context.header('Retry-After', '900');
      return context.json({ error: 'Muitas tentativas. Aguarde 15 minutos.' }, 429);
    }
    if (result.status !== 'ok') return context.json({ error: 'Credencial inválida.' }, 401);
    const host = new URL(context.req.url).hostname;
    setCookie(context, COOKIE, result.token, {
      httpOnly: true, sameSite: 'Strict', secure: !['localhost', '127.0.0.1', '[::1]'].includes(host),
      maxAge: 3600, path: '/api/admin',
    });
    return context.body(null, 204);
  });
  app.get('/session', (context) => context.body(null, 204));
  app.delete('/session', async (context) => {
    await admin!.logout(getCookie(context, COOKIE) ?? '');
    deleteCookie(context, COOKIE, { path: '/api/admin' });
    return context.body(null, 204);
  });
  app.get('/pilot-summary', async (context) => context.json(await admin!.summary()));
  app.get('/export', async (context) => {
    const format = context.req.query('format');
    if (format === 'csv') {
      context.header('Content-Type', 'text/csv; charset=utf-8');
      context.header('Content-Disposition', 'attachment; filename="encontrei-participantes.csv"');
      return context.body(participantsCsv((await admin!.summary()).participants));
    }
    if (format !== 'json') return context.json({ error: 'Use formato csv ou json.' }, 400);
    context.header('Content-Disposition', 'attachment; filename="encontrei-piloto.json"');
    return context.json({ schemaVersion: 1, exportedAt: new Date().toISOString(), records: await admin!.records() });
  });
  app.delete('/participants/:id', async (context) => {
    const body: unknown = await context.req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Object.keys(body).length !== 1
      || !('confirmation' in body) || typeof body.confirmation !== 'string') {
      return context.json({ error: 'Confirme o código do participante.' }, 400);
    }
    const deleted = await admin!.deleteParticipant(context.req.param('id'), body.confirmation);
    if (!deleted) return context.json({ error: 'Participante não encontrado ou confirmação incorreta.' }, 404);
    return context.body(null, 204);
  });
  return app;
}
