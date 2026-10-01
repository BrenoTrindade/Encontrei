export interface ForecastBeach {
  id: string;
  latitude: number;
  longitude: number;
}

export interface ForecastPoint {
  validAtUtc: string;
  precipitationProbability: number;
  precipitationMm: number;
  weatherCode: number;
  windSpeedKmh: number;
  windDirectionDegrees: number;
  windGustsKmh: number;
  waveHeightM: number;
  waveDirectionDegrees: number;
  wavePeriodSeconds: number;
  swellHeightM: number;
  swellDirectionDegrees: number;
  swellPeriodSeconds: number;
}

export interface BeachForecast {
  beachId: string;
  requestedLatitude: number;
  requestedLongitude: number;
  weatherGridLatitude: number;
  weatherGridLongitude: number;
  marineGridLatitude: number;
  marineGridLongitude: number;
  retrievedAtUtc: string;
  freshUntilUtc: string;
  usableUntilUtc: string;
  weatherSourceUrl: string;
  marineSourceUrl: string;
  weatherResponseSha256: string;
  marineResponseSha256: string;
  points: ForecastPoint[];
}

interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  utc_offset_seconds: number;
  timezone: string;
  hourly: Record<string, unknown>;
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const WEATHER_VARIABLES = [
  'precipitation_probability',
  'precipitation',
  'weather_code',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
];

const MARINE_VARIABLES = [
  'wave_height',
  'wave_direction',
  'wave_period',
  'swell_wave_height',
  'swell_wave_direction',
  'swell_wave_period',
];

