import { describe, expect, it } from 'vitest';
import { parseUsableForecastCache } from '../../../scripts/lib/forecast-cache';

function cache(usableUntilUtc: string) {
  return {
    forecasts: [{
      beachId: 'synthetic-beach',
      requestedLatitude: -20,
      requestedLongitude: -40,
      weatherGridLatitude: -20.1,
      weatherGridLongitude: -40.1,
      marineGridLatitude: -20.2,
      marineGridLongitude: -40.2,
      retrievedAtUtc: '2032-01-01T00:00:00.000Z',
      freshUntilUtc: '2032-01-01T06:00:00.000Z',
      usableUntilUtc,
      weatherSourceUrl: 'https://example.com/weather',
      marineSourceUrl: 'https://example.com/marine',
      weatherResponseSha256: 'a'.repeat(64),
      marineResponseSha256: 'b'.repeat(64),
      points: [{
        validAtUtc: '2032-01-01T03:00:00.000Z',
        precipitationProbability: 10,
        precipitationMm: 0,
        weatherCode: 1,
        windSpeedKmh: 8,
        windDirectionDegrees: 90,
        windGustsKmh: 12,
        waveHeightM: 1,
        waveDirectionDegrees: 120,
        wavePeriodSeconds: 8,
        swellHeightM: 0.8,
        swellDirectionDegrees: 130,
        swellPeriodSeconds: 10,
      }],
    }],
  };
}

describe('parseUsableForecastCache', () => {
  it('accepts a complete cache inside its usable window', () => {
    expect(parseUsableForecastCache(
      cache('2032-01-02T00:00:00.000Z'),
      ['synthetic-beach'],
      new Date('2032-01-01T12:00:00.000Z'),
    )).toHaveLength(1);
  });

  it('rejects an expired cache instead of inventing favorable conditions', () => {
    expect(() => parseUsableForecastCache(
      cache('2032-01-01T11:00:00.000Z'),
      ['synthetic-beach'],
      new Date('2032-01-01T12:00:00.000Z'),
    )).toThrow(/inválido/);
  });
});
