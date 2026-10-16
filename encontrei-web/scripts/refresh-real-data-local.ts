import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { parseChmPdf } from './lib/chm-pdf.ts';
import { OpenMeteoClient } from '../worker/integrations/open-meteo/open-meteo-client.ts';
import { fetchForecastsWithLocalCache } from './lib/forecast-cache.ts';
import { generateDailyOpportunity } from '../worker/domain/opportunities/generate-opportunity.ts';
import type { TidePredictionInput } from '../worker/domain/tides/chm-tide-table.ts';

const CHM_TERMS_URL = 'https://www.marinha.mil.br/chm/dados-do-segnav-termo-de-uso/termo-publico-de-cessao-de-direito-de-uso';
const OPEN_METEO_TERMS_URL = 'https://open-meteo.com/en/terms';
const RETRIEVED_AT = new Date();

const stations = [
  {
    id: 'porto-tubarao',
    name: 'Porto de Tubarão',
    latitude: -20.29,
    longitude: -40.24,
    pageUrl: 'https://www.marinha.mil.br/chm/dados-do-segnav-dados-de-mare-mapa/34-porto-de-tubarao-112-114',
    pdfUrl: 'https://www.marinha.mil.br/chm/sites/www.marinha.mil.br.chm/files/dados_de_mare/34%20-%20PORTO%20DE%20TUBAR%C3%83O%20-%20112%20-%20114.pdf',
  },
  {
    id: 'porto-vitoria',
    name: 'Porto de Vitória',
    latitude: -20.32,
    longitude: -40.34,
    pageUrl: 'https://www.marinha.mil.br/chm/dados-do-segnav-dados-de-mare-mapa/35-porto-de-vitoria-115-117',
    pdfUrl: 'https://www.marinha.mil.br/chm/sites/www.marinha.mil.br.chm/files/dados_de_mare/35%20-%20PORTO%20DE%20VIT%C3%93RIA%20-%20115%20-%20117.pdf',
  },
] as const;

const beaches = [
  {
    id: 'camburi', slug: 'praia-de-camburi', name: 'Praia de Camburi', municipality: 'Vitória',
    latitude: -20.2839, longitude: -40.2896, stationId: 'porto-tubarao', habitualCirculation: null,
  },
  {
    id: 'praia-da-costa', slug: 'praia-da-costa', name: 'Praia da Costa', municipality: 'Vila Velha',
    latitude: -20.3369, longitude: -40.2825, stationId: 'porto-vitoria', habitualCirculation: null,
  },
  {
    id: 'itaparica', slug: 'praia-de-itaparica', name: 'Praia de Itaparica', municipality: 'Vila Velha',
    latitude: -20.3704, longitude: -40.3004, stationId: 'porto-vitoria', habitualCirculation: null,
  },
] as const;

