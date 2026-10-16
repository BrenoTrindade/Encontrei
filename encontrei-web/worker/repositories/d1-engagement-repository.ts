import type {
  EngagementRepository,
  OpportunityEngagementState,
  OpportunityFeedbackInput,
} from '../domain/engagement/engagement';

interface EngagementRow {
  saved_at: string | null;
  intent_to_go: number | null;
  feedback_submitted: number;
  went_to_beach: number | null;
  followed_window: number | null;
  decision_effect: OpportunityFeedbackInput['decisionEffect'] | null;
  result_category: OpportunityFeedbackInput['resultCategory'] | null;
  information_correct: number | null;
  comment: string | null;
}

export class D1EngagementRepository implements EngagementRepository {
  constructor(
    private readonly database: D1Database,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async getState(
    invitationId: string,
    opportunityId: string,
  ): Promise<OpportunityEngagementState | null> {
    const row = await this.database
      .prepare(`
        SELECT
          saved_opportunity.saved_at,
          saved_opportunity.intent_to_go,
          CASE WHEN feedback.id IS NULL THEN 0 ELSE 1 END AS feedback_submitted,
          feedback.went_to_beach,
          feedback.followed_window,
          feedback.decision_effect,
          feedback.result_category,
          feedback.information_correct,
          feedback.comment
        FROM opportunity_snapshot
        LEFT JOIN saved_opportunity
          ON saved_opportunity.opportunity_id = opportunity_snapshot.id
          AND saved_opportunity.invitation_id = ?1
        LEFT JOIN feedback
          ON feedback.opportunity_id = opportunity_snapshot.id
          AND feedback.invitation_id = ?1
        WHERE opportunity_snapshot.id = ?2
          AND (
            (opportunity_snapshot.status = 'published'
              AND opportunity_snapshot.restriction_status <> 'not_recommended'
              AND opportunity_snapshot.expires_at > ?3)
            OR saved_opportunity.invitation_id IS NOT NULL
            OR feedback.invitation_id IS NOT NULL
          )
      `)
      .bind(invitationId, opportunityId, this.clock().toISOString())
      .first<EngagementRow>();
    if (!row) return null;
    const feedback = row.feedback_submitted === 1
      && row.went_to_beach !== null
      && row.followed_window !== null
      && row.decision_effect !== null
      && row.result_category !== null
      && row.information_correct !== null
      ? {
          wentToBeach: row.went_to_beach === 1,
          followedWindow: row.followed_window === 1,
          decisionEffect: row.decision_effect,
          resultCategory: row.result_category,
          informationCorrect: row.information_correct === 1,
          ...(row.comment === null ? {} : { comment: row.comment }),
        }
      : null;
    return {
      saved: row.saved_at !== null,
      intentToGo: row.intent_to_go === null ? null : row.intent_to_go === 1,
      savedAt: row.saved_at,
      feedbackSubmitted: row.feedback_submitted === 1,
      feedback,
    };
  }

  async save(
    invitationId: string,
    opportunityId: string,
    intentToGo: boolean,
  ): Promise<OpportunityEngagementState | null> {
    const now = this.clock().toISOString();
    const result = await this.database
      .prepare(`
        INSERT INTO saved_opportunity (invitation_id, opportunity_id, saved_at, intent_to_go)
        SELECT ?1, id, ?2, ?3
        FROM opportunity_snapshot
        WHERE id = ?4 AND status = 'published' AND expires_at > ?2
          AND restriction_status <> 'not_recommended'
        ON CONFLICT(invitation_id, opportunity_id) DO UPDATE SET
          intent_to_go = excluded.intent_to_go
      `)
      .bind(invitationId, now, intentToGo ? 1 : 0, opportunityId)
      .run();
    if (result.meta.changes === 0) return null;
    return this.getState(invitationId, opportunityId);
  }

  async remove(invitationId: string, opportunityId: string): Promise<boolean> {
    if (!await this.getState(invitationId, opportunityId)) return false;
    await this.database
      .prepare('DELETE FROM saved_opportunity WHERE invitation_id = ?1 AND opportunity_id = ?2')
      .bind(invitationId, opportunityId)
      .run();
    return true;
  }

  async submitFeedback(
    invitationId: string,
    opportunityId: string,
    feedback: OpportunityFeedbackInput,
  ): Promise<boolean> {
    if (!await this.getState(invitationId, opportunityId)) return false;
    const submittedAt = this.clock().toISOString();
    await this.database
      .prepare(`
        INSERT INTO feedback (
          id, invitation_id, opportunity_id, went_to_beach, followed_window,
          decision_effect, result_category, information_correct, comment, submitted_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        ON CONFLICT(invitation_id, opportunity_id) DO UPDATE SET
          went_to_beach = excluded.went_to_beach,
          followed_window = excluded.followed_window,
          decision_effect = excluded.decision_effect,
          result_category = excluded.result_category,
          information_correct = excluded.information_correct,
          comment = excluded.comment,
          submitted_at = excluded.submitted_at
      `)
      .bind(
        crypto.randomUUID(),
        invitationId,
        opportunityId,
        feedback.wentToBeach ? 1 : 0,
        feedback.followedWindow ? 1 : 0,
        feedback.decisionEffect,
        feedback.resultCategory,
        feedback.informationCorrect ? 1 : 0,
        feedback.comment ?? null,
        submittedAt,
      )
      .run();
    return true;
  }
}
