import { describe, expect, it } from 'vitest';
import { parseChmPageWords, type ChmPageWord } from './chm-tide-table';

const word = (text: string, x: number, top: number): ChmPageWord => ({ text, x, top });

describe('parseChmPageWords', () => {
  it('imports official local tide rows as UTC instants without mixing adjacent columns', () => {
    const words = [
      word('Setembro', 73, 90),
      word('Outubro', 203, 90),
      word('HORA', 48, 102), word('ALT(m)', 68, 102),
      word('HORA', 111, 102), word('ALT(m)', 132, 102),
      word('HORA', 175, 102), word('ALT(m)', 196, 102),
      word('HORA', 239, 102), word('ALT(m)', 260, 102),
      // 30 de setembro de 2026, coluna de dias 17-31.
      word('30', 96, 620),
      word('0453', 116, 620), word('1.43', 135, 620),
      word('1110', 116, 628), word('0.34', 135, 628),
      word('1647', 116, 636), word('1.25', 135, 636),
      word('2329', 116, 644), word('0.23', 135, 644),
      // 1º de outubro de 2026, coluna de dias 1-16.
      word('01', 160, 112),
      word('0544', 180, 112), word('1.29', 199, 112),
      word('1201', 180, 120), word('0.53', 199, 120),
      word('1719', 180, 128), word('1.14', 199, 128),
      // Valor da coluna vizinha que não pode vazar para 1º de outubro.
      word('17', 223, 112),
      word('0027', 243, 112), word('0.44', 263, 112),
    ];

    const result = parseChmPageWords(words, {
      year: 2026,
      months: [9, 10],
      utcOffsetMinutes: -180,
    });

    expect(result.filter((prediction) => prediction.localDate === '2026-09-30')).toEqual([
      { localDate: '2026-09-30', forecastAtUtc: '2026-09-30T07:53:00.000Z', heightM: 1.43 },
      { localDate: '2026-09-30', forecastAtUtc: '2026-09-30T14:10:00.000Z', heightM: 0.34 },
      { localDate: '2026-09-30', forecastAtUtc: '2026-09-30T19:47:00.000Z', heightM: 1.25 },
      { localDate: '2026-09-30', forecastAtUtc: '2026-10-01T02:29:00.000Z', heightM: 0.23 },
    ]);
    expect(result.filter((prediction) => prediction.localDate === '2026-10-01')).toEqual([
      { localDate: '2026-10-01', forecastAtUtc: '2026-10-01T08:44:00.000Z', heightM: 1.29 },
      { localDate: '2026-10-01', forecastAtUtc: '2026-10-01T15:01:00.000Z', heightM: 0.53 },
      { localDate: '2026-10-01', forecastAtUtc: '2026-10-01T20:19:00.000Z', heightM: 1.14 },
    ]);
  });
});
