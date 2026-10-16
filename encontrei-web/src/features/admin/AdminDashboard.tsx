import { useEffect, useState, type FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { PilotParticipant, PilotSummary } from '../../../shared/admin-contract';
import { ApiError } from '../../services/api';
import { deleteParticipant, downloadPilotExport, getPilotSummary, loginAdmin, logoutAdmin } from '../../services/admin';
import { formatSourceUpdatedAt } from '../../utils/date';

const labels: Record<keyof PilotSummary['totals'], string> = {
  invited: 'Convites emitidos', accepted: 'Convites aceitos', telemetryEnabled: 'Medição permitida agora',
  saves: 'Oportunidades salvas', intentions: 'Intenções registradas', feedbacks: 'Feedbacks recebidos',
  changedDecision: 'Mudaram a decisão', confirmedDecision: 'Confirmaram a decisão',
  followedWindow: 'Seguiram a janela', incorrectInformation: 'Informações incorretas relatadas',
};

export default function AdminDashboard() {
  const [report, setReport] = useState<PilotSummary | null>(null);
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<PilotParticipant | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getPilotSummary().then((data) => { if (active) setReport(data); })
      .catch((cause: unknown) => {
        if (active && (!(cause instanceof ApiError) || cause.status !== 401))
          setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o painel.');
      }).finally(() => { if (active) setBooting(false); });
    return () => { active = false; };
  }, []);

  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setError(null); setNotice(null);
    try { await operation(); }
    catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) { setReport(null); setDeleting(null); }
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a operação.');
    } finally { setBusy(false); }
  };

  const login = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const credential = secret; setSecret('');
      await loginAdmin(credential); setReport(await getPilotSummary());
    });
  };

  if (booting) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress aria-label="Carregando administração" /></Box>;

  return (
    <Box component="main" sx={{ maxWidth: 1100, mx: 'auto', px: { xs: 2, sm: 3 }, pb: 6 }}>
      <Typography variant="h3" component="h1" gutterBottom>Painel do piloto</Typography>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {notice ? <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert> : null}
      {!report ? (
        <Paper component="form" onSubmit={login} variant="outlined" sx={{ p: 3, maxWidth: 480 }}>
          <Typography sx={{ mb: 2 }}>Acesso exclusivo do administrador. A sessão dura uma hora.</Typography>
          <TextField type="password" label="Segredo administrativo" value={secret}
            onChange={(event) => setSecret(event.target.value)} autoComplete="current-password" fullWidth required />
          <Button type="submit" variant="contained" disabled={busy || !secret} sx={{ mt: 2 }}>Entrar</Button>
        </Paper>
      ) : (
        <Stack spacing={3}>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Button disabled={busy} onClick={() => void run(async () => setReport(await getPilotSummary()))}>Atualizar</Button>
            <Button disabled={busy} onClick={() => void run(() => downloadPilotExport('csv'))}>Exportar CSV por participante</Button>
            <Button disabled={busy} onClick={() => void run(() => downloadPilotExport('json'))}>Exportar JSON completo</Button>
            <Button disabled={busy} onClick={() => void run(async () => { await logoutAdmin(); setReport(null); })}>Sair</Button>
          </Stack>
          <Alert severity="info">
            Atividade observada combina eventos permitidos, salvos e feedbacks. Sem registros não
            significa sem uso: a medição é opcional. Eventos anteriores podem existir mesmo com a
            medição desativada agora. Contagens de feedback são por recomendação, não por pessoa.
          </Alert>
          <Typography variant="caption">Atualizado em {formatSourceUpdatedAt(report.generatedAt)}</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(5, 1fr)' }, gap: 1.5 }}>
            {Object.entries(report.totals).map(([key, value]) => (
              <Paper variant="outlined" key={key} sx={{ p: 2 }}>
                <Typography variant="h4">{value}</Typography>
                <Typography variant="body2">{labels[key as keyof typeof labels]}</Typography>
              </Paper>
            ))}
          </Box>
          <Box>
            <Typography variant="h5" component="h2" gutterBottom>Participantes com atividade por semana</Typography>
            <Typography variant="body2" color="text.secondary">Semanas começam na segunda-feira, no horário do ES.</Typography>
            {report.weeklyActivity.length ? report.weeklyActivity.map((week) => (
              <Typography key={week.weekStart}>Semana de {week.weekStart}: {week.participants} participante(s)</Typography>
            )) : <Typography>Nenhuma atividade registrada.</Typography>}
          </Box>
          <Box>
            <Typography variant="h5" component="h2" gutterBottom>Informações sinalizadas como incorretas</Typography>
            {report.informationIssues.length ? report.informationIssues.map((issue) => (
              <Paper variant="outlined" key={`${issue.participantCode}-${issue.opportunityId}`} sx={{ p: 2, mb: 1 }}>
                <Typography fontWeight={700}>{issue.participantCode} · {formatSourceUpdatedAt(issue.submittedAt)}</Typography>
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>Referência: {issue.opportunityId}</Typography>
                <Typography>{issue.comment || 'Sem comentário adicional.'}</Typography>
              </Paper>
            )) : <Typography>Nenhum relato até agora.</Typography>}
          </Box>
          <Box>
            <Typography variant="h5" component="h2" gutterBottom>Convites e participação</Typography>
            {report.participants.length === 0 ? <Typography>Nenhum convite cadastrado.</Typography> : null}
            {report.participants.map((participant) => (
              <Paper variant="outlined" key={participant.id} sx={{ p: 2, mb: 1.5 }}>
                <Typography variant="h6" component="h3">{participant.code}</Typography>
                <Typography variant="body2">{participant.revoked ? 'Revogado' : participant.acceptedAt ? 'Aceito' : 'Aguardando aceite'} · Medição {participant.telemetryEnabled ? 'permitida' : 'desativada'}</Typography>
                <Typography variant="body2">Radar: {participant.radarViews} · Detalhes: {participant.detailViews} · Salvos: {participant.saves} · Intenções: {participant.intentions} · Feedbacks: {participant.feedbacks}</Typography>
                <Typography variant="body2">{participant.weeksWithActivity} semana(s) com atividade observada</Typography>
                <Button color="error" disabled={busy} onClick={() => { setDeleting(participant); setConfirmation(''); }}>Excluir convite e dados</Button>
              </Paper>
            ))}
          </Box>
          <Box>
            <Typography variant="h5" component="h2" gutterBottom>Últimas exclusões</Typography>
            {report.recentActions.length ? report.recentActions.map((action, index) => (
              <Typography variant="body2" key={`${action.occurred_at}-${index}`}>Dados de um convite excluídos em {formatSourceUpdatedAt(action.occurred_at)}</Typography>
            )) : <Typography>Nenhuma exclusão registrada.</Typography>}
          </Box>
        </Stack>
      )}
      <Dialog open={deleting !== null} onClose={() => { if (!busy) setDeleting(null); }} fullWidth maxWidth="sm">
        <DialogTitle>Excluir convite e todos os dados?</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>Isso encerra o acesso e remove eventos, salvos e feedbacks deste convite. A operação não pode ser desfeita. Arquivos já exportados não são apagados.</Typography>
          <TextField label={`Digite ${deleting?.code ?? ''} para confirmar`} value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)} fullWidth disabled={busy} />
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setDeleting(null)}>Cancelar</Button>
          <Button color="error" disabled={busy || !deleting || confirmation !== deleting.code}
            onClick={() => void run(async () => {
              if (!deleting) return;
              await deleteParticipant(deleting.id, confirmation);
              setDeleting(null); setConfirmation(''); setReport(await getPilotSummary());
              setNotice('Convite e dados excluídos.');
            })}>Excluir definitivamente</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
