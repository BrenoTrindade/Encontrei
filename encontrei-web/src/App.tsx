import { lazy, Suspense, useMemo, useState } from 'react';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import InvitationScreen from './features/invitations/InvitationScreen';
import OpportunityRadar from './features/opportunities/OpportunityRadar';
import theme from './theme';
const AdminDashboard = lazy(() => import('./features/admin/AdminDashboard'));

type AccessState = 'invitation' | 'radar' | 'missing-invitation';

function App() {
  const isAdmin = window.location.pathname.replace(/\/$/, '') === '/admin';
  const invitationToken = useMemo(
    () => new URLSearchParams(window.location.search).get('invite'),
    [],
  );
  const [accessState, setAccessState] = useState<AccessState>(
    invitationToken ? 'invitation' : 'radar',
  );

  const removeInvitationFromAddress = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('invite');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const handleAccepted = () => {
    removeInvitationFromAddress();
    setAccessState('radar');
  };

  const handleUnauthorized = () => {
    setAccessState('missing-invitation');
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
        <Box
          component="header"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            maxWidth: 960,
            mx: 'auto',
            px: { xs: 2, sm: 3 },
            py: 2,
          }}
        >
          <ExploreOutlinedIcon color="primary" aria-hidden="true" />
          <Typography component="span" variant="h6" fontWeight={800}>
            Encontrei
          </Typography>
          <Typography
            component="span"
            variant="caption"
            sx={{ ml: 'auto', color: 'text.secondary' }}
          >
            Piloto fechado
          </Typography>
        </Box>

        {isAdmin ? <Suspense fallback={<Typography sx={{ p: 3 }}>Carregando administração…</Typography>}><AdminDashboard /></Suspense> : null}
        {!isAdmin && accessState === 'invitation' && invitationToken ? (
          <InvitationScreen token={invitationToken} onAccepted={handleAccepted} />
        ) : null}

        {!isAdmin && accessState === 'radar' ? (
          <OpportunityRadar onUnauthorized={handleUnauthorized} />
        ) : null}

        {!isAdmin && accessState === 'missing-invitation' ? (
          <InvitationScreen token={null} onAccepted={handleAccepted} />
        ) : null}
      </Box>
    </ThemeProvider>
  );
}

export default App;
