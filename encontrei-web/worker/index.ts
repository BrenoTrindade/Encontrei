/// <reference types="@cloudflare/workers-types" />

import { createApp } from './app';
import { D1InvitationRepository } from './repositories/d1-invitation-repository';
import { D1OpportunityRepository } from './repositories/d1-opportunity-repository';
import { D1EngagementRepository } from './repositories/d1-engagement-repository';
import { D1TelemetryRepository } from './repositories/d1-telemetry-repository';
import { AdminService } from './admin/admin-service';

interface Env {
  DB: D1Database;
  ADMIN_SECRET?: string;
}

export default {
  fetch(request: Request, env: Env, executionContext: ExecutionContext) {
    const app = createApp({
      invitations: new D1InvitationRepository(env.DB),
      opportunities: new D1OpportunityRepository(env.DB),
      engagements: new D1EngagementRepository(env.DB),
      telemetry: new D1TelemetryRepository(env.DB),
      admin: env.ADMIN_SECRET ? new AdminService(env.DB, env.ADMIN_SECRET) : undefined,
    });

    return app.fetch(request, env, executionContext);
  },
} satisfies ExportedHandler<Env>;
