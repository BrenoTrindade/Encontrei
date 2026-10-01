export { distanceInKm, type Coordinates } from '../../shared/geography';

export function formatDistance(distance: number): string {
  if (distance < 1) return `${Math.round(distance * 1000)} m`;
  return `${distance.toFixed(distance < 10 ? 1 : 0).replace('.', ',')} km`;
}
