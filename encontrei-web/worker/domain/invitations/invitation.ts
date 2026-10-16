export interface AcceptedInvitation {
  participantCode: string;
  sessionToken: string;
}

export interface ParticipantSession {
  invitationId: string;
  participantCode: string;
}

export interface InvitationRepository {
  accept(token: string): Promise<AcceptedInvitation | null>;
  findParticipantBySession(sessionToken: string): Promise<ParticipantSession | null>;
}
