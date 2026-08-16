import { z } from 'zod';
import { DATA_FORMAT_VERSION } from './version';

/**
 * meta.json에서 클라이언트가 읽어도 되는 것만 남긴 스키마.
 *
 * displayName·expenseRatio·listedAt·exposure·market·ticker는 catalog.ts에도 있다.
 * 두 곳을 다 읽으면 값이 어긋났을 때 어느 쪽이 맞는지 알 수 없으므로,
 * 여기서 아예 버려서 클라이언트가 catalog.ts만 보게 만든다 (계획 D1).
 * 남기는 것은 빌드가 계산해낸, 카탈로그로 옮길 수 없는 사실뿐이다.
 */
const ProductDataFactsSchema = z
  .object({
    id: z.string(),
    availableFrom: z.string(),
    syntheticUntil: z.string().nullable(),
    length: z.number().int().nonnegative(),
    filledGapDays: z.number().int().nonnegative(),
  })
  .strip();

const ManifestSchema = z.object({
  formatVersion: z.number().int(),
  startDate: z.string(),
  dates: z.array(z.string()).min(1),
  fx: z.object({
    file: z.string(),
    length: z.number().int().nonnegative(),
  }),
  products: z.array(ProductDataFactsSchema).min(1),
});

export type ProductDataFacts = z.infer<typeof ProductDataFactsSchema>;
export type ParsedManifest = z.infer<typeof ManifestSchema>;

export function parseManifest(json: unknown): ParsedManifest {
  const manifest = ManifestSchema.parse(json);

  if (manifest.formatVersion !== DATA_FORMAT_VERSION) {
    throw new Error(
      `산출물 포맷 버전이 맞지 않습니다: 기대 ${DATA_FORMAT_VERSION}, 실제 ${manifest.formatVersion}. npm run build-data 를 다시 실행하세요.`,
    );
  }

  return manifest;
}
