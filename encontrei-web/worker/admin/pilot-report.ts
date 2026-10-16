import type { PilotParticipant, PilotSummary } from '../../shared/admin-contract';

export interface ParticipantRow {
  id: string; participant_code: string; issued_at: string; accepted_at: string | null;
  revoked_at: string | null; telemetry_consent_at: string | null;
}
export interface EventRow {
  id: string; invitation_id: string; event_name: string; opportunity_id: string | null;
  local_date: string | null; occurred_at: string;
}
export interface SaveRow { invitation_id: string; opportunity_id: string; saved_at: string; intent_to_go: number }
export interface FeedbackRow {
  id: string; invitation_id: string; opportunity_id: string; went_to_beach: number;
  followed_window: number; decision_effect: string; result_category: string;
  information_correct: number; comment: string | null; submitted_at: string;
}
export interface PilotRecords {
  participants: ParticipantRow[]; events: EventRow[]; saves: SaveRow[]; feedback: FeedbackRow[];
}

const localDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
});

function weekStart(timestamp: string): string {
  const date = new Date(`${localDate.format(new Date(timestamp))}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export function summarizePilot(records: PilotRecords, now: Date): Omit<PilotSummary, 'recentActions'> {
  const weeks = new Map<string, Set<string>>();
  const participants = records.participants.map((participant): PilotParticipant => {
    const events = records.events.filter((item) => item.invitation_id === participant.id);
    const saves = records.saves.filter((item) => item.invitation_id === participant.id);
    const feedback = records.feedback.filter((item) => item.invitation_id === participant.id);
    const activeWeeks = new Set([
      ...events.map((item) => item.occurred_at), ...saves.map((item) => item.saved_at),
      ...feedback.map((item) => item.submitted_at),
    ].map(weekStart));
    for (const week of activeWeeks) {
      const members = weeks.get(week) ?? new Set<string>();
      members.add(participant.id); weeks.set(week, members);
    }
    return {
      id: participant.id, code: participant.participant_code, acceptedAt: participant.accepted_at,
      revoked: participant.revoked_at !== null,
      telemetryEnabled: participant.telemetry_consent_at !== null && participant.revoked_at === null,
      radarViews: events.filter((item) => item.event_name === 'radar_viewed').length,
      detailViews: events.filter((item) => item.event_name === 'opportunity_viewed').length,
      saves: saves.length, intentions: saves.filter((item) => item.intent_to_go === 1).length,
      feedbacks: feedback.length,
      changedDecision: feedback.filter((item) => item.decision_effect === 'changed').length,
      confirmedDecision: feedback.filter((item) => item.decision_effect === 'confirmed').length,
      followedWindow: feedback.filter((item) => item.followed_window === 1).length,
      incorrectInformation: feedback.filter((item) => item.information_correct === 0).length,
      weeksWithActivity: activeWeeks.size,
    };
  });
  const sum = (key: 'saves' | 'intentions' | 'feedbacks' | 'changedDecision' | 'confirmedDecision' | 'followedWindow' | 'incorrectInformation') =>
    participants.reduce((total, participant) => total + participant[key], 0);
  return {
    generatedAt: now.toISOString(), participants,
    informationIssues: records.feedback.filter((item) => item.information_correct === 0).map((item) => ({
      participantCode: records.participants.find((participant) => participant.id === item.invitation_id)?.participant_code ?? '',
      opportunityId: item.opportunity_id, comment: item.comment, submittedAt: item.submitted_at,
    })),
    weeklyActivity: [...weeks].sort(([a], [b]) => a.localeCompare(b))
      .map(([week, members]) => ({ weekStart: week, participants: members.size })),
    totals: {
      invited: participants.length, accepted: participants.filter((item) => item.acceptedAt !== null).length,
      telemetryEnabled: participants.filter((item) => item.telemetryEnabled).length,
      saves: sum('saves'), intentions: sum('intentions'), feedbacks: sum('feedbacks'),
      changedDecision: sum('changedDecision'), confirmedDecision: sum('confirmedDecision'),
      followedWindow: sum('followedWindow'), incorrectInformation: sum('incorrectInformation'),
    },
  };
}

export function participantsCsv(participants: PilotParticipant[]): string {
  const columns: Array<keyof PilotParticipant> = [
    'id', 'code', 'acceptedAt', 'revoked', 'telemetryEnabled', 'radarViews', 'detailViews', 'saves',
    'intentions', 'feedbacks', 'changedDecision', 'confirmedDecision', 'followedWindow',
    'incorrectInformation', 'weeksWithActivity',
  ];
  const cell = (value: unknown) => {
    const text = value === null ? '' : String(value);
    const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return '\uFEFF' + [columns.map(cell).join(','),
    ...participants.map((participant) => columns.map((key) => cell(participant[key])).join(',')),
  ].join('\r\n');
}
