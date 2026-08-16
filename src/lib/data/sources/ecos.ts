import { z } from 'zod';

export type FxSeries = { dates: string[]; rates: number[] };

/** 3.1.1.1 주요국 통화의 대원화환율 */
export const ECOS_FX_STAT_CODE = '731Y001';
/** 원/미국달러(매매기준율) */
export const ECOS_FX_ITEM_CODE = '0000001';

const errorSchema = z.object({
  RESULT: z.object({ CODE: z.string(), MESSAGE: z.string() }),
});

const successSchema = z.object({
  StatisticSearch: z.object({
    list_total_count: z.number(),
    row: z.array(
      z.object({ TIME: z.string(), DATA_VALUE: z.string() }),
    ),
  }),
});

function compactToIso(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function isoToCompact(iso: string): string {
  return iso.replaceAll('-', '');
}

export function ecosFxUrl(
  apiKey: string,
  start: string,
  end: string,
  startRow: number,
  endRow: number,
): string {
  return (
    `https://ecos.bok.or.kr/api/StatisticSearch/${apiKey}/json/kr` +
    `/${startRow}/${endRow}/${ECOS_FX_STAT_CODE}/D` +
    `/${isoToCompact(start)}/${isoToCompact(end)}/${ECOS_FX_ITEM_CODE}`
  );
}

export function parseEcosResponse(json: unknown): FxSeries {
  const asError = errorSchema.safeParse(json);
  if (asError.success) {
    const { CODE, MESSAGE } = asError.data.RESULT;
    throw new Error(`ECOS 오류 ${CODE}: ${MESSAGE}`);
  }

  const parsed = successSchema.parse(json);

  const dates: string[] = [];
  const rates: number[] = [];

  for (const row of parsed.StatisticSearch.row) {
    // 빈 문자열이나 변환 불가능한 값은 제외한다
    if (!row.DATA_VALUE) continue;
    const value = Number(row.DATA_VALUE);
    if (!Number.isFinite(value)) continue;
    dates.push(compactToIso(row.TIME));
    rates.push(value);
  }

  return { dates, rates };
}
