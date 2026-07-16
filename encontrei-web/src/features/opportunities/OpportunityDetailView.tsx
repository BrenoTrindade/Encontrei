import { useEffect, useState } from 'react';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import WavesOutlinedIcon from '@mui/icons-material/WavesOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ApiError, getOpportunity } from '../../services/api';
import type { OpportunityDetail } from '../../types/opportunity';
import { formatOpportunityWindow, formatSourceUpdatedAt } from '../../utils/date';
import {
  confidenceLabel,
  factorLabel,
  restrictionLabel,
  restrictionSeverity,
  scoreBandColor,
  scoreBandLabel,
} from '../../utils/opportunityLabels';

interface OpportunityDetailViewProps {
  id: string;
  onBack: () => void;
  onUnauthorized: () => void;
}

export default function OpportunityDetailView({
  id,
  onBack,
  onUnauthorized,
}: OpportunityDetailViewProps) {
  const [detail, setDetail] = useState<OpportunityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let active = true;

    void getOpportunity(id)
      .then((response) => {
        if (active) setDetail(response);
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 401) {
          onUnauthorized();
          return;
        }
        setError('Não foi possível carregar os detalhes desta oportunidade.');
      });

    return () => {
      active = false;
    };
  }, [id, onUnauthorized, reloadCount]);

  if (error) {
    return (
      <Box component="main" sx={{ maxWidth: 760, mx: 'auto', px: 2, pb: 5 }}>
        <Button startIcon={<ArrowBackRoundedIcon />} onClick={onBack} sx={{ mb: 2 }}>
          Voltar ao Radar
        </Button>
        <Alert
          severity="error"
          action={<Button color="inherit" onClick={() => {
            setError(null);
            setReloadCount((value) => value + 1);
          }}>Tentar novamente</Button>}
        >
          {error}
        </Alert>
      </Box>
    );
  }

  if (!detail) {
    return (
      <Stack component="main" alignItems="center" spacing={2} sx={{ pt: 10 }}>
        <CircularProgress />
        <Typography color="text.secondary">Carregando explicação…</Typography>
      </Stack>
    );
  }

  return (
    <Box component="main" sx={{ maxWidth: 760, mx: 'auto', px: { xs: 2, sm: 3 }, pb: 6 }}>
      <Button startIcon={<ArrowBackRoundedIcon />} onClick={onBack} sx={{ mb: 2 }}>
        Voltar ao Radar
      </Button>

      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
        <Chip color={scoreBandColor[detail.scoreBand]} label={scoreBandLabel[detail.scoreBand]} />
        <Chip variant="outlined" label={confidenceLabel[detail.confidence]} />
      </Stack>

      <Typography variant="h3" component="h1" sx={{ mb: 0.5 }}>
        {detail.beach.name}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {detail.beach.municipality}
      </Typography>

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 2 }}>
        <Typography variant="overline" color="text.secondary">
          Melhor janela estimada
        </Typography>
        <Typography variant="h5" sx={{ mb: 1 }}>
          {formatOpportunityWindow(detail.recommendedStartUtc, detail.recommendedEndUtc)}
        </Typography>
        <Typography>{detail.summary}</Typography>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
          <WavesOutlinedIcon color="primary" aria-hidden="true" />
          <Typography variant="body2">
            Estação de referência: <strong>{detail.tideStationName}</strong>
          </Typography>
        </Stack>
      </Paper>

      <Alert severity={restrictionSeverity(detail.restrictionStatus)} sx={{ mb: 3 }}>
        <Typography fontWeight={800}>{restrictionLabel[detail.restrictionStatus]}</Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {detail.restrictionSummary}
        </Typography>
        <Typography variant="caption" display="block" sx={{ mt: 1 }}>
          Esta revisão não é uma autorização. Verifique sinalização, regras e condições no local.
        </Typography>
      </Alert>

      <Typography variant="h5" component="h2" gutterBottom>
        Por que esta faixa?
      </Typography>
      <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
        Os fatores abaixo explicam a recomendação experimental. A faixa não representa chance de
        encontrar um objeto.
      </Typography>

      <Stack spacing={1.5} sx={{ mb: 4 }}>
        {detail.breakdown.map((item) => {
          const percentage = item.maxContribution > 0
            ? Math.max(0, Math.min(100, (item.contribution / item.maxContribution) * 100))
            : 0;
          return (
            <Paper key={item.factor} variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={2}>
                <Typography fontWeight={800}>{factorLabel[item.factor] ?? item.factor}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Contribuição relativa
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={percentage}
                aria-label={`Contribuição relativa de ${factorLabel[item.factor] ?? item.factor}`}
                sx={{ my: 1.25, height: 7, borderRadius: 8 }}
              />
              <Typography variant="body2" color="text.secondary">
                {item.explanation}
              </Typography>
              {item.sourceUrl ? (
                <Link href={item.sourceUrl} target="_blank" rel="noopener noreferrer" variant="body2">
                  Consultar fonte <LaunchRoundedIcon sx={{ fontSize: 14, verticalAlign: 'middle' }} />
                </Link>
              ) : null}
            </Paper>
          );
        })}
      </Stack>

      <Divider sx={{ mb: 3 }} />
      <Typography variant="h5" component="h2" gutterBottom>
        Fontes consultadas
      </Typography>
      {detail.sources.length === 0 ? (
        <Alert severity="warning">Nenhuma fonte foi informada para esta oportunidade.</Alert>
      ) : (
        <Stack component="ul" spacing={1.5} sx={{ p: 0, m: 0, listStyle: 'none' }}>
          {detail.sources.map((source) => (
            <Box component="li" key={`${source.label}-${source.url}`}>
              <Link href={source.url} target="_blank" rel="noopener noreferrer" fontWeight={700}>
                {source.label} <LaunchRoundedIcon sx={{ fontSize: 14, verticalAlign: 'middle' }} />
              </Link>
              <Typography variant="caption" color="text.secondary" display="block">
                Atualizada em {formatSourceUpdatedAt(source.updatedAt)}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
