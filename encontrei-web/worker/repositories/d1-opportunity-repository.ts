import type {
  OpportunityDetail,
  OpportunityRepository,
  OpportunitySummary,
} from '../domain/opportunities/opportunity';
import type {
  ConfidenceLevel,
  RestrictionStatus,
  ScoreBand,
} from '../domain/opportunity-score/opportunity-score';
import type {
  BreakdownItem,
  OpportunitySource,
} from '../../shared/opportunity-contract';

interface OpportunityRow {
  id: string;
  beach_id: string;
  beach_name: string;
  municipality: string;
  latitude: number;
  longitude: number;
  recommended_start_utc: string;
  recommended_end_utc: string;
  score_band: ScoreBand;
  confidence: ConfidenceLevel;
  confidence_reasons_json: string;
  summary: string;
  restriction_status: RestrictionStatus;
  tide_station_name: string;
  breakdown_json: string;
  sources_json: string;
  restriction_summary: string;
  stale_at: string | null;
}

const SELECT_PUBLISHED = `
  SELECT
    opportunity_snapshot.id,
    beach.id AS beach_id,
    beach.name AS beach_name,
    beach.municipality,
    beach.latitude,
    beach.longitude,
    opportunity_snapshot.recommended_start_utc,
    opportunity_snapshot.recommended_end_utc,
    opportunity_snapshot.score_band,
    opportunity_snapshot.confidence,
    opportunity_snapshot.confidence_reasons_json,
    opportunity_snapshot.summary,
    opportunity_snapshot.restriction_status,
    tide_station.name AS tide_station_name,
    opportunity_snapshot.breakdown_json,
    opportunity_snapshot.sources_json,
    opportunity_snapshot.restriction_summary,
    opportunity_snapshot.stale_at
  FROM opportunity_snapshot
  INNER JOIN beach ON beach.id = opportunity_snapshot.beach_id
  INNER JOIN tide_station ON tide_station.id = beach.tide_station_id
  WHERE opportunity_snapshot.status = 'published'
    AND opportunity_snapshot.restriction_status <> 'not_recommended'
`;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseJson(value: string, field: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`Snapshot inválido: ${field} não contém JSON válido.`);
  }
}

function parseStringArray(value: string, field: string): string[] {
  const parsed = parseJson(value, field);
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
    throw new Error(`Snapshot inválido: ${field} deve ser uma lista de textos.`);
  }
  return parsed;
}

function validHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function parseOpportunityBreakdown(value: string): BreakdownItem[] {
  const parsed = parseJson(value, 'breakdown_json');
  const factors = new Set(['circulation', 'tide', 'recency', 'conditions']);
  if (!Array.isArray(parsed) || parsed.some((item) => (
    !isObject(item)
    || !factors.has(String(item.factor))
    || typeof item.normalizedValue !== 'number'
    || item.normalizedValue < 0
    || item.normalizedValue > 1
    || typeof item.contribution !== 'number'
    || typeof item.maxContribution !== 'number'
    || item.maxContribution <= 0
    || item.contribution < 0
    || item.contribution > item.maxContribution
    || typeof item.explanation !== 'string'
    || item.explanation.length === 0
    || (item.sourceUrl !== undefined && !validHttpUrl(item.sourceUrl))
  ))) {
    throw new Error('Snapshot inválido: breakdown_json não respeita o contrato do score.');
  }
  return parsed as BreakdownItem[];
}

export function parseOpportunitySources(value: string): OpportunitySource[] {
  const parsed = parseJson(value, 'sources_json');
  if (!Array.isArray(parsed) || parsed.some((item) => (
    !isObject(item)
    || typeof item.label !== 'string'
    || item.label.length === 0
    || !validHttpUrl(item.url)
    || typeof item.updatedAt !== 'string'
    || !Number.isFinite(Date.parse(item.updatedAt))
    || (item.attribution !== undefined && typeof item.attribution !== 'string')
    || (item.limitations !== undefined && typeof item.limitations !== 'string')
  ))) {
    throw new Error('Snapshot inválido: sources_json não respeita o contrato de fontes.');
  }
  return parsed as OpportunitySource[];
}

function toSummary(row: OpportunityRow, now: Date): OpportunitySummary {
  return {
    id: row.id,
    beach: {
      id: row.beach_id,
      name: row.beach_name,
      municipality: row.municipality,
      latitude: row.latitude,
      longitude: row.longitude,
    },
    recommendedStartUtc: row.recommended_start_utc,
    recommendedEndUtc: row.recommended_end_utc,
    scoreBand: row.score_band,
    confidence: row.confidence,
    confidenceReasons: parseStringArray(row.confidence_reasons_json, 'confidence_reasons_json'),
    summary: row.summary,
    restrictionStatus: row.restriction_status,
    stale: row.stale_at !== null && Date.parse(row.stale_at) <= now.getTime(),
    tideStationName: row.tide_station_name,
  };
}

export class D1OpportunityRepository implements OpportunityRepository {
  constructor(
    private readonly database: D1Database,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async listByLocalDate(date: string): Promise<OpportunitySummary[]> {
    const result = await this.database
      .prepare(`${SELECT_PUBLISHED}
        AND opportunity_snapshot.local_date = ?1
        AND opportunity_snapshot.expires_at > ?2
        ORDER BY
          CASE opportunity_snapshot.score_band
            WHEN 'high' THEN 1
            WHEN 'medium' THEN 2
            ELSE 3
          END,
          opportunity_snapshot.recommended_start_utc
      `)
      .bind(date, this.clock().toISOString())
      .all<OpportunityRow>();

    const now = this.clock();
    return result.results.map((row) => toSummary(row, now));
  }

  async findPublishedById(id: string): Promise<OpportunityDetail | null> {
    const row = await this.database
      .prepare(`${SELECT_PUBLISHED}
        AND opportunity_snapshot.id = ?1
        AND opportunity_snapshot.expires_at > ?2
      `)
      .bind(id, this.clock().toISOString())
      .first<OpportunityRow>();

    if (!row) return null;

    return {
      ...toSummary(row, this.clock()),
      breakdown: parseOpportunityBreakdown(row.breakdown_json),
      sources: parseOpportunitySources(row.sources_json),
      restrictionSummary: row.restriction_summary,
    };
  }
}
