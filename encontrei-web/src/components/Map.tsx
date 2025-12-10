import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import type { Beach } from '../data/beachData';
import { customIcon } from './Icon';

interface MapProps {
  beaches: Beach[];
  onBeachSelect: (beach: Beach) => void;
}

const Map = ({ beaches, onBeachSelect }: MapProps) => {
  return (
    <MapContainer center={[-22.98, -43.2]} zoom={12} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {beaches.map((beach) => (
        <Marker 
          key={beach.id} 
          position={beach.position}
          icon={customIcon}
          eventHandlers={{
            click: () => {
              onBeachSelect(beach);
            },
          }}
        />
      ))}
    </MapContainer>
  );
};

export default Map;
