import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import WavesOutlinedIcon from '@mui/icons-material/WavesOutlined';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { OpportunitySummary } from '../../types/opportunity';
import { formatDistance } from '../../utils/distance';
import { formatOpportunityWindow } from '../../utils/date';
import {
  confidenceLabel,
  restrictionLabel,
  scoreBandColor,
  scoreBandLabel,
} from '../../utils/opportunityLabels';

interface OpportunityCardProps {
  opportunity: OpportunitySummary;
  distanceKm?: number;
  onOpen: () => void;
}

export default function OpportunityCard({
  opportunity,
  distanceKm,
  onOpen,
}: OpportunityCardProps) {
  const hasRestrictionWarning = opportunity.restrictionStatus !== 'allowed_to_recommend';

  return (
    <Card variant="outlined" sx={{ overflow: 'hidden' }}>
      <ButtonBase
        onClick={onOpen}
        aria-label={`Ver detalhes de ${opportunity.beach.name}`}
        sx={{ width: '100%', textAlign: 'left', display: 'block' }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1.5 }}>
            <Chip
              size="small"
              color={scoreBandColor[opportunity.scoreBand]}
              label={scoreBandLabel[opportunity.scoreBand]}
            />
            <Chip size="small" variant="outlined" label={confidenceLabel[opportunity.confidence]} />
          </Stack>

          <Stack direction="row" alignItems="flex-start" spacing={1}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="h6" component="h2">
                {opportunity.beach.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {opportunity.beach.municipality}
              </Typography>
            </Box>
            <ArrowForwardRoundedIcon color="action" aria-hidden="true" />
          </Stack>

          <Stack spacing={0.75} sx={{ my: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <AccessTimeOutlinedIcon fontSize="small" color="primary" aria-hidden="true" />
              <Typography variant="body2" fontWeight={700}>
                Melhor janela: {formatOpportunityWindow(
                  opportunity.recommendedStartUtc,
                  opportunity.recommendedEndUtc,
                )}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <WavesOutlinedIcon fontSize="small" color="action" aria-hidden="true" />
              <Typography variant="body2" color="text.secondary">
                Referência de maré: {opportunity.tideStationName}
              </Typography>
            </Stack>
            {distanceKm !== undefined ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <LocationOnOutlinedIcon fontSize="small" color="action" aria-hidden="true" />
                <Typography variant="body2" color="text.secondary">
                  Aproximadamente {formatDistance(distanceKm)} de você
                </Typography>
              </Stack>
            ) : null}
          </Stack>

          <Typography variant="body2">{opportunity.summary}</Typography>

          {hasRestrictionWarning ? (
            <Typography
              variant="caption"
              color={opportunity.restrictionStatus === 'not_recommended' ? 'error' : 'warning.dark'}
              display="block"
              fontWeight={700}
              sx={{ mt: 1.5 }}
            >
              {restrictionLabel[opportunity.restrictionStatus]}
            </Typography>
          ) : null}
        </CardContent>
      </ButtonBase>
    </Card>
  );
}
