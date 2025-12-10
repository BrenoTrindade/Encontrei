export interface Beach {
  id: number;
  name: string;
  position: [number, number];
  tide: 'high' | 'low' | 'rising' | 'falling';
}

export const beaches: Beach[] = [
  { id: 1, name: 'Praia de Copacabana', position: [-22.971, -43.182], tide: 'high' },
  { id: 2, name: 'Praia de Ipanema', position: [-22.984, -43.205], tide: 'low' },
  { id: 3, name: 'Praia do Leblon', position: [-22.987, -43.221], tide: 'rising' },
  { id: 4, name: 'Praia da Barra da Tijuca', position: [-23.012, -43.304], tide: 'falling' },
];