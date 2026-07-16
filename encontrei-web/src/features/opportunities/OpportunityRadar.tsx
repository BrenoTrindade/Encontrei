import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import FormatListBulletedRoundedIcon from '@mui/icons-material/FormatListBulletedRounded';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { ApiError, getOpportunities } from '../../services/api';
import type { OpportunitySummary } from '../../types/opportunity';
import { distanceInKm, type Coordinates } from '../../utils/distance';
import { getPilotDates } from '../../utils/date';
import OpportunityCard from './OpportunityCard';
import OpportunityDetailView from './OpportunityDetailView';

interface OpportunityRadarProps {
  onUnauthorized: () => void;
}

type ViewMode = 'list' | 'map';
type SortMode = 'opportunity' | 'distance';

const dayLabels = ['Hoje', 'Amanhã', 'Depois'];
const bandOrder = { high: 0, medium: 1, low: 2 } as const;
const OpportunityMap = lazy(() => import('../map/OpportunityMap'));

export default function OpportunityRadar({ onUnauthorized }: OpportunityRadarProps) {
  const dates = useMemo(() => getPilotDates(), []);
  const [dayIndex, setDayIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortMode, setSortMode] = useState<SortMode>('opportunity');
  const [opportunities, setOpportunities] = useState<OpportunitySummary[] | null>(null);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const selectedDate = dates[dayIndex];

  useEffect(() => {
    if (!selectedDate) return;
    let active = true;

    void getOpportunities(selectedDate)
      .then((response) => {
        if (active) setOpportunities(response);
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 401) {
          onUnauthorized();
          return;
        }
        setError('Não foi possível carregar o Radar. Confira sua conexão e tente novamente.');
      });

    return () => {
      active = false;
    };
  }, [selectedDate, onUnauthorized, reloadCount]);

  const opportunitiesWithDistance = useMemo(
    () =>
      (opportunities ?? []).map((opportunity) => ({
        opportunity,
        distanceKm: userLocation
          ? distanceInKm(userLocation, {
              latitude: opportunity.beach.latitude,
              longitude: opportunity.beach.longitude,
            })
          : undefined,
      })),
    [opportunities, userLocation],
  );

  const sortedOpportunities = useMemo(() => {
    return [...opportunitiesWithDistance].sort((first, second) => {
      if (
        sortMode === 'distance' &&
        first.distanceKm !== undefined &&
        second.distanceKm !== undefined
      ) {
        return first.distanceKm - second.distanceKm;
      }

      const firstRestricted = first.opportunity.restrictionStatus === 'not_recommended' ? 1 : 0;
      const secondRestricted = second.opportunity.restrictionStatus === 'not_recommended' ? 1 : 0;
      if (firstRestricted !== secondRestricted) return firstRestricted - secondRestricted;

      const bandDifference =
        bandOrder[first.opportunity.scoreBand] - bandOrder[second.opportunity.scoreBand];
      if (bandDifference !== 0) return bandDifference;

      return (
        new Date(first.opportunity.recommendedStartUtc).getTime() -
        new Date(second.opportunity.recommendedStartUtc).getTime()
      );
    });
  }, [opportunitiesWithDistance, sortMode]);

  const requestLocation = () => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError('Seu navegador não oferece acesso à localização.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setSortMode('distance');
        setIsLocating(false);
      },
      () => {
        setLocationError(
          'Não conseguimos acessar sua localização. Você pode usar todo o Radar sem ela.',
        );
        setIsLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  if (selectedOpportunityId) {
    return (
      <OpportunityDetailView
        id={selectedOpportunityId}
        onBack={() => setSelectedOpportunityId(null)}
        onUnauthorized={onUnauthorized}
      />
    );
  }

  return (
    <Box component="main" sx={{ maxWidth: 960, mx: 'auto', px: { xs: 2, sm: 3 }, pb: 6 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Radar de oportunidades
        </Typography>
        <Typography color="text.secondary">
          Compare janelas estimadas para as próximas 72 horas. As faixas ajudam no planejamento,
          mas não garantem achados nem substituem verificações no local.
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: 1, mb: 2 }}>
        <ToggleButtonGroup
          value={dayIndex}
          exclusive
          fullWidth
          onChange={(_, value: number | null) => {
            if (value !== null) {
              setOpportunities(null);
              setError(null);
              setDayIndex(value);
            }
          }}
          aria-label="Dia do Radar"
          size="small"
        >
          {dayLabels.map((label, index) => (
            <ToggleButton key={label} value={index} aria-label={label}>
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Paper>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, value: ViewMode | null) => {
            if (value) setViewMode(value);
          }}
          aria-label="Visualização do Radar"
          size="small"
        >
          <ToggleButton value="list" aria-label="Ver lista">
            <FormatListBulletedRoundedIcon fontSize="small" sx={{ mr: 1 }} /> Lista
          </ToggleButton>
          <ToggleButton value="map" aria-label="Ver mapa">
            <MapOutlinedIcon fontSize="small" sx={{ mr: 1 }} /> Mapa
          </ToggleButton>
        </ToggleButtonGroup>

        {userLocation ? (
          <ToggleButtonGroup
            value={sortMode}
            exclusive
            onChange={(_, value: SortMode | null) => {
              if (value) setSortMode(value);
            }}
            size="small"
            aria-label="Ordenação das oportunidades"
          >
            <ToggleButton value="opportunity">Melhor faixa</ToggleButton>
            <ToggleButton value="distance">Mais perto</ToggleButton>
          </ToggleButtonGroup>
        ) : (
          <Button
            variant="text"
            startIcon={isLocating ? <CircularProgress size={16} /> : <LocationOnOutlinedIcon />}
            disabled={isLocating}
            onClick={requestLocation}
          >
            Ordenar por proximidade
          </Button>
        )}
      </Stack>

      {userLocation ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Sua posição foi usada apenas neste navegador para calcular distâncias. Ela não foi
          enviada nem armazenada.
        </Alert>
      ) : null}
      {locationError ? <Alert severity="warning" sx={{ mb: 2 }}>{locationError}</Alert> : null}

      {error ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" onClick={() => {
              setError(null);
              setOpportunities(null);
              setReloadCount((value) => value + 1);
            }}>
              Tentar novamente
            </Button>
          }
        >
          {error}
        </Alert>
      ) : null}

      {!error && opportunities === null ? (
        <Stack spacing={1.5} aria-label="Carregando oportunidades">
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} variant="rounded" height={190} animation="wave" />
          ))}
        </Stack>
      ) : null}

      {!error && opportunities?.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" component="h2" gutterBottom>
            Nenhuma oportunidade publicada
          </Typography>
          <Typography color="text.secondary">
            Ainda não há uma recomendação revisada para este dia. Isso não significa que a busca
            seja favorável ou desfavorável; volte mais tarde para conferir.
          </Typography>
        </Paper>
      ) : null}

      {!error && opportunities && opportunities.length > 0 && viewMode === 'list' ? (
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            {opportunities.length} {opportunities.length === 1 ? 'praia coberta' : 'praias cobertas'}
          </Typography>
          {sortedOpportunities.map(({ opportunity, distanceKm }) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              distanceKm={distanceKm}
              onOpen={() => setSelectedOpportunityId(opportunity.id)}
            />
          ))}
        </Stack>
      ) : null}

      {!error && opportunities && opportunities.length > 0 && viewMode === 'map' ? (
        <Box>
          <Alert severity="info" sx={{ mb: 1.5 }}>
            O mapa é uma visão complementar. Toque em uma praia para consultar a janela e a
            explicação completa.
          </Alert>
          <Suspense fallback={<Skeleton variant="rounded" height={390} animation="wave" />}>
            <OpportunityMap
              opportunities={opportunities}
              userLocation={userLocation}
              onOpen={setSelectedOpportunityId}
            />
          </Suspense>
        </Box>
      ) : null}
    </Box>
  );
}
