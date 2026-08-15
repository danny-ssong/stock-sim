import { z } from 'zod';

export type RawSeries = {
  symbol: string;
  dates: string[];
  close: number[];
  adjClose: number[];
};

const chartSchema = z.object({
  chart: z.object({
    result: z.array(
      z.object({
        meta: z.object({ symbol: z.string() }),
        timestamp: z.array(z.number()),
        indicators: z.object({
          quote: z.array(
            z.object({ close: z.array(z.number().nullable()) }),
          ),
          adjclose: z
            .array(z.object({ adjclose: z.array(z.number().nullable()) }))
            .optional(),
        }),
      }),
    ),
  }),
});

/** UNIX 초를 UTC 기준 YYYY-MM-DD로 변환한다. */
function toIsoDate(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString().slice(0, 10);
}

export function yahooChartUrl(symbol: string): string {
  const encoded = encodeURIComponent(symbol);
  return (
    `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}` +
    `?period1=0&period2=9999999999&interval=1d&events=div%7Csplit`
  );
}

export function parseYahooChart(json: unknown): RawSeries {
  const parsed = chartSchema.parse(json);
  const [result] = parsed.chart.result;

  if (!result) throw new Error('Yahoo 응답의 결과가 비어 있습니다');

  const [quote] = result.indicators.quote;
  if (!quote) throw new Error('Yahoo 응답에 quote가 없습니다');

  // 지수 심볼은 adjclose가 없다. 이 경우 close를 총수익으로 간주한다.
  const adjRaw = result.indicators.adjclose?.[0]?.adjclose ?? quote.close;

  const dates: string[] = [];
  const close: number[] = [];
  const adjClose: number[] = [];

  for (let i = 0; i < result.timestamp.length; i += 1) {
    const c = quote.close[i];
    const a = adjRaw[i];
    if (c === null || c === undefined) continue;
    if (a === null || a === undefined) continue;

    dates.push(toIsoDate(result.timestamp[i]));
    close.push(c);
    adjClose.push(a);
  }

  return { symbol: result.meta.symbol, dates, close, adjClose };
}
