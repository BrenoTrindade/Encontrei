import { describe, expect, it } from 'vitest';
import {
  assessOpportunityConfidence,
  calculateOpportunity,
} from './opportunity-score';

describe('calculateOpportunity', () => {
  it('produces a high, explainable score from fully favorable factors', () => {
    const result = calculateOpportunity({
      circulation: {
        normalizedValue: 1,
        explanation: 'Evento recente com circulação confirmada.',
      },
      tide: {
        normalizedValue: 1,
        explanation: 'Maré mínima dentro da janela.',
      },
      recency: {
        normalizedValue: 1,
        explanation: 'Evento terminou há poucas horas.',
      },
      conditions: {
        normalizedValue: 1,
        explanation: 'Condições adequadas para a busca.',
      },
      restrictionStatus: 'allowed_to_recommend',
    });

    expect(result).toMatchObject({
      scoreInternal: 100,
      scoreBand: 'high',
      scoreVersion: 'score-v0.1',
      actionable: true,
    });
    expect(result.breakdown.map(({ factor, contribution }) => ({ factor, contribution }))).toEqual([
      { factor: 'circulation', contribution: 40 },
      { factor: 'tide', contribution: 30 },
      { factor: 'recency', contribution: 20 },
      { factor: 'conditions', contribution: 10 },
    ]);
  });

  it('keeps the score but blocks action when the location is not recommended', () => {
    const result = calculateOpportunity({
      circulation: { normalizedValue: 0.5, explanation: 'Circulação habitual estimada.' },
      tide: { normalizedValue: 1, explanation: 'Boa janela de maré.' },
      recency: { normalizedValue: 0, explanation: 'Sem evento recente.' },
      conditions: { normalizedValue: 1, explanation: 'Condições adequadas.' },
      restrictionStatus: 'not_recommended',
    });

    expect(result.scoreInternal).toBe(60);
    expect(result.scoreBand).toBe('medium');
    expect(result.actionable).toBe(false);
  });

  it('rejects normalized values outside the agreed zero-to-one range', () => {
    expect(() => calculateOpportunity({
      circulation: { normalizedValue: 1.2, explanation: 'Entrada inválida.' },
      tide: { normalizedValue: 0, explanation: 'Sem dado.' },
      recency: { normalizedValue: 0, explanation: 'Sem dado.' },
      conditions: { normalizedValue: 0, explanation: 'Sem dado.' },
      restrictionStatus: 'needs_verification',
    })).toThrow(RangeError);
  });
});

describe('assessOpportunityConfidence', () => {
  it('is high only when all essential inputs are direct and current', () => {
    expect(assessOpportunityConfidence({
      circulation: 'direct_current',
      tide: 'direct_current',
      conditions: 'direct_current',
    })).toEqual({ level: 'high', reasons: ['Todos os dados essenciais são diretos e atuais.'] });
  });

  it('is medium when current data includes an explicit estimate', () => {
    expect(assessOpportunityConfidence({
      circulation: 'estimated_current',
      tide: 'direct_current',
      conditions: 'direct_current',
    })).toEqual({
      level: 'medium',
      reasons: ['Circulação usa uma estimativa atual.'],
    });
  });

  it('is low when an essential input is missing or stale', () => {
    expect(assessOpportunityConfidence({
      circulation: 'missing',
      tide: 'direct_current',
      conditions: 'stale',
    })).toEqual({
      level: 'low',
      reasons: ['Circulação está ausente.', 'Condições estão desatualizadas.'],
    });
  });
});
