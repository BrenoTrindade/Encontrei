import { useMemo } from 'react';
import { divIcon } from 'leaflet';
import { CircleMarker, MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { OpportunitySummary, ScoreBand } from '../../types/opportunity';
import type { Coordinates } from '../../utils/distance';
import { formatOpportunityWindow } from '../../utils/date';
import { scoreBandLabel } from '../../utils/opportunityLabels';

interface OpportunityMapProps {
  opportunities: OpportunitySummary[];
  userLocation: Coordinates | null;
  onOpen: (id: string) => void;
}

const markerColors: Record<ScoreBand, string> = {
  high: '#16765b',
  medium: '#b56a00',
  low: '#667085',
};

function markerIcon(scoreBand: ScoreBand) {
  const color = markerColors[scoreBand];
  return divIcon({
    className: '',
    html: `<span style="display:block;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:3px solid white;box-shadow:0 2px 7px rgba(12,35,45,.3)"><span style="display:block;width:8px;height:8px;border-radius:50%;background:white;transform:translate(7px,7px)"></span></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -26],
  });
}

export default function OpportunityMap({
  opportunities,
  userLocation,
  onOpen,
}: OpportunityMapProps) {
  const center = useMemo<[number, number]>(() => {
    if (opportunities.length === 0) return [-20.31, -40.3];
    const total = opportunities.reduce(
      (result, opportunity) => ({
        latitude: result.latitude + opportunity.beach.latitude,
        longitude: result.longitude + opportunity.beach.longitude,
      }),
      { latitude: 0, longitude: 0 },
    );
    return [total.latitude / opportunities.length, total.longitude / opportunities.length];
  }, [opportunities]);

  return (
    <MapContainer
      center={center}
      zoom={12}
      scrollWheelZoom={false}
      style={{ height: 'min(62vh, 560px)', minHeight: 390, width: '100%', borderRadius: 16 }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      {opportunities.map((opportunity) => (
        <Marker
          key={opportunity.id}
          position={[opportunity.beach.latitude, opportunity.beach.longitude]}
          icon={markerIcon(opportunity.scoreBand)}
        >
          <Popup>
            <Stack spacing={0.75} sx={{ minWidth: 180 }}>
              <Typography fontWeight={800}>{opportunity.beach.name}</Typography>
              <Typography variant="body2">{scoreBandLabel[opportunity.scoreBand]}</Typography>
              <Typography variant="body2">
                {formatOpportunityWindow(
                  opportunity.recommendedStartUtc,
                  opportunity.recommendedEndUtc,
                )}
              </Typography>
              <Button size="small" onClick={() => onOpen(opportunity.id)}>
                Ver detalhes
              </Button>
            </Stack>
          </Popup>
        </Marker>
      ))}

      {userLocation ? (
        <CircleMarker
          center={[userLocation.latitude, userLocation.longitude]}
          radius={8}
          pathOptions={{ color: '#075985', fillColor: '#38bdf8', fillOpacity: 0.9, weight: 3 }}
        >
          <Popup>Sua posição, usada somente neste navegador.</Popup>
        </CircleMarker>
      ) : null}
    </MapContainer>
  );
}
