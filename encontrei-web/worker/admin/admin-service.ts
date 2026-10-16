import { secureToken, sha256 } from '../repositories/crypto';
import { summarizePilot, type EventRow, type FeedbackRow, type ParticipantRow, type SaveRow } from './pilot-report';

export class AdminService {
  constructor(
    private readonly database: D1Database,
    private readonly secret: string,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  get configured(): boolean { return this.secret.length >= 32 && this.secret.length <= 256; }

  async login(candidate: string): Promise<{ status: 'ok'; token: string } | { status: 'invalid' | 'limited' }> {
    const now = this.clock();
    const window = Math.floor(now.getTime() / 900_000);
    const attempt = await this.database.prepare(`INSERT INTO admin_login_window (id, window_start, attempts)
      VALUES (1, ?1, 1) ON CONFLICT(id) DO UPDATE SET
      attempts = CASE WHEN window_start = excluded.window_start THEN attempts + 1 ELSE 1 END,
      window_start = excluded.window_start RETURNING attempts`).bind(window).first<{ attempts: number }>();
    if (!attempt || attempt.attempts > 10) return { status: 'limited' };
    const expected = await sha256(this.secret);
    const actual = await sha256(candidate);
    let difference = 0;
    for (let index = 0; index < expected.length; index++) difference |= expected.charCodeAt(index) ^ actual.charCodeAt(index);
    if (difference !== 0) return { status: 'invalid' };
    const token = secureToken();
    await this.database.batch([
      this.database.prepare('DELETE FROM admin_session WHERE expires_at <= ?1').bind(now.toISOString()),
      this.database.prepare('INSERT INTO admin_session (token_hash, secret_hash, expires_at) VALUES (?1, ?2, ?3)')
        .bind(await sha256(token), expected, new Date(now.getTime() + 3_600_000).toISOString()),
      this.database.prepare('DELETE FROM admin_login_window'),
    ]);
    return { status: 'ok', token };
  }

  async authorized(token: string): Promise<boolean> {
    if (!token || token.length > 128) return false;
    return !!await this.database.prepare(`SELECT 1 FROM admin_session
      WHERE token_hash = ?1 AND secret_hash = ?2 AND expires_at > ?3`)
      .bind(await sha256(token), await sha256(this.secret), this.clock().toISOString()).first();
  }

  async logout(token: string): Promise<void> {
    await this.database.prepare('DELETE FROM admin_session WHERE token_hash = ?1').bind(await sha256(token)).run();
  }

  async records() {
    const [participants, events, saves, feedback] = await Promise.all([
      this.database.prepare(`SELECT id, participant_code, issued_at, accepted_at, revoked_at,
        telemetry_consent_at FROM invitation ORDER BY participant_code`).all<ParticipantRow>(),
      this.database.prepare('SELECT id, invitation_id, event_name, opportunity_id, local_date, occurred_at FROM participant_event ORDER BY occurred_at').all<EventRow>(),
      this.database.prepare('SELECT invitation_id, opportunity_id, saved_at, intent_to_go FROM saved_opportunity ORDER BY saved_at').all<SaveRow>(),
      this.database.prepare(`SELECT id, invitation_id, opportunity_id, went_to_beach, followed_window,
        decision_effect, result_category, information_correct, comment, submitted_at FROM feedback ORDER BY submitted_at`).all<FeedbackRow>(),
    ]);
    return { participants: participants.results, events: events.results, saves: saves.results, feedback: feedback.results };
  }

  async summary() {
    const records = await this.records();
    const audit = await this.database.prepare('SELECT action, occurred_at FROM admin_audit ORDER BY occurred_at DESC LIMIT 20')
      .all<{ action: string; occurred_at: string }>();
    return { ...summarizePilot(records, this.clock()), recentActions: audit.results };
  }

  async deleteParticipant(id: string, confirmation: string): Promise<boolean> {
    const result = await this.database.batch([
      this.database.prepare(`INSERT INTO admin_audit (id, action, occurred_at)
        SELECT ?1, 'participant_data_deleted', ?2 WHERE EXISTS
          (SELECT 1 FROM invitation WHERE id = ?3 AND participant_code = ?4)`)
        .bind(crypto.randomUUID(), this.clock().toISOString(), id, confirmation),
      this.database.prepare('DELETE FROM invitation WHERE id = ?1 AND participant_code = ?2').bind(id, confirmation),
    ]);
    return result[1].meta.changes > 0;
  }
}
