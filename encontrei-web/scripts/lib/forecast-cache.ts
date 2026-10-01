import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type {
  BeachForecast,
  ForecastBeach,
  ForecastPoint,
  OpenMeteoClient,
} from '../../worker/integrations/open-meteo/open-meteo-client.ts';

const pointNumbers: Array<keyof Omit<ForecastPoint, 'validAtUtc'>> = [
  'precipitationProbability', 'precipitationMm', 'weatherCode', 'windSpeedKmh',
  'windDirectionDegrees', 'windGustsKmh', 'waveHeightM', 'waveDirectionDegrees',
  'wavePeriodSeconds', 'swellHeightM', 'swellDirectionDegrees', 'swellPeriodSeconds',
];

function isFiniteDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isForecastPoint(value: unknown): value is ForecastPoint {
  if (typeof value !== 'object' || value === null) return false;
  const point = value as Partial<ForecastPoint>;
  return isFiniteDate(point.validAtUtc)
    && pointNumbers.every((key) => typeof point[key] === 'number' && Number.isFinite(point[key]));
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function parseUsableForecastCache(
  value: unknown,
  expectedBeachIds: string[],
  now: Date,
): BeachForecast[] {
  if (typeof value !== 'object' || value === null || !('forecasts' in value)) {
    throw new Error('Cache Open-Meteo ausente ou inválido.');
  }
  const forecasts = (value as { forecasts?: unknown }).forecasts;
  if (!Array.isArray(forecasts) || forecasts.length !== expectedBeachIds.length) {
    throw new Error('Cache Open-Meteo não cobre todas as praias esperadas.');
  }

  const validated = forecasts.map((valueAtBeach) => {
    if (typeof valueAtBeach !== 'object' || valueAtBeach === null) {
      throw new Error('Cache Open-Meteo contém praia inválida.');
    }
    const forecast = valueAtBeach as Partial<BeachForecast>;
    const coordinates = [
      forecast.requestedLatitude, forecast.requestedLongitude,
      forecast.weatherGridLatitude, forecast.weatherGridLongitude,
      forecast.marineGridLatitude, forecast.marineGridLongitude,
    ];
    if (
      typeof forecast.beachId !== 'string'
      || !isFiniteDate(forecast.retrievedAtUtc)
      || !isFiniteDate(forecast.freshUntilUtc)
      || !isFiniteDate(forecast.usableUntilUtc)
      || Date.parse(forecast.usableUntilUtc) <= now.getTime()
      || !isHttpUrl(forecast.weatherSourceUrl)
      || !isHttpUrl(forecast.marineSourceUrl)
      || !/^[a-f0-9]{64}$/.test(forecast.weatherResponseSha256 ?? '')
      || !/^[a-f0-9]{64}$/.test(forecast.marineResponseSha256 ?? '')
      || coordinates.some((coordinate) => typeof coordinate !== 'number' || !Number.isFinite(coordinate))
      || !Array.isArray(forecast.points)
      || forecast.points.length === 0
      || forecast.points.some((point) => !isForecastPoint(point))
    ) {
      throw new Error(`Cache Open-Meteo inválido para ${forecast.beachId ?? 'praia desconhecida'}.`);
    }
    return forecast as BeachForecast;
  });

  const actualIds = validated.map((forecast) => forecast.beachId).sort();
  if (actualIds.join('|') !== [...expectedBeachIds].sort().join('|')) {
    throw new Error('Cache Open-Meteo contém praias diferentes das esperadas.');
  }
  return validated;
}

export async function fetchForecastsWithLocalCache(
  client: OpenMeteoClient,
  beaches: ForecastBeach[],
  cachePath: string,
  now: Date,
): Promise<BeachForecast[]> {
  let forecasts: BeachForecast[];
  try {
    forecasts = await client.fetch72Hours(beaches);
  } catch (fetchError) {
    try {
      const cached = JSON.parse(await readFile(cachePath, 'utf8')) as unknown;
      return parseUsableForecastCache(cached, beaches.map((beach) => beach.id), now);
    } catch (cacheError) {
      const fetchReason = fetchError instanceof Error ? fetchError.message : String(fetchError);
      const cacheReason = cacheError instanceof Error ? cacheError.message : String(cacheError);
      throw new Error(`Open-Meteo indisponível (${fetchReason}) e cache inutilizável (${cacheReason}).`);
    }
  }

  try {
    await mkdir(dirname(cachePath), { recursive: true });
    await writeFile(cachePath, JSON.stringify({ forecasts }), 'utf8');
  } catch (cacheWriteError) {
    const reason = cacheWriteError instanceof Error ? cacheWriteError.message : String(cacheWriteError);
    console.warn(`Previsão atual obtida, mas o cache local não pôde ser atualizado: ${reason}`);
  }
  return forecasts;
}
