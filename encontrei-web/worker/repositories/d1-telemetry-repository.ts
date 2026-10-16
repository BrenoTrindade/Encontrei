import type { ParticipantEventInput } from '../../shared/telemetry-contract';
import type { TelemetryRepository } from '../domain/telemetry/telemetry';

export class D1TelemetryRepository implements TelemetryRepository {
  constructor(private readonly database: D1Database) {}

  async isEnabled(invitationId: string): Promise<boolean> {
    const row = await this.database.prepare(`SELECT telemetry_consent_at FROM invitation
      WHERE id = ?1 AND revoked_at IS NULL`).bind(invitationId)
      .first<{ telemetry_consent_at: string | null }>();
    return row !== null && row.telemetry_consent_at !== null;
  }

  async setEnabled(invitationId: string, enabled: boolean): Promise<void> {
    await this.database.prepare(`UPDATE invitation SET telemetry_consent_at = ?2
      WHERE id = ?1 AND revoked_at IS NULL`)
      .bind(invitationId, enabled ? new Date().toISOString() : null).run();
  }

  async record(invitationId: string, event: ParticipantEventInput): Promise<void> {
    await this.database.prepare(`INSERT INTO participant_event
      (id, invitation_id, event_name, opportunity_id, local_date, occurred_at)
      SELECT ?1, id, ?3, ?4, ?5, ?6 FROM invitation
      WHERE id = ?2 AND telemetry_consent_at IS NOT NULL AND revoked_at IS NULL
      ON CONFLICT(invitation_id, id) DO NOTHING`)
      .bind(event.id, invitationId, event.name, event.opportunityId ?? null,
        event.localDate ?? null, new Date().toISOString()).run();
  }
}
