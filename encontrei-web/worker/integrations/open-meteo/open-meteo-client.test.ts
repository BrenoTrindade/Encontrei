import { describe, expect, it, vi } from 'vitest';
import { OpenMeteoClient } from './open-meteo-client';

const beaches = [
  { id: 'camburi', latitude: -20.2839, longitude: -40.2896 },
  { id: 'itaparica', latitude: -20.3704, longitude: -40.3004 },
];

function responseFor(kind: 'weather' | 'marine') {
  return beaches.map((beach, index) => ({
    latitude: beach.latitude + 0.01,
    longitude: beach.longitude + 0.01,
    utc_offset_seconds: -10_800,
    timezone: 'America/Sao_Paulo',
    hourly: kind === 'weather'
      ? {
          time: ['2026-09-30T09:00', '2026-09-30T10:00'],
          precipitation_probability: [10 + index, 20 + index],
          precipitation: [0, 0.2],
          weather_code: [1, 2],
          wind_speed_10m: [8, 10],
          wind_direction_10m: [90, 100],
          wind_gusts_10m: [15, 18],
        }
      : {
          time: ['2026-09-30T09:00', '2026-09-30T10:00'],
          wave_height: [1.1 + index, 1.2 + index],
          wave_direction: [120, 125],
          wave_period: [8, 9],
          swell_wave_height: [0.8, 0.9],
          swell_wave_direction: [130, 135],
          swell_wave_period: [10, 11],
        },
  }));
}

describe('OpenMeteoClient', () => {
  it('fetches grouped weather and marine data and returns auditable UTC snapshots', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return Response.json(responseFor(url.includes('marine-api') ? 'marine' : 'weather'));
    });
    const client = new OpenMeteoClient(fetcher, () => new Date('2026-09-30T12:00:00.000Z'));

    const result = await client.fetch72Hours(beaches);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('models=icon_global');
    expect(String(fetcher.mock.calls[1]?.[0])).toContain('models=dwd_gwam');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      beachId: 'camburi',
      requestedLatitude: -20.2839,
      retrievedAtUtc: '2026-09-30T12:00:00.000Z',
      freshUntilUtc: '2026-09-30T18:00:00.000Z',
      usableUntilUtc: '2026-10-01T12:00:00.000Z',
    });
    expect(result[0]?.weatherGridLatitude).toBeCloseTo(-20.2739);
    expect(result[0]?.marineGridLatitude).toBeCloseTo(-20.2739);
    expect(result[0]?.points[0]).toEqual({
      validAtUtc: '2026-09-30T12:00:00.000Z',
      precipitationProbability: 10,
      precipitationMm: 0,
      weatherCode: 1,
      windSpeedKmh: 8,
      windDirectionDegrees: 90,
      windGustsKmh: 15,
      waveHeightM: 1.1,
      waveDirectionDegrees: 120,
      wavePeriodSeconds: 8,
      swellHeightM: 0.8,
      swellDirectionDegrees: 130,
      swellPeriodSeconds: 10,
    });
  });

  it('rejects partial responses instead of publishing misleading zero values', async () => {
    const weather = responseFor('weather');
    const marine = responseFor('marine');
    if (marine[0]?.hourly && 'wave_height' in marine[0].hourly) {
      marine[0].hourly.wave_height[0] = null as unknown as number;
    }
    const fetcher = vi.fn(async (input: RequestInfo | URL) => (
      Response.json(String(input).includes('marine-api') ? marine : weather)
    ));

    await expect(new OpenMeteoClient(fetcher).fetch72Hours(beaches))
      .rejects.toThrow(/wave_height/);
  });
});
