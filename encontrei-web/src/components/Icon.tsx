import { divIcon } from 'leaflet';
import { renderToString } from 'react-dom/server';
import LocationOnIcon from '@mui/icons-material/LocationOn';

export const customIcon = divIcon({
  html: renderToString(<LocationOnIcon color="primary" sx={{ fontSize: 40 }} />),
  className: 'dummy', // Leaflet requires a className
  iconSize: [40, 40],
  iconAnchor: [20, 40], // Point of the icon which will correspond to marker's location
  popupAnchor: [0, -40] // Point from which the popup should open relative to the iconAnchor
});
