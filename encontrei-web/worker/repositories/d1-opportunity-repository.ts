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
  summary: string;
  restriction_status: RestrictionStatus;
  tide_station_name: string;
  breakdown_json: string;
  sources_json: string;
  restriction_summary: string;
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
    opportunity_snapshot.summary,
    opportunity_snapshot.restriction_status,
    tide_station.name AS tide_station_name,
    opportunity_snapshot.breakdown_json,
    opportunity_snapshot.sources_json,
    opportunity_snapshot.restriction_summary
  FROM opportunity_snapshot
  INNER JOIN beach ON beach.id = opportunity_snapshot.beach_id
  INNER JOIN tide_station ON tide_station.id = beach.tide_station_id
  WHERE opportunity_snapshot.status = 'published'
`;

function toSummary(row: OpportunityRow): OpportunitySummary {
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
    summary: row.summary,
    restrictionStatus: row.restriction_status,
    tideStationName: row.tide_station_name,
  };
}

function parseJsonArray<T>(value: string): T[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

export class D1OpportunityRepository implements OpportunityRepository {
  constructor(private readonly database: D1Database) {}

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
      .bind(date, new Date().toISOString())
      .all<OpportunityRow>();

    return result.results.map(toSummary);
  }

  async findPublishedById(id: string): Promise<OpportunityDetail | null> {
    const row = await this.database
      .prepare(`${SELECT_PUBLISHED}
        AND opportunity_snapshot.id = ?1
        AND opportunity_snapshot.expires_at > ?2
      `)
      .bind(id, new Date().toISOString())
      .first<OpportunityRow>();

    if (!row) return null;

    return {
      ...toSummary(row),
      breakdown: parseJsonArray<OpportunityDetail['breakdown'][number]>(row.breakdown_json),
      sources: parseJsonArray<OpportunityDetail['sources'][number]>(row.sources_json),
      restrictionSummary: row.restriction_summary,
    };
  }
}
