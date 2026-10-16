import type {
  OpportunityEngagementState,
  OpportunityFeedbackInput,
} from '../../../shared/engagement-contract';

export type { OpportunityEngagementState, OpportunityFeedbackInput };

export interface EngagementRepository {
  getState(invitationId: string, opportunityId: string): Promise<OpportunityEngagementState | null>;
  save(
    invitationId: string,
    opportunityId: string,
    intentToGo: boolean,
  ): Promise<OpportunityEngagementState | null>;
  remove(invitationId: string, opportunityId: string): Promise<boolean>;
  submitFeedback(
    invitationId: string,
    opportunityId: string,
    feedback: OpportunityFeedbackInput,
  ): Promise<boolean>;
}
