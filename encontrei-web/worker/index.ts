/// <reference types="@cloudflare/workers-types" />

import { createApp } from './app';
import { D1InvitationRepository } from './repositories/d1-invitation-repository';
import { D1OpportunityRepository } from './repositories/d1-opportunity-repository';

interface Env {
  DB: D1Database;
}

export default {
  fetch(request: Request, env: Env, executionContext: ExecutionContext) {
    const app = createApp({
      invitations: new D1InvitationRepository(env.DB),
      opportunities: new D1OpportunityRepository(env.DB),
    });

    return app.fetch(request, env, executionContext);
  },
} satisfies ExportedHandler<Env>;
