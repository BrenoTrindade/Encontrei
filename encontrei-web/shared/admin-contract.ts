export interface PilotParticipant {
  id: string;
  code: string;
  acceptedAt: string | null;
  revoked: boolean;
  telemetryEnabled: boolean;
  radarViews: number;
  detailViews: number;
  saves: number;
  intentions: number;
  feedbacks: number;
  changedDecision: number;
  confirmedDecision: number;
  followedWindow: number;
  incorrectInformation: number;
  weeksWithActivity: number;
}

export interface PilotSummary {
  generatedAt: string;
  participants: PilotParticipant[];
  weeklyActivity: Array<{ weekStart: string; participants: number }>;
  totals: {
    invited: number; accepted: number; telemetryEnabled: number; saves: number; intentions: number;
    feedbacks: number; changedDecision: number; confirmedDecision: number;
    followedWindow: number; incorrectInformation: number;
  };
  recentActions: Array<{ action: string; occurred_at: string }>;
  informationIssues: Array<{ participantCode: string; opportunityId: string; comment: string | null; submittedAt: string }>;
}
