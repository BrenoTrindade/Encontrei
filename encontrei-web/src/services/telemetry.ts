import type { ParticipantEventInput } from '../../shared/telemetry-contract';

let enabled = false;

export async function getTelemetryPreference(): Promise<boolean> {
  const response = await fetch('/api/telemetry/consent', { credentials: 'include' });
  if (!response.ok) { enabled = false; throw new Error('Não foi possível consultar a preferência.'); }
  const body = await response.json() as { enabled: boolean };
  enabled = body.enabled === true;
  return enabled;
}

export async function setTelemetryPreference(value: boolean): Promise<void> {
  const response = await fetch('/api/telemetry/consent', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: value }),
  });
  if (!response.ok) throw new Error('Não foi possível alterar a preferência.');
  enabled = value;
}

export function trackParticipantEvent(event: Omit<ParticipantEventInput, 'id'>): void {
  if (!enabled) return;
  // No offline queue: optional measurement must never block the product or retain pending events.
  void fetch('/api/events', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...event, id: crypto.randomUUID() }),
  }).catch(() => {});
}
