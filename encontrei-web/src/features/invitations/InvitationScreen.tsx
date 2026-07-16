import { useState } from 'react';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { acceptInvitation, ApiError } from '../../services/api';

interface InvitationScreenProps {
  token: string | null;
  onAccepted: () => void;
}

export default function InvitationScreen({ token, onAccepted }: InvitationScreenProps) {
  const [consented, setConsented] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);

  const handleAccept = async () => {
    if (!token || !consented) return;
    setIsSubmitting(true);
    setError(null);

    try {
      await acceptInvitation(token);
      onAccepted();
    } catch (requestError) {
      if (requestError instanceof ApiError && [400, 401, 404, 409, 410].includes(requestError.status)) {
        setError('Este convite não é válido, já foi usado ou foi revogado. Peça um novo link.');
      } else {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Não foi possível aceitar o convite.',
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <Box component="main" sx={{ maxWidth: 640, mx: 'auto', px: 2, pt: 5 }}>
        <Card>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <InfoOutlinedIcon color="primary" sx={{ fontSize: 40, mb: 2 }} />
            <Typography variant="h4" component="h1" gutterBottom>
              Acesso por convite
            </Typography>
            <Typography color="text.secondary">
              O Radar está em um piloto fechado. Abra o link individual que você recebeu pelo
              WhatsApp. Se o link expirou, peça um novo convite ao responsável pelo piloto.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (declined) {
    return (
      <Box component="main" sx={{ maxWidth: 640, mx: 'auto', px: 2, pt: 5 }}>
        <Card>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Typography variant="h4" component="h1" gutterBottom>
              Convite recusado
            </Typography>
            <Typography color="text.secondary">
              Tudo bem. Sua participação não foi ativada. Você já pode fechar esta página.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box component="main" sx={{ maxWidth: 680, mx: 'auto', px: 2, pb: 5 }}>
      <Card>
        <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
          <CheckCircleOutlineIcon color="primary" sx={{ fontSize: 44, mb: 1 }} />
          <Typography variant="h4" component="h1" gutterBottom>
            Convite para o piloto
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Durante quatro semanas, o Encontrei mostrará janelas de busca experimentais para
            praias do corredor Camburi–Itaparica.
          </Typography>

          <Stack spacing={2} sx={{ mb: 3 }}>
            <Box>
              <Typography fontWeight={700}>O que você verá</Typography>
              <Typography variant="body2" color="text.secondary">
                Faixas de oportunidade para hoje, amanhã e depois, com fatores, fontes e nível de
                confiança separados.
              </Typography>
            </Box>
            <Box>
              <Typography fontWeight={700}>Dados do piloto</Typography>
              <Typography variant="body2" color="text.secondary">
                Nesta primeira versão, o convite mantém apenas uma sessão pseudônima. A coleta de
                aberturas, oportunidades consultadas e feedback só será ativada quando a telemetria
                e a política do piloto estiverem prontas. Não armazenamos sua localização.
              </Typography>
            </Box>
            <Alert severity="warning">
              As faixas são uma hipótese experimental: não indicam probabilidade de achar objetos
              e não substituem a verificação das regras e condições locais.
            </Alert>
          </Stack>

          <FormControlLabel
            control={
              <Checkbox
                checked={consented}
                onChange={(event) => setConsented(event.target.checked)}
              />
            }
            label="Li as limitações e aceito acessar esta versão fechada do piloto."
            sx={{ alignItems: 'flex-start', mb: 2 }}
          />

          {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

          <Button
            variant="contained"
            size="large"
            fullWidth
            disabled={!consented || isSubmitting}
            onClick={handleAccept}
          >
            {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Aceitar e abrir o Radar'}
          </Button>
          <Button
            variant="text"
            color="inherit"
            fullWidth
            disabled={isSubmitting}
            onClick={() => setDeclined(true)}
            sx={{ mt: 1 }}
          >
            Não quero participar
          </Button>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
            Se aceitar, você ainda poderá solicitar a saída do piloto a qualquer momento.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
