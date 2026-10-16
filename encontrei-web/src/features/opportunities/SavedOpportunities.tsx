import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ApiError, getSavedOpportunities } from '../../services/api';
import type { SavedOpportunitySummary } from '../../types/opportunity';
import { formatOpportunityWindow, formatSourceUpdatedAt } from '../../utils/date';
import OpportunityDetailView from './OpportunityDetailView';

interface Props { onBack: () => void; onUnauthorized: () => void }

export default function SavedOpportunities({ onBack, onUnauthorized }: Props) {
  const [items, setItems] = useState<SavedOpportunitySummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    void getSavedOpportunities().then((response) => {
      if (active) { setItems(response); setError(false); }
    }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) onUnauthorized();
      else setError(true);
    });
    return () => { active = false; };
  }, [onUnauthorized, reload]);

  if (selectedId) return (
    <OpportunityDetailView
      key={selectedId} id={selectedId} fromHistory
      onUnauthorized={onUnauthorized}
      onBack={() => { setSelectedId(null); setItems(null); setReload((value) => value + 1); }}
    />
  );

  return (
    <Box component="main" sx={{ maxWidth: 760, mx: 'auto', px: { xs: 2, sm: 3 }, pb: 6 }}>
      <Button onClick={onBack} sx={{ mb: 2 }}>Voltar ao Radar</Button>
      <Typography variant="h3" component="h1" gutterBottom>Salvos e feedback</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Consulte as recomendações que você salvou e seus feedbacks. O histórico preserva a
        versão original, mesmo quando o Radar recebe uma atualização.
      </Typography>
      {error ? (
        <Alert severity="error" action={<Button onClick={() => {
          setError(false); setReload((value) => value + 1);
        }}>Tentar novamente</Button>}>Não foi possível carregar seu histórico.</Alert>
      ) : null}
      {!error && items === null ? <CircularProgress aria-label="Carregando histórico" /> : null}
      {items?.length === 0 ? <Alert severity="info">Você ainda não salvou oportunidades nem enviou feedback.</Alert> : null}
      <Stack spacing={2}>
        {items?.map((item) => (
          <Paper variant="outlined" key={item.id} sx={{ p: 2.5 }}>
            <Typography variant="h6" component="h2">{item.beach.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {formatSourceUpdatedAt(item.recommendedStartUtc).split(',')[0]} ·{' '}
              {formatOpportunityWindow(item.recommendedStartUtc, item.recommendedEndUtc)}
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ my: 1.5 }}>
              {item.historical ? <Chip size="small" label="Histórico — janela anterior" /> : null}
              {item.saved ? <Chip size="small" label={item.intentToGo ? 'Intenção de visita registrada' : 'Salva'} /> : null}
              <Chip size="small" color={item.feedbackSubmitted ? 'success' : 'default'}
                label={item.feedbackSubmitted ? 'Feedback enviado' : 'Feedback pendente'} />
            </Stack>
            <Button onClick={() => setSelectedId(item.id)} aria-label={`Rever ${item.beach.name} de ${formatSourceUpdatedAt(item.recommendedStartUtc)}`}>
              Rever recomendação e feedback
            </Button>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}
