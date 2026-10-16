import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { getTelemetryPreference, setTelemetryPreference, trackParticipantEvent } from '../../services/telemetry';

export default function TelemetryPreference({ localDate }: { localDate: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void getTelemetryPreference().then((value) => {
      if (active) {
        setEnabled(value);
        if (value) trackParticipantEvent({ name: 'radar_viewed', localDate });
      }
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [retry, localDate]);

  const change = async () => {
    if (enabled === null) return;
    setBusy(true); setError(false);
    try {
      await setTelemetryPreference(!enabled);
      if (!enabled) trackParticipantEvent({ name: 'radar_viewed', localDate });
      setEnabled(!enabled);
    } catch { setError(true); }
    finally { setBusy(false); }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Typography fontWeight={700}>Medição opcional do piloto</Typography>
      <Typography variant="body2" color="text.secondary">
        Com sua permissão, registramos consultas ao Radar, dias selecionados, detalhes, abertura
        do mapa e início de feedback, ligados ao seu convite. Sem localização, contato ou
        rastreadores externos. Desativar interrompe novos eventos; os anteriores permanecem
        para análise do piloto. Salvos e feedback enviados continuam disponíveis.
      </Typography>
      <Typography variant="body2" sx={{ mt: 1 }}>
        {enabled === null ? 'Consultando preferência…' : enabled ? 'Medição ativada' : 'Medição desativada'}
      </Typography>
      {error ? <Alert severity="error" sx={{ my: 1 }}>
        Não foi possível concluir a operação.
        {enabled === null ? <Button onClick={() => { setError(false); setRetry((value) => value + 1); }}>Tentar novamente</Button> : null}
      </Alert> : null}
      <Button disabled={enabled === null || busy} onClick={() => void change()}>
        {enabled ? 'Desativar medição' : 'Permitir medição'}
      </Button>
    </Paper>
  );
}
