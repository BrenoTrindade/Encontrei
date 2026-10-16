export type DecisionEffect = 'changed' | 'confirmed' | 'no_effect';
export type ResultCategory = 'found_relevant' | 'found_other' | 'nothing' | 'not_applicable';

export interface OpportunityEngagementState {
  saved: boolean;
  intentToGo: boolean | null;
  savedAt: string | null;
  feedbackSubmitted: boolean;
  feedback: OpportunityFeedbackInput | null;
}

export interface OpportunityFeedbackInput {
  wentToBeach: boolean;
  followedWindow: boolean;
  decisionEffect: DecisionEffect;
  resultCategory: ResultCategory;
  informationCorrect: boolean;
  comment?: string;
}