function addHours(date: Date, hours: number): string {
  return new Date(date.getTime() + hours * 60 * 60 * 1_000).toISOString();
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function buildUrl(base: string, beaches: ForecastBeach[], variables: string[], model: string): string {
  const url = new URL(base);
  url.searchParams.set('latitude', beaches.map((beach) => beach.latitude).join(','));
  url.searchParams.set('longitude', beaches.map((beach) => beach.longitude).join(','));
  url.searchParams.set('hourly', variables.join(','));
  url.searchParams.set('forecast_hours', '72');
  url.searchParams.set('timezone', 'America/Sao_Paulo');
  url.searchParams.set('models', model);
  return url.toString();
}

function asResponses(value: unknown, expectedCount: number): OpenMeteoResponse[] {
  const responses = Array.isArray(value) ? value : [value];
  if (responses.length !== expectedCount) {
    throw new Error(
      `Open-Meteo retornou ${responses.length} localidades; eram esperadas ${expectedCount}.`,
    );
  }

  return responses.map((response) => {
    if (typeof response !== 'object' || response === null) {
      throw new Error('Open-Meteo retornou uma localidade inválida.');
    }
    const candidate = response as Partial<OpenMeteoResponse>;
    if (
      !Number.isFinite(candidate.latitude)
      || !Number.isFinite(candidate.longitude)
      || !Number.isInteger(candidate.utc_offset_seconds)
      || candidate.timezone !== 'America/Sao_Paulo'
      || typeof candidate.hourly !== 'object'
      || candidate.hourly === null
    ) {
      throw new Error('Open-Meteo retornou metadados inválidos.');
    }
    return candidate as OpenMeteoResponse;
  });
}

function stringArray(hourly: Record<string, unknown>, name: string): string[] {
  const value = hourly[name];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Open-Meteo não retornou a série ${name}.`);
  }
  return value as string[];
}

function numberArray(
  hourly: Record<string, unknown>,
  name: string,
  expectedLength: number,
): number[] {
  const value = hourly[name];
  if (
    !Array.isArray(value)
    || value.length !== expectedLength
    || value.some((item) => typeof item !== 'number' || !Number.isFinite(item))
  ) {
    throw new Error(`Open-Meteo retornou a série ${name} incompleta ou inválida.`);
  }
  return value as number[];
}

function localTimestampToUtc(localTimestamp: string, utcOffsetSeconds: number): string {
  const localAsUtc = Date.parse(`${localTimestamp}:00Z`);
  if (!Number.isFinite(localAsUtc)) {
    throw new Error(`Open-Meteo retornou horário inválido: ${localTimestamp}.`);
  }
  return new Date(localAsUtc - utcOffsetSeconds * 1_000).toISOString();
}

export class OpenMeteoClient {
  constructor(
    private readonly fetcher: Fetcher = fetch,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async fetch72Hours(beaches: ForecastBeach[]): Promise<BeachForecast[]> {
    if (beaches.length === 0) return [];

    const weatherUrl = buildUrl(
      'https://api.open-meteo.com/v1/dwd-icon',
      beaches,
      WEATHER_VARIABLES,
      'icon_global',
    );
    const marineUrl = buildUrl(
      'https://marine-api.open-meteo.com/v1/marine',
      beaches,
      MARINE_VARIABLES,
      'dwd_gwam',
    );
    const [weatherHttp, marineHttp] = await Promise.all([
      this.fetcher(weatherUrl, { headers: { Accept: 'application/json' } }),
      this.fetcher(marineUrl, { headers: { Accept: 'application/json' } }),
    ]);

    if (!weatherHttp.ok || !marineHttp.ok) {
      throw new Error(
        `Falha no Open-Meteo (weather ${weatherHttp.status}, marine ${marineHttp.status}).`,
      );
    }

    const [weatherText, marineText] = await Promise.all([weatherHttp.text(), marineHttp.text()]);
    let weatherValue: unknown;
    let marineValue: unknown;
    try {
      weatherValue = JSON.parse(weatherText);
      marineValue = JSON.parse(marineText);
    } catch {
      throw new Error('Open-Meteo retornou JSON inválido.');
    }
    const [weatherResponses, marineResponses, weatherResponseSha256, marineResponseSha256] = await Promise.all([
      Promise.resolve(asResponses(weatherValue, beaches.length)),
      Promise.resolve(asResponses(marineValue, beaches.length)),
      sha256(weatherText),
      sha256(marineText),
    ]);
    const retrievedAt = this.clock();

    return beaches.map((beach, index) => {
      const weather = weatherResponses[index];
      const marine = marineResponses[index];
      if (!weather || !marine) throw new Error(`Resposta ausente para ${beach.id}.`);
      const times = stringArray(weather.hourly, 'time');
      const marineTimes = stringArray(marine.hourly, 'time');
      if (times.length === 0 || times.length !== marineTimes.length
        || times.some((time, timeIndex) => time !== marineTimes[timeIndex])) {
        throw new Error(`Séries meteorológica e marinha desalinhadas para ${beach.id}.`);
      }

      const weatherSeries = Object.fromEntries(WEATHER_VARIABLES.map((name) => [
        name,
        numberArray(weather.hourly, name, times.length),
      ]));
      const marineSeries = Object.fromEntries(MARINE_VARIABLES.map((name) => [
        name,
        numberArray(marine.hourly, name, times.length),
      ]));

      return {
        beachId: beach.id,
        requestedLatitude: beach.latitude,
        requestedLongitude: beach.longitude,
        weatherGridLatitude: weather.latitude,
        weatherGridLongitude: weather.longitude,
        marineGridLatitude: marine.latitude,
        marineGridLongitude: marine.longitude,
        retrievedAtUtc: retrievedAt.toISOString(),
        freshUntilUtc: addHours(retrievedAt, 6),
        usableUntilUtc: addHours(retrievedAt, 24),
        weatherSourceUrl: weatherUrl,
        marineSourceUrl: marineUrl,
        weatherResponseSha256,
        marineResponseSha256,
        points: times.map((time, timeIndex) => ({
          validAtUtc: localTimestampToUtc(time, weather.utc_offset_seconds),
          precipitationProbability: weatherSeries.precipitation_probability?.[timeIndex] ?? 0,
          precipitationMm: weatherSeries.precipitation?.[timeIndex] ?? 0,
          weatherCode: weatherSeries.weather_code?.[timeIndex] ?? 0,
          windSpeedKmh: weatherSeries.wind_speed_10m?.[timeIndex] ?? 0,
          windDirectionDegrees: weatherSeries.wind_direction_10m?.[timeIndex] ?? 0,
          windGustsKmh: weatherSeries.wind_gusts_10m?.[timeIndex] ?? 0,
          waveHeightM: marineSeries.wave_height?.[timeIndex] ?? 0,
          waveDirectionDegrees: marineSeries.wave_direction?.[timeIndex] ?? 0,
          wavePeriodSeconds: marineSeries.wave_period?.[timeIndex] ?? 0,
          swellHeightM: marineSeries.swell_wave_height?.[timeIndex] ?? 0,
          swellDirectionDegrees: marineSeries.swell_wave_direction?.[timeIndex] ?? 0,
          swellPeriodSeconds: marineSeries.swell_wave_period?.[timeIndex] ?? 0,
        })),
      };
    });
  }
}
