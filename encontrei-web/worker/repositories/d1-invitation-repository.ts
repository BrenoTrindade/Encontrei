import type {
  AcceptedInvitation,
  InvitationRepository,
  ParticipantSession,
} from '../domain/invitations/invitation';
import { secureToken, sha256 } from './crypto';

interface InvitationRow {
  id: string;
  participant_code: string;
}

export class D1InvitationRepository implements InvitationRepository {
  constructor(private readonly database: D1Database) {}

  async accept(token: string): Promise<AcceptedInvitation | null> {
    const tokenHash = await sha256(token);
    const invitation = await this.database
      .prepare(`
        SELECT id, participant_code
        FROM invitation
        WHERE token_hash = ?1 AND revoked_at IS NULL
      `)
      .bind(tokenHash)
      .first<InvitationRow>();

    if (!invitation) return null;

    const sessionToken = secureToken();
    const sessionHash = await sha256(sessionToken);
    const now = new Date().toISOString();

    await this.database
      .prepare(`
        UPDATE invitation
        SET accepted_at = COALESCE(accepted_at, ?1), session_hash = ?2, last_seen_at = ?1
        WHERE id = ?3 AND revoked_at IS NULL
      `)
      .bind(now, sessionHash, invitation.id)
      .run();

    return {
      participantCode: invitation.participant_code,
      sessionToken,
    };
  }

  async findParticipantBySession(sessionToken: string): Promise<ParticipantSession | null> {
    const sessionHash = await sha256(sessionToken);
    const invitation = await this.database
      .prepare(`
        SELECT id, participant_code
        FROM invitation
        WHERE session_hash = ?1 AND revoked_at IS NULL
      `)
      .bind(sessionHash)
      .first<InvitationRow>();

    if (!invitation) return null;

    await this.database
      .prepare('UPDATE invitation SET last_seen_at = ?1 WHERE id = ?2')
      .bind(new Date().toISOString(), invitation.id)
      .run();

    return { participantCode: invitation.participant_code };
  }
}
