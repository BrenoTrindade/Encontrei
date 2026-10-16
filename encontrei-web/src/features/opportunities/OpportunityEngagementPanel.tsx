import { useEffect, useState } from 'react';
import BookmarkBorderRoundedIcon from '@mui/icons-material/BookmarkBorderRounded';
import BookmarkRoundedIcon from '@mui/icons-material/BookmarkRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import Paper from '@mui/material/Paper';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  ApiError,
  getOpportunityEngagement,
  removeSavedOpportunity,
  saveOpportunity,
  submitOpportunityFeedback,
} from '../../services/api';
import type {
  DecisionEffect,
  OpportunityEngagementState,
  ResultCategory,
} from '../../types/opportunity';

interface OpportunityEngagementPanelProps {
  opportunityId: string;
  onUnauthorized: () => void;
}

function isYes(value: string): boolean {
  return value === 'yes';
}

export default function OpportunityEngagementPanel({
  opportunityId,
  onUnauthorized,
}: OpportunityEngagementPanelProps) {
  const [state, setState] = useState<OpportunityEngagementState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [wentToBeach, setWentToBeach] = useState('');
  const [followedWindow, setFollowedWindow] = useState('');
  const [decisionEffect, setDecisionEffect] = useState<DecisionEffect | ''>('');
  const [resultCategory, setResultCategory] = useState<ResultCategory | ''>('');
  const [informationCorrect, setInformationCorrect] = useState('');
  const [comment, setComment] = useState('');

  useEffect(() => {
    let active = true;
    void getOpportunityEngagement(opportunityId)
      .then((response) => {
        if (active) setState(response);
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 401) {
          onUnauthorized();
          return;
        }
        setError('Não foi possível carregar seu estado de participação.');
      });
    return () => { active = false; };
  }, [opportunityId, onUnauthorized]);

  const run = async (operation: () => Promise<OpportunityEngagementState | void>) => {
    setBusy(true);
    setError(null);
    try {
      const response = await operation();
      if (response) setState(response);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        onUnauthorized();
        return;
      }
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = () => run(async () => {
    await removeSavedOpportunity(opportunityId);
    setState({ saved: false, intentToGo: null, savedAt: null, feedbackSubmitted: state?.feedbackSubmitted ?? false });
  });

  const feedbackComplete = wentToBeach !== ''
    && decisionEffect !== ''
    && informationCorrect !== ''
    && (wentToBeach === 'no' || (followedWindow !== '' && resultCategory !== ''));

  const handleFeedback = () => run(async () => {
    if (!feedbackComplete || !decisionEffect) return;
    const went = isYes(wentToBeach);
    await submitOpportunityFeedback(opportunityId, {
      wentToBeach: went,
      followedWindow: went && isYes(followedWindow),
      decisionEffect,
      resultCategory: went ? resultCategory as ResultCategory : 'not_applicable',
      informationCorrect: isYes(informationCorrect),
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    });
    setState((current) => current ? { ...current, feedbackSubmitted: true } : current);
    setShowFeedback(false);
  });

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
      <Typography variant="h5" component="h2" gutterBottom>Sua decisão</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Salvar ou indicar intenção não confirma presença e não compartilha sua localização.
      </Typography>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {!state ? <CircularProgress size={24} aria-label="Carregando participação" /> : (
        <Stack spacing={1.5}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
            <Button
              variant={state.saved ? 'outlined' : 'contained'}
              startIcon={state.saved ? <BookmarkRoundedIcon /> : <BookmarkBorderRoundedIcon />}
              disabled={busy}
              onClick={state.saved
                ? handleRemove
                : () => run(() => saveOpportunity(opportunityId, false))}
            >
              {state.saved ? 'Remover dos salvos' : 'Salvar para consultar'}
            </Button>
            <FormControlLabel
              control={(
                <Switch
                  checked={state.intentToGo === true}
                  disabled={busy}
                  onChange={(event) => run(() => saveOpportunity(opportunityId, event.target.checked))}
                />
              )}
              label="Pretendo ir nesta janela"
            />
          </Stack>
          {state.saved ? (
            <Alert severity="success">
              Oportunidade salva{state.intentToGo ? ' com intenção de visita' : ''}.
            </Alert>
          ) : null}
        </Stack>
      )}

      <Divider sx={{ my: 3 }} />
      {state?.feedbackSubmitted && !showFeedback ? (
        <Alert
          severity="success"
          action={<Button color="inherit" onClick={() => setShowFeedback(true)}>Atualizar</Button>}
        >
          Feedback enviado. Obrigado por ajudar a avaliar o Radar.
        </Alert>
      ) : null}

      {state && !state.feedbackSubmitted && !showFeedback ? (
        <Button variant="text" onClick={() => setShowFeedback(true)}>
          Enviar feedback desta oportunidade
        </Button>
      ) : null}

      {showFeedback ? (
        <Stack spacing={2.5}>
          <FormControl required>
            <FormLabel>Você foi à praia?</FormLabel>
            <RadioGroup row value={wentToBeach} onChange={(event) => {
              const value = event.target.value;
              setWentToBeach(value);
              if (value === 'no') {
                setFollowedWindow('no');
                setResultCategory('not_applicable');
              } else if (resultCategory === 'not_applicable') {
                setResultCategory('');
              }
            }}>
              <FormControlLabel value="yes" control={<Radio />} label="Sim" />
              <FormControlLabel value="no" control={<Radio />} label="Não" />
            </RadioGroup>
          </FormControl>

          {wentToBeach === 'yes' ? (
            <>
              <FormControl required>
                <FormLabel>Você seguiu a janela sugerida?</FormLabel>
                <RadioGroup row value={followedWindow} onChange={(event) => setFollowedWindow(event.target.value)}>
                  <FormControlLabel value="yes" control={<Radio />} label="Sim" />
                  <FormControlLabel value="no" control={<Radio />} label="Não" />
                </RadioGroup>
              </FormControl>
              <FormControl required>
                <FormLabel>Qual foi o resultado?</FormLabel>
                <RadioGroup value={resultCategory} onChange={(event) => setResultCategory(event.target.value as ResultCategory)}>
                  <FormControlLabel value="found_relevant" control={<Radio />} label="Encontrei algo relevante" />
                  <FormControlLabel value="found_other" control={<Radio />} label="Encontrei apenas objetos comuns" />
                  <FormControlLabel value="nothing" control={<Radio />} label="Não encontrei nada" />
                </RadioGroup>
              </FormControl>
            </>
          ) : null}

          <FormControl required>
            <FormLabel>A recomendação mudou ou confirmou sua decisão?</FormLabel>
            <RadioGroup value={decisionEffect} onChange={(event) => setDecisionEffect(event.target.value as DecisionEffect)}>
              <FormControlLabel value="changed" control={<Radio />} label="Mudou minha decisão" />
              <FormControlLabel value="confirmed" control={<Radio />} label="Confirmou minha decisão" />
              <FormControlLabel value="no_effect" control={<Radio />} label="Não influenciou" />
            </RadioGroup>
          </FormControl>

          <FormControl required>
            <FormLabel>As informações apresentadas pareciam corretas?</FormLabel>
            <RadioGroup row value={informationCorrect} onChange={(event) => setInformationCorrect(event.target.value)}>
              <FormControlLabel value="yes" control={<Radio />} label="Sim" />
              <FormControlLabel value="no" control={<Radio />} label="Não" />
            </RadioGroup>
          </FormControl>

          <TextField
            label="Comentário opcional"
            multiline
            minRows={3}
            value={comment}
            onChange={(event) => setComment(event.target.value.slice(0, 500))}
            helperText={`${comment.length}/500`}
          />
          <Box>
            <Button
              variant="contained"
              startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <SendRoundedIcon />}
              disabled={busy || !feedbackComplete}
              onClick={handleFeedback}
            >
              Enviar feedback
            </Button>
            <Button disabled={busy} onClick={() => setShowFeedback(false)} sx={{ ml: 1 }}>
              Cancelar
            </Button>
          </Box>
        </Stack>
      ) : null}
    </Paper>
  );
}
