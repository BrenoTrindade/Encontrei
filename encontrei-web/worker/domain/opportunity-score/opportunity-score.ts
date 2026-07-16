export type ScoreBand = 'low' | 'medium' | 'high';
export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type RestrictionStatus =
  | 'allowed_to_recommend'
  | 'needs_verification'
  | 'not_recommended';

type FactorName = 'circulation' | 'tide' | 'recency' | 'conditions';

export interface FactorInput {
  normalizedValue: number;
  explanation: string;
  sourceUrl?: string;
}

export interface OpportunityScoreInput {
  circulation: FactorInput;
  tide: FactorInput;
  recency: FactorInput;
  conditions: FactorInput;
  restrictionStatus: RestrictionStatus;
}

export interface OpportunityScoreBreakdown {
  factor: FactorName;
  normalizedValue: number;
  weight: number;
  contribution: number;
  explanation: string;
  sourceUrl?: string;
}

export interface OpportunityScoreResult {
  scoreInternal: number;
  scoreBand: ScoreBand;
  scoreVersion: 'score-v0.1';
  actionable: boolean;
  breakdown: OpportunityScoreBreakdown[];
}

const FACTORS: ReadonlyArray<{ name: FactorName; weight: number }> = [
  { name: 'circulation', weight: 40 },
  { name: 'tide', weight: 30 },
  { name: 'recency', weight: 20 },
  { name: 'conditions', weight: 10 },
];

function scoreBandFor(score: number): ScoreBand {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export function calculateOpportunity(input: OpportunityScoreInput): OpportunityScoreResult {
  const breakdown = FACTORS.map(({ name, weight }) => {
    const factor = input[name];
    if (!Number.isFinite(factor.normalizedValue)
      || factor.normalizedValue < 0
      || factor.normalizedValue > 1) {
      throw new RangeError(`${name}.normalizedValue deve estar entre 0 e 1.`);
    }

    return {
      factor: name,
      normalizedValue: factor.normalizedValue,
      weight,
      contribution: Math.round(factor.normalizedValue * weight),
      explanation: factor.explanation,
      ...(factor.sourceUrl ? { sourceUrl: factor.sourceUrl } : {}),
    } satisfies OpportunityScoreBreakdown;
  });

  const scoreInternal = breakdown.reduce((total, factor) => total + factor.contribution, 0);

  return {
    scoreInternal,
    scoreBand: scoreBandFor(scoreInternal),
    scoreVersion: 'score-v0.1',
    actionable: input.restrictionStatus !== 'not_recommended',
    breakdown,
  };
}

export type ConfidenceInputState =
  | 'direct_current'
  | 'estimated_current'
  | 'stale'
  | 'missing';

export interface OpportunityConfidenceInput {
  circulation: ConfidenceInputState;
  tide: ConfidenceInputState;
  conditions: ConfidenceInputState;
}

const CONFIDENCE_MESSAGES: Record<
  keyof OpportunityConfidenceInput,
  { missing: string; stale: string; estimated: string }
> = {
  circulation: {
    missing: 'Circulação está ausente.',
    stale: 'Circulação está desatualizada.',
    estimated: 'Circulação usa uma estimativa atual.',
  },
  tide: {
    missing: 'Maré está ausente.',
    stale: 'Maré está desatualizada.',
    estimated: 'Maré usa uma estimativa atual.',
  },
  conditions: {
    missing: 'Condições estão ausentes.',
    stale: 'Condições estão desatualizadas.',
    estimated: 'Condições usam uma estimativa atual.',
  },
};

export function assessOpportunityConfidence(
  input: OpportunityConfidenceInput,
): { level: ConfidenceLevel; reasons: string[] } {
  const entries = Object.entries(input) as Array<
    [keyof OpportunityConfidenceInput, ConfidenceInputState]
  >;
  const lowReasons = entries.flatMap(([name, state]) => {
    if (state === 'missing') return [CONFIDENCE_MESSAGES[name].missing];
    if (state === 'stale') return [CONFIDENCE_MESSAGES[name].stale];
    return [];
  });

  if (lowReasons.length > 0) {
    return { level: 'low', reasons: lowReasons };
  }

  const estimateReasons = entries.flatMap(([name, state]) => (
    state === 'estimated_current'
      ? [CONFIDENCE_MESSAGES[name].estimated]
      : []
  ));

  if (estimateReasons.length > 0) {
    return { level: 'medium', reasons: estimateReasons };
  }

  return {
    level: 'high',
    reasons: ['Todos os dados essenciais são diretos e atuais.'],
  };
}
