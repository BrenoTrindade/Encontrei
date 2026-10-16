import type { ParticipantEventInput } from '../../../shared/telemetry-contract';

export interface TelemetryRepository {
  isEnabled(invitationId: string): Promise<boolean>;
  setEnabled(invitationId: string, enabled: boolean): Promise<void>;
  record(invitationId: string, event: ParticipantEventInput): Promise<void>;
}
