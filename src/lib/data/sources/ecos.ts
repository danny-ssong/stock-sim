import { z } from 'zod';

export type EcosSeries = { dates: string[]; values: number[] };

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

/**
 * ECOS TIME은 주기별로 자릿수가 다르다 — 일별(D)은 YYYYMMDD(8자리),
 * 월별(M)은 YYYYMM(6자리)이다. 월별은 그 달 1일로 앵커링해 ISO로 바꾼다
 * (실제 API 응답으로 확인한 형식이다).
 */
function compactToIso(compact: string): string {
  if (compact.length === 6) {
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-01`;
  }
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

/** ISO 날짜를 요청 주기에 맞는 자릿수로 압축한다 — 월별(M)은 YYYYMM까지만 쓴다. */
function isoToCompact(iso: string, cycle: 'D' | 'M'): string {
  const compact = iso.replaceAll('-', '');
  return cycle === 'M' ? compact.slice(0, 6) : compact;
}

export function ecosSeriesUrl(
  apiKey: string,
  statCode: string,
  itemCode: string,
  cycle: 'D' | 'M',
  start: string,
  end: string,
  startRow: number,
  endRow: number,
): string {
  return (
    `https://ecos.bok.or.kr/api/StatisticSearch/${apiKey}/json/kr` +
    `/${startRow}/${endRow}/${statCode}/${cycle}` +
    `/${isoToCompact(start, cycle)}/${isoToCompact(end, cycle)}/${itemCode}`
  );
}

export function parseEcosResponse(json: unknown): EcosSeries {
  const asError = errorSchema.safeParse(json);
  if (asError.success) {
    const { CODE, MESSAGE } = asError.data.RESULT;
    throw new Error(`ECOS 오류 ${CODE}: ${MESSAGE}`);
  }

  const parsed = successSchema.parse(json);

  const dates: string[] = [];
  const values: number[] = [];

  for (const row of parsed.StatisticSearch.row) {
    // 빈 문자열이나 변환 불가능한 값은 제외한다
    if (!row.DATA_VALUE) continue;
    const value = Number(row.DATA_VALUE);
    if (!Number.isFinite(value)) continue;
    dates.push(compactToIso(row.TIME));
    values.push(value);
  }

  return { dates, values };
}
