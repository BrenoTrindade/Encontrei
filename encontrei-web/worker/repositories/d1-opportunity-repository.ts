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
  SavedOpportunitySummary,
} from '../../shared/opportunity-contract';
import { distanceInKm } from '../../shared/geography';
import { degradeConfidenceWhenStale } from '../domain/opportunity-score/opportunity-score';

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
  tide_station_latitude: number;
  tide_station_longitude: number;
  breakdown_json: string;
  sources_json: string;
  restriction_summary: string;
  stale_at: string | null;
  expires_at: string;
  status: string;
}

const SELECT_SNAPSHOT = `
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
    tide_station.latitude AS tide_station_latitude,
    tide_station.longitude AS tide_station_longitude,
    opportunity_snapshot.breakdown_json,
    opportunity_snapshot.sources_json,
    opportunity_snapshot.restriction_summary,
    opportunity_snapshot.stale_at,
    opportunity_snapshot.expires_at,
    opportunity_snapshot.status
  FROM opportunity_snapshot
  INNER JOIN beach ON beach.id = opportunity_snapshot.beach_id
  INNER JOIN tide_station ON tide_station.id = beach.tide_station_id
`;

const SELECT_PUBLISHED = `${SELECT_SNAPSHOT}
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

function isHistorical(row: OpportunityRow, now: Date): boolean {
  return row.status !== 'published'
    || row.restriction_status === 'not_recommended'
    || Date.parse(row.expires_at) <= now.getTime();
}

function toSummary(row: OpportunityRow, now: Date, historical = false): OpportunitySummary {
  const stale = row.stale_at !== null && Date.parse(row.stale_at) <= now.getTime();
  const originalReasons = parseStringArray(row.confidence_reasons_json, 'confidence_reasons_json');
  const confidence = historical ? { level: row.confidence, reasons: originalReasons } : degradeConfidenceWhenStale(
    row.confidence,
    originalReasons,
    stale,
  );
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
    confidence: confidence.level,
    confidenceReasons: confidence.reasons,
    summary: row.summary,
    restrictionStatus: row.restriction_status,
    stale,
    expiresAt: row.expires_at,
    tideStationName: row.tide_station_name,
    tideStationDistanceKm: distanceInKm(
      { latitude: row.latitude, longitude: row.longitude },
      { latitude: row.tide_station_latitude, longitude: row.tide_station_longitude },
    ),
  };
}

function toDetail(row: OpportunityRow, now: Date, historical = false): OpportunityDetail {
  return {
    ...toSummary(row, now, historical),
    historical,
    breakdown: parseOpportunityBreakdown(row.breakdown_json),
    sources: parseOpportunitySources(row.sources_json),
    restrictionSummary: row.restriction_summary,
  };
}

export class D1OpportunityRepository implements OpportunityRepository {
  constructor(
    private readonly database: D1Database,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async listSaved(invitationId: string): Promise<SavedOpportunitySummary[]> {
    const rows = await this.database.prepare(`${SELECT_SNAPSHOT}
      WHERE EXISTS (
        SELECT 1 FROM saved_opportunity s
        WHERE s.opportunity_id = opportunity_snapshot.id AND s.invitation_id = ?1
      ) OR EXISTS (
        SELECT 1 FROM feedback f
        WHERE f.opportunity_id = opportunity_snapshot.id AND f.invitation_id = ?1
      )
      ORDER BY opportunity_snapshot.recommended_start_utc DESC, opportunity_snapshot.id DESC
    `).bind(invitationId).all<OpportunityRow>();
    const now = this.clock();
    const engagements = await this.database.prepare(`
      SELECT opportunity_id, 1 AS saved, intent_to_go, 0 AS feedback_submitted
      FROM saved_opportunity WHERE invitation_id = ?1
      UNION ALL
      SELECT opportunity_id, 0 AS saved, NULL AS intent_to_go, 1 AS feedback_submitted
      FROM feedback WHERE invitation_id = ?1
    `).bind(invitationId).all<{
      opportunity_id: string; saved: number; intent_to_go: number | null; feedback_submitted: number;
    }>();
    const byOpportunity = new Map<string, { saved: boolean; intentToGo: boolean | null; feedbackSubmitted: boolean }>();
    for (const row of engagements.results) {
      const state = byOpportunity.get(row.opportunity_id)
        ?? { saved: false, intentToGo: null, feedbackSubmitted: false };
      if (row.saved === 1) { state.saved = true; state.intentToGo = row.intent_to_go === 1; }
      if (row.feedback_submitted === 1) state.feedbackSubmitted = true;
      byOpportunity.set(row.opportunity_id, state);
    }
    return rows.results.map((row) => {
      const historical = isHistorical(row, now);
      return {
        ...toSummary(row, now, historical),
        historical,
        ...byOpportunity.get(row.id)!,
      };
    });
  }

  async findSavedById(invitationId: string, id: string): Promise<OpportunityDetail | null> {
    const row = await this.database.prepare(`${SELECT_SNAPSHOT}
      WHERE opportunity_snapshot.id = ?2 AND (
        EXISTS (SELECT 1 FROM saved_opportunity s
          WHERE s.opportunity_id = opportunity_snapshot.id AND s.invitation_id = ?1)
        OR EXISTS (SELECT 1 FROM feedback f
          WHERE f.opportunity_id = opportunity_snapshot.id AND f.invitation_id = ?1)
      )
    `).bind(invitationId, id).first<OpportunityRow>();
    if (!row) return null;
    const now = this.clock();
    return toDetail(row, now, isHistorical(row, now));
  }

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

    return toDetail(row, this.clock());
  }
}
