import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { parseManifest } from './manifest';
import { PRODUCTS } from './catalog';
import { DATA_FORMAT_VERSION } from './version';

const VALID = {
  formatVersion: 3,
  generatedAt: '2026-08-16T00:00:00.000Z',
  startDate: '1995-01-03',
  dates: ['1995-01-03', '1995-01-04'],
  fx: { file: 'fx.bin', length: 2 },
  diningCpi: [{ itemId: 'gukbap', file: 'cpi-gukbap.bin', length: 2 }],
  products: [
    {
      id: 'QQQ',
      ticker: 'QQQ',
      displayName: '어긋난 이름',
      exposure: 'NASDAQ100_1X',
      listedAt: '1999-03-10',
      expenseRatio: 0.002,
      availableFrom: '1995-01-03',
      syntheticUntil: '1999-03-09',
      length: 2,
      filledGapDays: 0,
    },
  ],
};

describe('parseManifest', () => {
  it('데이터 파생 사실만 남기고 카탈로그와 중복되는 필드는 버린다', () => {
    const parsed = parseManifest(VALID);
    const product = parsed.products[0];

    expect(product.id).toBe('QQQ');
    expect(product.availableFrom).toBe('1995-01-03');
    expect(product.syntheticUntil).toBe('1999-03-09');
    expect(product.filledGapDays).toBe(0);
    // 카탈로그가 단일 진실 소스이므로 파싱 결과에 남지 않는다
    expect(Object.keys(product)).toEqual([
      'id',
      'availableFrom',
      'syntheticUntil',
      'length',
      'filledGapDays',
    ]);
  });

  it('formatVersion이 다르면 던진다', () => {
    expect(() => parseManifest({ ...VALID, formatVersion: 1 })).toThrow(
      /포맷 버전/,
    );
  });

  it('필수 필드가 없으면 던진다', () => {
    const { dates: _dates, ...withoutDates } = VALID;
    expect(() => parseManifest(withoutDates)).toThrow();
  });
});

describe('카탈로그와 산출물의 정합성', () => {
  const metaPath = path.join(process.cwd(), 'public', 'data', 'meta.json');
  const ready = fs.existsSync(metaPath);

  it.skipIf(!ready)('meta.json의 중복 필드가 catalog.ts와 일치한다', () => {
    const raw: unknown = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    const schema = z.object({
      products: z.array(
        z.object({
          id: z.string(),
          ticker: z.string(),
          displayName: z.string(),
          exposure: z.string(),
          listedAt: z.string(),
          expenseRatio: z.number(),
        }),
      ),
    });
    const parsed = schema.parse(raw);

    for (const meta of parsed.products) {
      const product = PRODUCTS.find((p) => p.id === meta.id);
      expect(product).toBeDefined();
      expect(meta.ticker).toBe(product?.ticker);
      expect(meta.displayName).toBe(product?.displayName);
      expect(meta.exposure).toBe(product?.exposure);
      expect(meta.listedAt).toBe(product?.listedAt);
      expect(meta.expenseRatio).toBe(product?.expenseRatio);
    }
  });

  it.skipIf(!ready)('meta.json에 설렁탕 CPI 산출물이 있다', () => {
    const parsed = parseManifest(JSON.parse(fs.readFileSync(metaPath, 'utf-8')));
    const seolleongtang = parsed.diningCpi.find((c) => c.itemId === 'seolleongtang');
    expect(seolleongtang).toBeDefined();
    expect(seolleongtang?.length).toBe(parsed.dates.length);
  });

  it.skipIf(!ready)('meta.json이 현재 포맷 버전으로 재생성돼 있다', () => {
    const parsed = parseManifest(JSON.parse(fs.readFileSync(metaPath, 'utf-8')));
    expect(parsed.formatVersion).toBe(DATA_FORMAT_VERSION);
    expect(parsed.fx.length).toBe(parsed.dates.length);
  });
});
