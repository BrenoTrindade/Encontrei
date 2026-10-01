export type ScoreBand = 'low' | 'medium' | 'high';
export type Confidence = 'low' | 'medium' | 'high';
export type RestrictionStatus =
  | 'allowed_to_recommend'
  | 'needs_verification'
  | 'not_recommended';
export type OpportunityFactor = 'circulation' | 'tide' | 'recency' | 'conditions';

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
  confidenceReasons: string[];
  summary: string;
  restrictionStatus: RestrictionStatus;
  stale: boolean;
  tideStationName: string;
  tideStationDistanceKm: number;
}

export interface BreakdownItem {
  factor: OpportunityFactor;
  normalizedValue: number;
  contribution: number;
  maxContribution: number;
  explanation: string;
  sourceUrl?: string;
}

export interface OpportunitySource {
  label: string;
  url: string;
  updatedAt: string;
  attribution?: string;
  limitations?: string;
}

export interface OpportunityDetail extends OpportunitySummary {
  breakdown: BreakdownItem[];
  sources: OpportunitySource[];
  restrictionSummary: string;
}
