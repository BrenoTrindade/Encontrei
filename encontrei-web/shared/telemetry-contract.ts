export type ParticipantEventName = 'radar_viewed' | 'day_changed' | 'opportunity_viewed' | 'map_opened' | 'feedback_started';

export interface ParticipantEventInput {
  id: string;
  name: ParticipantEventName;
  opportunityId?: string;
  localDate?: string;
}
