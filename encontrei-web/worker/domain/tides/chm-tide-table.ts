export interface ChmPageWord {
  text: string;
  x: number;
  top: number;
}

export interface ChmPageDefinition {
  year: number;
  months: number[];
  utcOffsetMinutes: number;
}

export interface TidePredictionInput {
  localDate: string;
  forecastAtUtc: string;
  heightM: number;
}

const DAY = /^\d{2}$/;
const TIME_AT_END = /(\d{4})$/;
const HEIGHT = /^-?\d+(?:\.\d+)?$/;

function near(value: number, expected: number, tolerance = 8): boolean {
  return Math.abs(value - expected) <= tolerance;
}

function isoLocalDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function toUtcIso(
  year: number,
  month: number,
  day: number,
  localTime: string,
  utcOffsetMinutes: number,
): string {
  const hours = Number(localTime.slice(0, 2));
  const minutes = Number(localTime.slice(2));
  if (hours > 23 || minutes > 59) {
    throw new RangeError(`Horário de maré inválido: ${localTime}.`);
  }

  return new Date(
    Date.UTC(year, month - 1, day, hours, minutes) - utcOffsetMinutes * 60_000,
  ).toISOString();
}

export function parseChmPageWords(
  words: ChmPageWord[],
  definition: ChmPageDefinition,
): TidePredictionInput[] {
  const timeColumns = words
    .filter((candidate) => candidate.text === 'HORA' || candidate.text.startsWith('HORA '))
    .sort((first, second) => first.x - second.x);

  if (timeColumns.length < definition.months.length * 2) {
    throw new Error('A página do CHM não contém todas as colunas HORA esperadas.');
  }

  const predictions: TidePredictionInput[] = [];

  timeColumns.slice(0, definition.months.length * 2).forEach((column, columnIndex) => {
    const month = definition.months[Math.floor(columnIndex / 2)];
    if (!month || month < 1 || month > 12) {
      throw new RangeError('Mês inválido na definição da página do CHM.');
    }

    const isSecondHalf = columnIndex % 2 === 1;
    const dayX = column.x - 16;
    const heightX = column.x + 20;
    const days = words
      .filter((candidate) => {
        if (!DAY.test(candidate.text) || !near(candidate.x, dayX)) return false;
        const day = Number(candidate.text);
        return isSecondHalf ? day >= 17 && day <= 31 : day >= 1 && day <= 16;
      })
      .sort((first, second) => first.top - second.top);

    days.forEach((dayWord, dayIndex) => {
      const day = Number(dayWord.text);
      const nextDayTop = days[dayIndex + 1]?.top ?? Number.POSITIVE_INFINITY;
      const localDate = isoLocalDate(definition.year, month, day);

      const timeWords = words.filter((candidate) => (
        candidate.top >= dayWord.top - 2
        && candidate.top < nextDayTop - 2
        && candidate.x >= dayX - 3
        && candidate.x <= column.x + 8
        && TIME_AT_END.test(candidate.text)
      ));

      for (const timeWord of timeWords) {
        const localTime = timeWord.text.match(TIME_AT_END)?.[1];
        if (!localTime) continue;

        const heightWord = words.find((candidate) => (
          near(candidate.x, heightX)
          && near(candidate.top, timeWord.top, 2)
          && HEIGHT.test(candidate.text)
        ));
        if (!heightWord) {
          throw new Error(`Altura ausente para ${localDate} ${localTime}.`);
        }

        const heightM = Number(heightWord.text);
        if (!Number.isFinite(heightM) || heightM < -5 || heightM > 20) {
          throw new RangeError(`Altura de maré inválida: ${heightWord.text}.`);
        }

        predictions.push({
          localDate,
          forecastAtUtc: toUtcIso(
            definition.year,
            month,
            day,
            localTime,
            definition.utcOffsetMinutes,
          ),
          heightM,
        });
      }
    });
  });

  const uniqueInstants = new Set(predictions.map((prediction) => prediction.forecastAtUtc));
  if (uniqueInstants.size !== predictions.length) {
    throw new Error('A página do CHM contém instantes de maré duplicados.');
  }

  return predictions.sort((first, second) => (
    first.forecastAtUtc.localeCompare(second.forecastAtUtc)
  ));
}
