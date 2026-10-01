import type {
  BreakdownItem,
  Confidence,
  OpportunitySource,
  RestrictionStatus,
  ScoreBand,
} from '../../../shared/opportunity-contract';
import type { ForecastPoint } from '../../integrations/open-meteo/open-meteo-client';
import type { TidePredictionInput } from '../tides/chm-tide-table';
import {
  assessOpportunityConfidence,
  calculateOpportunity,
} from '../opportunity-score/opportunity-score';

interface BeachConfiguration {
  id: string;
  name: string;
  municipality: string;
  habitualCirculation: number;
  restrictionStatus: RestrictionStatus;
  restrictionSummary: string;
}

interface StationConfiguration {
  id: string;
  name: string;
  sourceUrl: string;
  sourceRetrievedAtUtc?: string;
}

interface ForecastInput {
  retrievedAtUtc: string;
  freshUntilUtc: string;
  usableUntilUtc: string;
  weatherSourceUrl: string;
  marineSourceUrl: string;
  points: ForecastPoint[];
}

export interface GeneratedOpportunity {
  id: string;
  beachId: string;
  localDate: string;
  recommendedStartUtc: string;
  recommendedEndUtc: string;
  scoreInternal: number;
  scoreBand: ScoreBand;
  scoreVersion: 'score-v0.1';
  confidence: Confidence;
  confidenceReasons: string[];
  summary: string;
  restrictionStatus: RestrictionStatus;
  restrictionSummary: string;
  breakdown: BreakdownItem[];
  sources: OpportunitySource[];
  generatedAtUtc: string;
  staleAt: string;
  expiresAt: string;
  inputs: Record<string, unknown>;
}

interface GenerateOpportunityInput {
  beach: BeachConfiguration;
  station: StationConfiguration;
  localDate: string;
  tides: TidePredictionInput[];
  forecast: ForecastInput;
  generatedAtUtc: string;
}

const ONE_HOUR_MS = 60 * 60 * 1_000;

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function localHourInSaoPaulo(iso: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  return Number(parts.find((part) => part.type === 'hour')?.value);
}

function nearestForecast(points: ForecastPoint[], targetUtc: string): ForecastPoint | undefined {
  const target = Date.parse(targetUtc);
  return [...points].sort((first, second) => (
    Math.abs(Date.parse(first.validAtUtc) - target)
      - Math.abs(Date.parse(second.validAtUtc) - target)
  ))[0];
}

function conditionsScore(point: ForecastPoint): number {
  const wave = clamp((2 - point.waveHeightM) / 1.2);
  const gust = clamp((50 - point.windGustsKmh) / 30);
  const rain = clamp((80 - point.precipitationProbability) / 60);
  return Math.min(wave, gust, rain);
}

export function generateDailyOpportunity(
  input: GenerateOpportunityInput,
): GeneratedOpportunity | null {
  if (input.beach.restrictionStatus === 'not_recommended') return null;

  const daylightTides = input.tides.filter((tide) => {
    const hour = localHourInSaoPaulo(tide.forecastAtUtc);
    return tide.localDate === input.localDate && hour >= 5 && hour <= 19;
  });
  const lowTide = [...daylightTides].sort((first, second) => first.heightM - second.heightM)[0];
  if (!lowTide) return null;

  const condition = nearestForecast(input.forecast.points, lowTide.forecastAtUtc);
  if (!condition) return null;
  const normalizedConditions = conditionsScore(condition);

  const score = calculateOpportunity({
    circulation: {
      normalizedValue: input.beach.habitualCirculation,
      explanation: 'Estimativa inicial de circulação habitual; ainda não confirmada por evento.',
    },
    tide: {
      normalizedValue: 1,
      explanation: `Menor altura diurna da tábua no dia: ${lowTide.heightM.toFixed(2)} m, referida ao NR da estação.`,
      sourceUrl: input.station.sourceUrl,
    },
    recency: {
      normalizedValue: 0,
      explanation: 'Nenhum evento recente verificado foi cadastrado para esta praia.',
    },
    conditions: {
      normalizedValue: normalizedConditions,
      explanation: `Condição regional prevista: ondas de ${condition.waveHeightM.toFixed(1)} m, rajadas de ${condition.windGustsKmh.toFixed(0)} km/h e ${condition.precipitationProbability.toFixed(0)}% de precipitação.`,
      sourceUrl: input.forecast.weatherSourceUrl,
    },
    restrictionStatus: input.beach.restrictionStatus,
  });
  const confidence = assessOpportunityConfidence({
    circulation: 'estimated_current',
    tide: 'direct_current',
    conditions: 'direct_current',
  });
  const tideAt = Date.parse(lowTide.forecastAtUtc);

  return {
    id: `opp-${input.beach.id}-${input.localDate}-${score.scoreVersion}`,
    beachId: input.beach.id,
    localDate: input.localDate,
    recommendedStartUtc: new Date(tideAt - ONE_HOUR_MS).toISOString(),
    recommendedEndUtc: new Date(tideAt + ONE_HOUR_MS).toISOString(),
    scoreInternal: score.scoreInternal,
    scoreBand: score.scoreBand,
    scoreVersion: score.scoreVersion,
    confidence: confidence.level,
    confidenceReasons: confidence.reasons,
    summary: `Baixa-mar oficial de referência combinada com ondas de ${condition.waveHeightM.toFixed(1)} m e vento de ${condition.windSpeedKmh.toFixed(0)} km/h previstos para a região.`,
    restrictionStatus: input.beach.restrictionStatus,
    restrictionSummary: input.beach.restrictionSummary,
    breakdown: score.breakdown,
    sources: [
      {
        label: `CHM — ${input.station.name}`,
        url: input.station.sourceUrl,
        updatedAt: input.station.sourceRetrievedAtUtc ?? input.generatedAtUtc,
        attribution: 'Diretoria de Hidrografia e Navegação / Centro de Hidrografia da Marinha.',
        limitations: 'Previsão harmônica portuária referida ao Nível de Redução; não representa medição nesta praia.',
      },
      {
        label: 'Open-Meteo — ICON/GWAM do DWD',
        url: input.forecast.marineSourceUrl,
        updatedAt: input.forecast.retrievedAtUtc,
        attribution: 'Open-Meteo, com modelos ICON/GWAM do Deutscher Wetterdienst (DWD).',
        limitations: 'Condição regional modelada; não usar para navegação nem interpretar como altura de arrebentação.',
      },
    ],
    generatedAtUtc: input.generatedAtUtc,
    staleAt: input.forecast.freshUntilUtc,
    expiresAt: input.forecast.usableUntilUtc,
    inputs: {
      tide: lowTide,
      forecast: condition,
      habitualCirculation: input.beach.habitualCirculation,
    },
  };
}
