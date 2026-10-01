import type { OpportunityDetail, OpportunitySummary } from '../../../shared/opportunity-contract';

export type { OpportunityDetail, OpportunitySummary };

export interface OpportunityRepository {
  listByLocalDate(date: string): Promise<OpportunitySummary[]>;
  findPublishedById(id: string): Promise<OpportunityDetail | null>;
}
