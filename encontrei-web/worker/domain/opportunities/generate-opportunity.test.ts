import { describe, expect, it } from 'vitest';
import { generateDailyOpportunity } from './generate-opportunity';

describe('generateDailyOpportunity', () => {
  it('combines an official low tide and current regional conditions into an auditable snapshot', () => {
    const result = generateDailyOpportunity({
      beach: {
        id: 'camburi',
        name: 'Praia de Camburi',
        municipality: 'Vitória',
        habitualCirculation: 0.25,
        restrictionStatus: 'needs_verification',
        restrictionSummary: 'Situação inconclusiva — verifique as regras e condições locais.',
      },
      station: {
        id: 'porto-tubarao',
        name: 'Porto de Tubarão',
        sourceUrl: 'https://www.marinha.mil.br/chm/',
      },
      localDate: '2026-10-01',
      tides: [
        { localDate: '2026-10-01', forecastAtUtc: '2026-10-01T08:44:00.000Z', heightM: 1.29 },
        { localDate: '2026-10-01', forecastAtUtc: '2026-10-01T15:01:00.000Z', heightM: 0.53 },
        { localDate: '2026-10-01', forecastAtUtc: '2026-10-01T20:19:00.000Z', heightM: 1.14 },
      ],
      forecast: {
        retrievedAtUtc: '2026-09-30T12:00:00.000Z',
        freshUntilUtc: '2026-09-30T18:00:00.000Z',
        usableUntilUtc: '2026-10-01T00:00:00.000Z',
        weatherSourceUrl: 'https://api.open-meteo.com/v1/dwd-icon',
        marineSourceUrl: 'https://marine-api.open-meteo.com/v1/marine',
        points: [{
          validAtUtc: '2026-10-01T15:00:00.000Z',
          precipitationProbability: 10,
          precipitationMm: 0,
          weatherCode: 1,
          windSpeedKmh: 8,
          windDirectionDegrees: 90,
          windGustsKmh: 15,
          waveHeightM: 1,
          waveDirectionDegrees: 120,
          wavePeriodSeconds: 8,
          swellHeightM: 0.8,
          swellDirectionDegrees: 130,
          swellPeriodSeconds: 10,
        }],
      },
      generatedAtUtc: '2026-09-30T12:00:00.000Z',
    });

    expect(result).toMatchObject({
      id: 'opp-camburi-2026-10-01-score-v0.1',
      recommendedStartUtc: '2026-10-01T14:01:00.000Z',
      recommendedEndUtc: '2026-10-01T16:01:00.000Z',
      scoreInternal: 48,
      scoreBand: 'medium',
      confidence: 'medium',
      confidenceReasons: ['Circulação usa uma estimativa atual.'],
      staleAt: '2026-09-30T18:00:00.000Z',
      expiresAt: '2026-10-01T00:00:00.000Z',
    });
    expect(result?.breakdown).toEqual(expect.arrayContaining([
      expect.objectContaining({
        factor: 'tide',
        normalizedValue: 1,
        maxContribution: 30,
        contribution: 30,
        sourceUrl: 'https://www.marinha.mil.br/chm/',
      }),
      expect.objectContaining({
        factor: 'conditions',
        normalizedValue: 0.8333333333333334,
        contribution: 8,
        sourceUrl: 'https://api.open-meteo.com/v1/dwd-icon',
      }),
    ]));
    expect(result?.sources.map((source) => source.label)).toEqual([
      'CHM — Porto de Tubarão',
      'Open-Meteo — ICON/GWAM do DWD',
    ]);
  });
});
