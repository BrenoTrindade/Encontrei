import type {
  AcceptInvitationResponse,
  OpportunityDetail,
  OpportunitySummary,
} from '../types/opportunity';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      ...init,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'Não foi possível se conectar ao Encontrei.');
  }

  if (!response.ok) {
    let message = 'Não foi possível concluir a solicitação.';
    try {
      const body = (await response.json()) as { error?: string; message?: string };
      message = body.message ?? body.error ?? message;
    } catch {
      // A resposta pode não conter JSON; a mensagem segura acima é suficiente.
    }
    throw new ApiError(response.status, message);
  }

  return (await response.json()) as T;
}

export function acceptInvitation(token: string): Promise<AcceptInvitationResponse> {
  return request('/api/invitations/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}

export function getOpportunities(date: string): Promise<OpportunitySummary[]> {
  return request<{ date: string; opportunities: OpportunitySummary[] }>(
    `/api/opportunities?date=${encodeURIComponent(date)}`,
  ).then((response) => response.opportunities);
}

export function getOpportunity(id: string): Promise<OpportunityDetail> {
  return request(`/api/opportunities/${encodeURIComponent(id)}`);
}
