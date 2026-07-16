import type {
  ConfidenceLevel,
  RestrictionStatus,
  ScoreBand,
} from '../opportunity-score/opportunity-score';

export interface BeachSummary {
  id: string;
  name: string;
  municipality: string;
  latitude: number;
  longitude: number;
}

export interface OpportunitySummary {
  id: string;
  beach: BeachSummary;
  recommendedStartUtc: string;
  recommendedEndUtc: string;
  scoreBand: ScoreBand;
  confidence: ConfidenceLevel;
  summary: string;
  restrictionStatus: RestrictionStatus;
  tideStationName: string;
}

export interface OpportunityDetail extends OpportunitySummary {
  breakdown: Array<{
    factor: string;
    contribution: number;
    maxContribution: number;
    explanation: string;
    sourceUrl?: string;
  }>;
  sources: Array<{
    label: string;
    url: string;
    updatedAt: string;
  }>;
  restrictionSummary: string;
}

export interface OpportunityRepository {
  listByLocalDate(date: string): Promise<OpportunitySummary[]>;
  findPublishedById(id: string): Promise<OpportunityDetail | null>;
}
