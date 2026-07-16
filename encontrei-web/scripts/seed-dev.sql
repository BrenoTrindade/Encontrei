INSERT INTO tide_station (
  id, name, latitude, longitude, source_url, source_retrieved_at
) VALUES
  (
    'porto-tubarao',
    'Porto de Tubarão',
    -20.29,
    -40.24,
    'https://www.marinha.mil.br/chm/tabuas-de-mare-6?page=0',
    '2026-07-15T12:00:00.000Z'
  ),
  (
    'porto-vitoria',
    'Porto de Vitória',
    -20.32,
    -40.34,
    'https://www.marinha.mil.br/chm/tabuas-de-mare-6?page=0',
    '2026-07-15T12:00:00.000Z'
  )
ON CONFLICT(id) DO UPDATE SET
  source_retrieved_at = excluded.source_retrieved_at;

INSERT INTO beach (
  id, slug, name, municipality, latitude, longitude, tide_station_id,
  active, created_at, updated_at
) VALUES
  (
    'camburi', 'praia-de-camburi', 'Praia de Camburi', 'Vitória',
    -20.2839, -40.2896, 'porto-tubarao', 1,
    '2026-07-15T12:00:00.000Z', '2026-07-15T12:00:00.000Z'
  ),
  (
    'praia-da-costa', 'praia-da-costa', 'Praia da Costa', 'Vila Velha',
    -20.3369, -40.2825, 'porto-vitoria', 1,
    '2026-07-15T12:00:00.000Z', '2026-07-15T12:00:00.000Z'
  ),
  (
    'itaparica', 'praia-de-itaparica', 'Praia de Itaparica', 'Vila Velha',
    -20.3704, -40.3004, 'porto-vitoria', 1,
    '2026-07-15T12:00:00.000Z', '2026-07-15T12:00:00.000Z'
  )
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  municipality = excluded.municipality,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  tide_station_id = excluded.tide_station_id,
  updated_at = excluded.updated_at;

INSERT INTO invitation (
  id, token_hash, participant_code, issued_at
) VALUES (
  'invite-demo',
  'e19d8f6a163ed4ed323c17e7751ea751346cb9191aa647c4dcf25dc33a83731d',
  'DEMO-001',
  '2026-07-15T12:00:00.000Z'
)
ON CONFLICT(id) DO UPDATE SET
  token_hash = excluded.token_hash,
  participant_code = excluded.participant_code,
  revoked_at = NULL;

INSERT INTO opportunity_snapshot (
  id, beach_id, local_date, recommended_start_utc, recommended_end_utc,
  score_internal, score_band, score_version, confidence, summary,
  restriction_status, restriction_summary, breakdown_json, sources_json,
  generated_at, published_at, expires_at, status
) VALUES
  (
    'opp-camburi-20260715', 'camburi', '2026-07-15',
    '2026-07-15T08:30:00.000Z', '2026-07-15T10:30:00.000Z',
    76, 'high', 'score-v0.1', 'medium',
    'Boa janela de maré após circulação recente cadastrada.',
    'needs_verification',
    'Situação inconclusiva — confira as regras e condições locais antes da busca.',
    '[{"factor":"circulation","contribution":32,"maxContribution":40,"explanation":"Circulação recente estimada a partir de evento cadastrado."},{"factor":"tide","contribution":24,"maxContribution":30,"explanation":"Maré baixa dentro da janela sugerida."},{"factor":"recency","contribution":12,"maxContribution":20,"explanation":"Movimentação terminou recentemente."},{"factor":"conditions","contribution":8,"maxContribution":10,"explanation":"Condições gerais adequadas no momento da previsão."}]',
    '[{"label":"CHM — Porto de Tubarão","url":"https://www.marinha.mil.br/chm/tabuas-de-mare-6?page=0","updatedAt":"2026-07-15T12:00:00.000Z"},{"label":"Open-Meteo","url":"https://open-meteo.com/en/docs/marine-weather-api","updatedAt":"2026-07-15T12:00:00.000Z"}]',
    '2026-07-15T12:00:00.000Z', '2026-07-15T12:05:00.000Z',
    '2026-07-19T03:00:00.000Z', 'published'
  ),
  (
    'opp-praia-da-costa-20260716', 'praia-da-costa', '2026-07-16',
    '2026-07-16T09:10:00.000Z', '2026-07-16T11:00:00.000Z',
    58, 'medium', 'score-v0.1', 'medium',
    'Maré favorável; nenhum evento relevante recente cadastrado.',
    'allowed_to_recommend',
    'Nenhuma restrição crítica foi identificada nas fontes verificadas; isso não equivale a autorização.',
    '[{"factor":"circulation","contribution":16,"maxContribution":40,"explanation":"Circulação habitual estimada; sem evento relevante recente."},{"factor":"tide","contribution":27,"maxContribution":30,"explanation":"Boa janela de maré prevista."},{"factor":"recency","contribution":5,"maxContribution":20,"explanation":"Sem circulação recente confirmada."},{"factor":"conditions","contribution":10,"maxContribution":10,"explanation":"Condições gerais adequadas no momento da previsão."}]',
    '[{"label":"CHM — Porto de Vitória","url":"https://www.marinha.mil.br/chm/tabuas-de-mare-6?page=0","updatedAt":"2026-07-15T12:00:00.000Z"},{"label":"Open-Meteo","url":"https://open-meteo.com/en/docs/marine-weather-api","updatedAt":"2026-07-15T12:00:00.000Z"}]',
    '2026-07-15T12:00:00.000Z', '2026-07-15T12:05:00.000Z',
    '2026-07-19T03:00:00.000Z', 'published'
  ),
  (
    'opp-itaparica-20260717', 'itaparica', '2026-07-17',
    '2026-07-17T09:50:00.000Z', '2026-07-17T11:20:00.000Z',
    34, 'low', 'score-v0.1', 'low',
    'Dados ainda limitados; consulte as fontes antes de decidir.',
    'needs_verification',
    'Situação inconclusiva — confira as regras e condições locais antes da busca.',
    '[{"factor":"circulation","contribution":12,"maxContribution":40,"explanation":"Circulação habitual com baixa confiança."},{"factor":"tide","contribution":15,"maxContribution":30,"explanation":"Janela de maré moderada."},{"factor":"recency","contribution":0,"maxContribution":20,"explanation":"Sem evento recente cadastrado."},{"factor":"conditions","contribution":7,"maxContribution":10,"explanation":"Condições gerais parcialmente favoráveis."}]',
    '[{"label":"CHM — Porto de Vitória","url":"https://www.marinha.mil.br/chm/tabuas-de-mare-6?page=0","updatedAt":"2026-07-15T12:00:00.000Z"}]',
    '2026-07-15T12:00:00.000Z', '2026-07-15T12:05:00.000Z',
    '2026-07-19T03:00:00.000Z', 'published'
  )
ON CONFLICT(id) DO UPDATE SET
  score_internal = excluded.score_internal,
  score_band = excluded.score_band,
  confidence = excluded.confidence,
  summary = excluded.summary,
  restriction_status = excluded.restriction_status,
  restriction_summary = excluded.restriction_summary,
  breakdown_json = excluded.breakdown_json,
  sources_json = excluded.sources_json,
  generated_at = excluded.generated_at,
  published_at = excluded.published_at,
  expires_at = excluded.expires_at,
  status = excluded.status;
