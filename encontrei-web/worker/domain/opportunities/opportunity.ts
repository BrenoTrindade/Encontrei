import type { OpportunityDetail, OpportunitySummary, SavedOpportunitySummary } from '../../../shared/opportunity-contract';

export type { OpportunityDetail, OpportunitySummary };

export interface OpportunityRepository {
  listByLocalDate(date: string): Promise<OpportunitySummary[]>;
  findPublishedById(id: string): Promise<OpportunityDetail | null>;
  listSaved(invitationId: string): Promise<SavedOpportunitySummary[]>;
  findSavedById(invitationId: string, id: string): Promise<OpportunityDetail | null>;
}
