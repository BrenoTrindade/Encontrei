import { describe, expect, it } from 'vitest';
import {
  parseOpportunityBreakdown,
  parseOpportunitySources,
} from './d1-opportunity-repository';

describe('D1 opportunity snapshot validation', () => {
  it('accepts the current score and source contracts', () => {
    expect(parseOpportunityBreakdown(JSON.stringify([{
      factor: 'tide',
      normalizedValue: 1,
      contribution: 25,
      maxContribution: 25,
      explanation: 'Baixa-mar oficial.',
      sourceUrl: 'https://example.com/tide',
    }]))).toHaveLength(1);

    expect(parseOpportunitySources(JSON.stringify([{
      label: 'Fonte oficial',
      url: 'https://example.com/source',
      updatedAt: '2026-09-30T12:00:00.000Z',
      attribution: 'Órgão responsável.',
      limitations: 'Referência regional.',
    }]))).toHaveLength(1);
  });

  it('rejects malformed persisted JSON instead of leaking it through the API', () => {
    expect(() => parseOpportunityBreakdown(JSON.stringify([{
      factor: 'tide',
      normalizedValue: 2,
      contribution: 25,
      maxContribution: 25,
      explanation: 'Inválido.',
    }]))).toThrow(/contrato do score/);

    expect(() => parseOpportunitySources(JSON.stringify([{
      label: 'Fonte insegura',
      url: 'javascript:alert(1)',
      updatedAt: 'ontem',
    }]))).toThrow(/contrato de fontes/);
  });
});
