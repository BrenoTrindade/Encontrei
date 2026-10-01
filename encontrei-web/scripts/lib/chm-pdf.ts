import { createHash } from 'node:crypto';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  parseChmPageWords,
  type ChmPageWord,
  type TidePredictionInput,
} from '../../worker/domain/tides/chm-tide-table.ts';

export interface ChmTideTable {
  checksumSha256: string;
  predictions: TidePredictionInput[];
}

const PAGE_MONTHS = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
];

export async function parseChmPdf(
  bytes: Uint8Array,
  year: number,
): Promise<ChmTideTable> {
  // PDF.js transfere o ArrayBuffer para o worker e pode destacar o buffer original.
  // O checksum precisa ser calculado antes dessa transferência.
  const checksumSha256 = createHash('sha256').update(bytes).digest('hex');
  const document = await getDocument({ data: bytes }).promise;
  if (document.numPages !== PAGE_MONTHS.length) {
    throw new Error(`A tábua do CHM deveria ter 3 páginas; recebeu ${document.numPages}.`);
  }

  const predictions: TidePredictionInput[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const words: ChmPageWord[] = content.items.flatMap((item) => {
      if (!('str' in item) || item.str.trim().length === 0) return [];
      const [x, top] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
      return [{ text: item.str.trim(), x, top }];
    });

    predictions.push(...parseChmPageWords(words, {
      year,
      months: PAGE_MONTHS[pageNumber - 1] ?? [],
      utcOffsetMinutes: -180,
    }));
  }

  if (predictions.length < 1_300 || predictions.length > 1_500) {
    throw new Error(
      `Quantidade inesperada de previsões na tábua do CHM: ${predictions.length}.`,
    );
  }

  return {
    checksumSha256,
    predictions,
  };
}
