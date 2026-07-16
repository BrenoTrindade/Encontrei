import type { Confidence, RestrictionStatus, ScoreBand } from '../types/opportunity';

export const scoreBandLabel: Record<ScoreBand, string> = {
  high: 'Oportunidade alta',
  medium: 'Oportunidade média',
  low: 'Oportunidade baixa',
};

export const confidenceLabel: Record<Confidence, string> = {
  high: 'Confiança alta',
  medium: 'Confiança média',
  low: 'Confiança baixa',
};

export const restrictionLabel: Record<RestrictionStatus, string> = {
  allowed_to_recommend: 'Sem restrição crítica conhecida nas fontes verificadas',
  needs_verification: 'Verificação local necessária',
  not_recommended: 'Busca não recomendada',
};

export const scoreBandColor: Record<ScoreBand, 'success' | 'warning' | 'default'> = {
  high: 'success',
  medium: 'warning',
  low: 'default',
};

export const factorLabel: Record<string, string> = {
  circulation: 'Circulação',
  tide: 'Janela de maré',
  recency: 'Tempo desde a circulação',
  conditions: 'Condições para a busca',
};

export function restrictionSeverity(
  status: RestrictionStatus,
): 'success' | 'warning' | 'error' {
  if (status === 'not_recommended') return 'error';
  if (status === 'needs_verification') return 'warning';
  return 'success';
}