function quoted(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function json(value: unknown): string {
  return quoted(JSON.stringify(value));
}

function localDates(now: Date): string[] {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const base = Date.UTC(value('year'), value('month') - 1, value('day'));
  return [0, 1, 2].map((offset) => new Date(base + offset * 86_400_000).toISOString().slice(0, 10));
}

function localTimestamp(utc: string): string {
  return new Date(Date.parse(utc) - 3 * 60 * 60 * 1_000).toISOString().slice(0, 16);
}

function classifyExtrema(predictions: TidePredictionInput[]): Array<TidePredictionInput & { kind: 'high' | 'low' }> {
  return predictions.map((prediction, index) => {
    const previous = predictions[index - 1];
    const next = predictions[index + 1];
    const lowerThanPrevious = !previous || prediction.heightM < previous.heightM;
    const lowerThanNext = !next || prediction.heightM < next.heightM;
    const higherThanPrevious = !previous || prediction.heightM > previous.heightM;
    const higherThanNext = !next || prediction.heightM > next.heightM;
    if (lowerThanPrevious && lowerThanNext) return { ...prediction, kind: 'low' as const };
    if (higherThanPrevious && higherThanNext) return { ...prediction, kind: 'high' as const };
    throw new Error(`Sequência de extremos ambígua em ${prediction.forecastAtUtc}.`);
  });
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const userAgent = 'Encontrei-Pilot/0.1 (local data import)';
  try {
    const response = await fetch(url, { headers: { 'User-Agent': userAgent } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    // O servidor do CHM atualmente envia um cabeçalho CSP fora do padrão HTTP.
    // curl é mais tolerante, mas a assinatura SHA-256 continua sendo verificada e registrada.
    const result = spawnSync('curl.exe', [
      '--fail', '--silent', '--show-error', '--location', '--user-agent', userAgent, url,
    ], { encoding: null, maxBuffer: 20 * 1024 * 1024 });
    if (result.status === 0 && result.stdout.length > 0) return new Uint8Array(result.stdout);
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Falha ao obter ${url}: ${reason}. ${result.stderr.toString('utf8').trim()}`);
  }
}

function runWrangler(args: string[]): void {
  const wranglerEntry = join(process.cwd(), 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  const result = spawnSync(process.execPath, [wranglerEntry, ...args], {
    cwd: process.cwd(), encoding: 'utf8', maxBuffer: 100 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const diagnostic = `${result.stderr}\n${result.stdout}`.trim().slice(-4_000);
    throw new Error(`Wrangler falhou com código ${result.status}: ${result.error?.message ?? diagnostic}.`);
  }
}

async function main(): Promise<void> {
  if (!process.argv.includes('--allow-local-chm')) {
    throw new Error('Importação CHM bloqueada. Use --allow-local-chm somente em ambiente local.');
  }

  const tideTables = new Map<string, Awaited<ReturnType<typeof parseChmPdf>>>();
  for (const station of stations) {
    const bytes = await fetchBytes(station.pdfUrl);
    tideTables.set(station.id, await parseChmPdf(bytes, 2026));
  }

  const forecastBeaches = beaches.map((beach) => ({
    id: beach.id, latitude: beach.latitude, longitude: beach.longitude,
  }));
  const forecasts = await fetchForecastsWithLocalCache(
    new OpenMeteoClient(),
    forecastBeaches,
    join(process.cwd(), '.wrangler', 'cache', 'open-meteo-forecast.json'),
    RETRIEVED_AT,
  );
  const forecastByBeach = new Map(forecasts.map((forecast) => [forecast.beachId, forecast]));
  const dates = localDates(RETRIEVED_AT);
  const opportunities = beaches.flatMap((beach) => {
    const station = stations.find((candidate) => candidate.id === beach.stationId);
    const table = tideTables.get(beach.stationId);
    const forecast = forecastByBeach.get(beach.id);
    if (!station || !table || !forecast) throw new Error(`Configuração incompleta para ${beach.id}.`);
    return dates.flatMap((localDate) => {
      const opportunity = generateDailyOpportunity({
        beach: {
          ...beach,
          restrictionStatus: 'needs_verification',
          restrictionSummary: 'Situação inconclusiva — verifique sinalização, regras e condições no local antes da busca.',
        },
        station: {
          id: station.id,
          name: station.name,
          sourceUrl: station.pageUrl,
          sourceRetrievedAtUtc: RETRIEVED_AT.toISOString(),
        },
        localDate,
        tides: table.predictions,
        forecast,
        generatedAtUtc: RETRIEVED_AT.toISOString(),
      });
      return opportunity ? [opportunity] : [];
    });
  });

  const statements: string[] = ['PRAGMA foreign_keys = ON;', 'BEGIN TRANSACTION;'];
  for (const station of stations) {
    statements.push(`INSERT INTO tide_station (id, name, latitude, longitude, source_url, source_retrieved_at)
      VALUES (${quoted(station.id)}, ${quoted(station.name)}, ${station.latitude}, ${station.longitude}, ${quoted(station.pageUrl)}, ${quoted(RETRIEVED_AT.toISOString())})
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, latitude=excluded.latitude, longitude=excluded.longitude,
        source_url=excluded.source_url, source_retrieved_at=excluded.source_retrieved_at;`);
  }
  for (const beach of beaches) {
    statements.push(`INSERT INTO beach (id, slug, name, municipality, latitude, longitude, tide_station_id, active, created_at, updated_at)
      VALUES (${quoted(beach.id)}, ${quoted(beach.slug)}, ${quoted(beach.name)}, ${quoted(beach.municipality)}, ${beach.latitude}, ${beach.longitude}, ${quoted(beach.stationId)}, 1, ${quoted(RETRIEVED_AT.toISOString())}, ${quoted(RETRIEVED_AT.toISOString())})
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, municipality=excluded.municipality,
        latitude=excluded.latitude, longitude=excluded.longitude, tide_station_id=excluded.tide_station_id,
        active=1, updated_at=excluded.updated_at;`);
  }

  for (const station of stations) {
    const table = tideTables.get(station.id);
    if (!table) continue;
    const batchId = `chm-${station.id}-2026-${table.checksumSha256.slice(0, 12)}`;
    statements.push(`INSERT INTO source_batch (
      id, source_type, provider, source_url, terms_url, retrieved_at_utc, period_start_utc,
      period_end_utc, sha256, parser_version, request_parameters_json, source_timezone,
      vertical_datum, model, license_status, quality_status, quality_notes
    ) VALUES (
      ${quoted(batchId)}, 'chm_tide_table', 'CHM/DHN', ${quoted(station.pageUrl)}, ${quoted(CHM_TERMS_URL)},
      ${quoted(RETRIEVED_AT.toISOString())}, ${quoted(table.predictions[0]?.forecastAtUtc ?? '')},
      ${quoted(table.predictions.at(-1)?.forecastAtUtc ?? '')}, ${quoted(table.checksumSha256)},
      'chm-pdf-position-v0.1', ${json({ year: 2026, stationId: station.id })},
      'America/Sao_Paulo', 'CHM_NR', NULL, 'local_only_pending', 'accepted',
      'Importação local para validação; publicação bloqueada até esclarecimento escrito do CHM.'
    ) ON CONFLICT(provider, sha256) DO UPDATE SET retrieved_at_utc=excluded.retrieved_at_utc;`);

    for (const tide of classifyExtrema(table.predictions)) {
      statements.push(`INSERT INTO tide_prediction (
        station_id, predicted_at_utc, predicted_at_local, local_date, timezone, utc_offset_seconds,
        height_meters, vertical_datum, extremum_kind, kind_derivation, source_batch_id, quality_status
      ) VALUES (
        ${quoted(station.id)}, ${quoted(tide.forecastAtUtc)}, ${quoted(localTimestamp(tide.forecastAtUtc))},
        ${quoted(tide.localDate)}, 'America/Sao_Paulo', -10800, ${tide.heightM}, 'CHM_NR',
        ${quoted(tide.kind)}, 'ordered_local_extrema_v0.1', ${quoted(batchId)}, 'accepted'
      ) ON CONFLICT(station_id, predicted_at_utc, source_batch_id) DO UPDATE SET
        height_meters=excluded.height_meters, extremum_kind=excluded.extremum_kind,
        kind_derivation=excluded.kind_derivation, quality_status=excluded.quality_status;`);
    }
  }

  const firstForecast = forecasts[0];
  if (!firstForecast) throw new Error('Open-Meteo não retornou previsões.');
  const weatherBatchId = `open-meteo-weather-${firstForecast.weatherResponseSha256.slice(0, 12)}`;
  const marineBatchId = `open-meteo-marine-${firstForecast.marineResponseSha256.slice(0, 12)}`;
  const allPoints = forecasts.flatMap((forecast) => forecast.points);
  const periodStart = allPoints.map((point) => point.validAtUtc).sort()[0] ?? '';
  const periodEnd = allPoints.map((point) => point.validAtUtc).sort().at(-1) ?? '';
  statements.push(`INSERT INTO source_batch (
    id, source_type, provider, source_url, terms_url, retrieved_at_utc, period_start_utc,
    period_end_utc, sha256, parser_version, request_parameters_json, source_timezone,
    vertical_datum, model, license_status, quality_status, quality_notes
  ) VALUES
    (${quoted(weatherBatchId)}, 'open_meteo_weather', 'Open-Meteo/DWD', ${quoted(firstForecast.weatherSourceUrl)},
      ${quoted(OPEN_METEO_TERMS_URL)}, ${quoted(firstForecast.retrievedAtUtc)}, ${quoted(periodStart)}, ${quoted(periodEnd)},
      ${quoted(firstForecast.weatherResponseSha256)}, NULL, ${json({ forecastHours: 72, beaches: beaches.map((beach) => beach.id) })},
      'America/Sao_Paulo', NULL, 'icon_global', 'non_commercial', 'accepted', 'Resposta agrupada validada.'),
    (${quoted(marineBatchId)}, 'open_meteo_marine', 'Open-Meteo/DWD', ${quoted(firstForecast.marineSourceUrl)},
      ${quoted(OPEN_METEO_TERMS_URL)}, ${quoted(firstForecast.retrievedAtUtc)}, ${quoted(periodStart)}, ${quoted(periodEnd)},
      ${quoted(firstForecast.marineResponseSha256)}, NULL, ${json({ forecastHours: 72, beaches: beaches.map((beach) => beach.id) })},
      'America/Sao_Paulo', NULL, 'dwd_gwam', 'non_commercial', 'accepted', 'Resposta agrupada validada.')
    ON CONFLICT(provider, sha256) DO UPDATE SET retrieved_at_utc=excluded.retrieved_at_utc;`);

  for (const forecast of forecasts) {
    for (const point of forecast.points) {
      const id = `forecast-${forecast.beachId}-${point.validAtUtc}-${firstForecast.weatherResponseSha256.slice(0, 8)}`;
      statements.push(`INSERT INTO forecast_snapshot (
        id, weather_source_batch_id, marine_source_batch_id, beach_id, valid_at_utc,
        requested_latitude, requested_longitude, weather_grid_latitude, weather_grid_longitude,
        marine_grid_latitude, marine_grid_longitude, retrieved_at_utc, fresh_until_utc,
        usable_until_utc, precipitation_probability, precipitation_mm, weather_code,
        wind_speed_kmh, wind_direction_degrees, wind_gusts_kmh, wave_height_m,
        wave_direction_degrees, wave_period_seconds, swell_height_m, swell_direction_degrees,
        swell_period_seconds
      ) VALUES (
        ${quoted(id)}, ${quoted(weatherBatchId)}, ${quoted(marineBatchId)}, ${quoted(forecast.beachId)},
        ${quoted(point.validAtUtc)}, ${forecast.requestedLatitude}, ${forecast.requestedLongitude},
        ${forecast.weatherGridLatitude}, ${forecast.weatherGridLongitude}, ${forecast.marineGridLatitude},
        ${forecast.marineGridLongitude}, ${quoted(forecast.retrievedAtUtc)}, ${quoted(forecast.freshUntilUtc)},
        ${quoted(forecast.usableUntilUtc)}, ${point.precipitationProbability}, ${point.precipitationMm},
        ${point.weatherCode}, ${point.windSpeedKmh}, ${point.windDirectionDegrees}, ${point.windGustsKmh},
        ${point.waveHeightM}, ${point.waveDirectionDegrees}, ${point.wavePeriodSeconds}, ${point.swellHeightM},
        ${point.swellDirectionDegrees}, ${point.swellPeriodSeconds}
      ) ON CONFLICT(weather_source_batch_id, marine_source_batch_id, beach_id, valid_at_utc) DO NOTHING;`);
    }
  }

  for (const opportunity of opportunities) {
    statements.push(`UPDATE opportunity_snapshot
      SET status = 'hidden'
      WHERE beach_id = ${quoted(opportunity.beachId)}
        AND local_date = ${quoted(opportunity.localDate)}
        AND id <> ${quoted(opportunity.id)}
        AND status = 'published';`);
    statements.push(`INSERT INTO opportunity_snapshot (
      id, beach_id, local_date, recommended_start_utc, recommended_end_utc, score_internal,
      score_band, score_version, confidence, confidence_reasons_json, summary, restriction_status,
      restriction_summary, breakdown_json, sources_json, generated_at, published_at, stale_at,
      expires_at, inputs_json, status
    ) VALUES (
      ${quoted(opportunity.id)}, ${quoted(opportunity.beachId)}, ${quoted(opportunity.localDate)},
      ${quoted(opportunity.recommendedStartUtc)}, ${quoted(opportunity.recommendedEndUtc)},
      ${opportunity.scoreInternal}, ${quoted(opportunity.scoreBand)}, ${quoted(opportunity.scoreVersion)},
      ${quoted(opportunity.confidence)}, ${json(opportunity.confidenceReasons)}, ${quoted(opportunity.summary)},
      ${quoted(opportunity.restrictionStatus)}, ${quoted(opportunity.restrictionSummary)},
      ${json(opportunity.breakdown)}, ${json(opportunity.sources)}, ${quoted(opportunity.generatedAtUtc)},
      ${quoted(opportunity.generatedAtUtc)}, ${quoted(opportunity.staleAt)}, ${quoted(opportunity.expiresAt)},
      ${json(opportunity.inputs)}, 'published'
    ) ON CONFLICT(id) DO NOTHING;`);
  }
  statements.push('COMMIT;');

  const tempDirectory = join(process.cwd(), '.wrangler', 'tmp');
  await mkdir(tempDirectory, { recursive: true });
  const sqlPath = join(tempDirectory, 'refresh-real-data-local.sql');
  await writeFile(sqlPath, statements.join('\n'), 'utf8');

  runWrangler(['d1', 'migrations', 'apply', 'encontrei-pilot', '--local']);
  runWrangler(['d1', 'execute', 'encontrei-pilot', '--local', `--file=${sqlPath}`]);
  console.log(`Importação local concluída: ${opportunities.length} oportunidades reais geradas.`);
  console.log('ATENÇÃO: dados CHM permanecem restritos ao ambiente local enquanto a licença é esclarecida.');
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
