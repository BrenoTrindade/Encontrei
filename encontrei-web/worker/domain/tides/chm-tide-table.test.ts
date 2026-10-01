import { describe, expect, it } from 'vitest';
import { parseChmPageWords, type ChmPageWord } from './chm-tide-table';

const word = (text: string, x: number, top: number): ChmPageWord => ({ text, x, top });

describe('parseChmPageWords', () => {
  it('imports synthetic rows in the official layout as UTC instants without mixing columns', () => {
    const words = [
      word('Setembro', 73, 90),
      word('Outubro', 203, 90),
      word('HORA', 48, 102), word('ALT(m)', 68, 102),
      word('HORA', 111, 102), word('ALT(m)', 132, 102),
      word('HORA', 175, 102), word('ALT(m)', 196, 102),
      word('HORA', 239, 102), word('ALT(m)', 260, 102),
      // Fixture sintética na coluna de dias 17-31.
      word('30', 96, 620),
      word('0415', 116, 620), word('1.80', 135, 620),
      word('1030', 116, 628), word('0.40', 135, 628),
      word('1645', 116, 636), word('1.60', 135, 636),
      word('2315', 116, 644), word('0.30', 135, 644),
      // Fixture sintética na coluna de dias 1-16.
      word('01', 160, 112),
      word('0500', 180, 112), word('1.70', 199, 112),
      word('1130', 180, 120), word('0.50', 199, 120),
      word('1800', 180, 128), word('1.50', 199, 128),
      // Valor da coluna vizinha que não pode vazar para 1º de outubro.
      word('17', 223, 112),
      word('0030', 243, 112), word('0.60', 263, 112),
    ];

    const result = parseChmPageWords(words, {
      year: 2032,
      months: [9, 10],
      utcOffsetMinutes: -180,
    });

    expect(result.filter((prediction) => prediction.localDate === '2032-09-30')).toEqual([
      { localDate: '2032-09-30', forecastAtUtc: '2032-09-30T07:15:00.000Z', heightM: 1.8 },
      { localDate: '2032-09-30', forecastAtUtc: '2032-09-30T13:30:00.000Z', heightM: 0.4 },
      { localDate: '2032-09-30', forecastAtUtc: '2032-09-30T19:45:00.000Z', heightM: 1.6 },
      { localDate: '2032-09-30', forecastAtUtc: '2032-10-01T02:15:00.000Z', heightM: 0.3 },
    ]);
    expect(result.filter((prediction) => prediction.localDate === '2032-10-01')).toEqual([
      { localDate: '2032-10-01', forecastAtUtc: '2032-10-01T08:00:00.000Z', heightM: 1.7 },
      { localDate: '2032-10-01', forecastAtUtc: '2032-10-01T14:30:00.000Z', heightM: 0.5 },
      { localDate: '2032-10-01', forecastAtUtc: '2032-10-01T21:00:00.000Z', heightM: 1.5 },
    ]);
  });
});
