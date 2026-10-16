import type { PilotSummary } from '../../shared/admin-contract';
import { ApiError, request } from './api';

export const getPilotSummary = () => request<PilotSummary>('/api/admin/pilot-summary');
export const loginAdmin = (secret: string) => request<void>('/api/admin/session', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret }),
});
export const logoutAdmin = () => request<void>('/api/admin/session', { method: 'DELETE' });
export const deleteParticipant = (id: string, confirmation: string) => request<void>(
  `/api/admin/participants/${encodeURIComponent(id)}`,
  { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation }) },
);

export async function downloadPilotExport(format: 'csv' | 'json'): Promise<void> {
  const response = await fetch(`/api/admin/export?format=${format}`, { credentials: 'include' });
  if (!response.ok) throw new ApiError(response.status, 'Não foi possível exportar os dados.');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url; link.download = `encontrei-piloto.${format}`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
