export type ScoreBand = 'low' | 'medium' | 'high';
export type Confidence = 'low' | 'medium' | 'high';
export type RestrictionStatus =
  | 'allowed_to_recommend'
  | 'needs_verification'
  | 'not_recommended';

export interface Beach {
  id: string;
  name: string;
  municipality: string;
  latitude: number;
  longitude: number;
}

export interface OpportunitySummary {
  id: string;
  beach: Beach;
  recommendedStartUtc: string;
  recommendedEndUtc: string;
  scoreBand: ScoreBand;
  confidence: Confidence;
  summary: string;
  restrictionStatus: RestrictionStatus;
  tideStationName: string;
}

export interface BreakdownItem {
  factor: string;
  contribution: number;
  maxContribution: number;
  explanation: string;
  sourceUrl?: string;
}

export interface OpportunitySource {
  label: string;
  url: string;
  updatedAt: string;
}

export interface OpportunityDetail extends OpportunitySummary {
  breakdown: BreakdownItem[];
  sources: OpportunitySource[];
  restrictionSummary: string;
}

export interface AcceptInvitationResponse {
  participantCode: string;
}
