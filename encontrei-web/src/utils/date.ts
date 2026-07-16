const PILOT_TIME_ZONE = 'America/Sao_Paulo';

function dateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PILOT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return { year: value('year'), month: value('month'), day: value('day') };
}

export function getPilotDates(now = new Date()): string[] {
  const { year, month, day } = dateParts(now);
  const anchor = new Date(Date.UTC(year, month - 1, day, 12));

  return [0, 1, 2].map((offset) => {
    const current = new Date(anchor);
    current.setUTCDate(anchor.getUTCDate() + offset);
    return current.toISOString().slice(0, 10);
  });
}

export function formatOpportunityWindow(startUtc: string, endUtc: string): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: PILOT_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `${formatter.format(new Date(startUtc))}–${formatter.format(new Date(endUtc))}`;
}

export function formatSourceUpdatedAt(updatedAt: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: PILOT_TIME_ZONE,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(updatedAt));
}
