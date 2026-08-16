import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PRODUCTS, BACKFILL_START } from './catalog';
import { DATA_FORMAT_VERSION } from './version';
import { decodeSeries } from './binary';
import type { DataManifest } from './build';

/**
 * 커밋된 산출물(public/data/) 자체를 읽어 검증하는 불변식 테스트.
 *
 * data/raw/는 .gitignore 대상이라 CI가 재생성해 대조할 수 없다. public/data/는
 * git에 커밋되어 있으므로, 신규 클론이든 CI든 이 파일을 직접 읽는 것만이
 * 유일하게 항상 돌아가는 안전망이다. data/raw/ 원천이 없어도(=fetch-raw를
 * 돌리지 않아도) public/data/가 있으면 이 테스트는 항상 실행된다.
 */
const META_PATH = path.join(process.cwd(), 'public', 'data', 'meta.json');
const artifactsReady = fs.existsSync(META_PATH);

describe('산출물 불변식 (public/data/)', () => {
  it.skipIf(!artifactsReady)('formatVersion이 현재 포맷 버전과 일치한다', () => {
    const manifest: DataManifest = JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
    expect(manifest.formatVersion).toBe(DATA_FORMAT_VERSION);
  });

  it.skipIf(!artifactsReady)('products의 id 집합이 카탈로그와 정확히 일치한다', () => {
    const manifest: DataManifest = JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
    const manifestIds = new Set(manifest.products.map((p) => p.id));
    const catalogIds = new Set(PRODUCTS.map((p) => p.id));
    expect(manifestIds).toEqual(catalogIds);
  });

  it.skipIf(!artifactsReady)('모든 상품의 length가 dates.length와 같다', () => {
    const manifest: DataManifest = JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
    for (const product of manifest.products) {
      expect(product.length).toBe(manifest.dates.length);
    }
  });

  it.skipIf(!artifactsReady)('dates가 단조 증가하고 중복이 없다', () => {
    const manifest: DataManifest = JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
    for (let i = 1; i < manifest.dates.length; i += 1) {
      expect(manifest.dates[i] > manifest.dates[i - 1]).toBe(true);
    }
  });

  it.skipIf(!artifactsReady)('dates[0]이 BACKFILL_START와 같다', () => {
    const manifest: DataManifest = JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
    expect(manifest.dates[0]).toBe(BACKFILL_START);
  });

  it.skipIf(!artifactsReady)(
    '백필 대상 상품(backfillIndex !== null)은 availableFrom이 BACKFILL_START다 (백필 성공 보장)',
    () => {
      const manifest: DataManifest = JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
      for (const product of PRODUCTS) {
        if (product.backfillIndex === null) continue;
        const meta = manifest.products.find((p) => p.id === product.id);
        expect(meta).toBeDefined();
        expect(meta?.availableFrom).toBe(BACKFILL_START);
      }
    },
  );

  it.skipIf(!artifactsReady)(
    '백필하지 않는 상품(backfillIndex === null)은 syntheticUntil이 null이다 (스펙 §4.3 불변식)',
    () => {
      const manifest: DataManifest = JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
      for (const product of PRODUCTS) {
        if (product.backfillIndex !== null) continue;
        const meta = manifest.products.find((p) => p.id === product.id);
        expect(meta).toBeDefined();
        expect(meta?.syntheticUntil).toBeNull();
      }
    },
  );

  it.skipIf(!artifactsReady)('각 .bin 파일 크기가 length × 4와 같다', () => {
    const manifest: DataManifest = JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
    for (const product of manifest.products) {
      const binPath = path.join(process.cwd(), 'public', 'data', `${product.id}.bin`);
      const stat = fs.statSync(binPath);
      expect(stat.size).toBe(product.length * 4);
    }
  });

  it.skipIf(!artifactsReady)(
    '각 상품의 availableFrom 이후 구간에 NaN이 없다 (휴장일 전진 채움이 실제로 적용됐는지 확인)',
    () => {
      const manifest: DataManifest = JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
      for (const product of manifest.products) {
        const binPath = path.join(process.cwd(), 'public', 'data', `${product.id}.bin`);
        const buffer = fs.readFileSync(binPath);
        const values = decodeSeries(buffer);

        const startIndex = manifest.dates.indexOf(product.availableFrom);
        expect(startIndex).toBeGreaterThanOrEqual(0);

        let nanCount = 0;
        for (let i = startIndex; i < values.length; i += 1) {
          if (Number.isNaN(values[i])) nanCount += 1;
        }
        expect(nanCount, `${product.id}: availableFrom 이후 NaN ${nanCount}개`).toBe(0);
      }
    },
  );
});
