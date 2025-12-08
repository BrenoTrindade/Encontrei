import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { beaches } from '../data/beachData';
import './Map.css';

const Map = () => {
  return (
    <MapContainer center={[-22.98, -43.2]} zoom={12} className="map-container">
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {beaches.map((beach) => (
        <Marker key={beach.id} position={beach.position}>
          <Popup>
            <strong>{beach.name}</strong>
            <br />
            Tide: {beach.tide}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default Map;
