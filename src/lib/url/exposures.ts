import { PRODUCTS } from '../data/catalog';
import type { IndexExposure } from '../data/types';

/** 한 번에 비교할 수 있는 노출 개수 상한 — 차트 색상 팔레트(scenarioColor)와
 *  요약 카드 2열 그리드가 감당하는 수다. */
export const MAX_EXPOSURES = 4;

/** 카탈로그(PRODUCTS)가 노출↔상품 1:1이라 노출 목록은 카탈로그에서 그대로 뽑아낸다 —
 *  두 곳에 같은 노출 목록을 따로 나열하면 상품이 추가·삭제될 때 한쪽만 갱신되는
 *  사고가 난다. */
export const V1_AVAILABLE_EXPOSURES: readonly IndexExposure[] = PRODUCTS.map((p) => p.exposure);
const V1_EXPOSURE_SET = new Set<string>(V1_AVAILABLE_EXPOSURES);

export const DEFAULT_EXPOSURE: IndexExposure = 'NASDAQ100_1X';

const CATALOG_ORDER = new Map<IndexExposure, number>(
  V1_AVAILABLE_EXPOSURES.map((exposure, index) => [exposure, index]),
);

/**
 * 노출 배열을 항상 카탈로그 순서(= ExposureSelector가 체크박스를 늘어놓는 순서)로
 * 세운다.
 *
 * 고른 순서를 그대로 두면 "나스닥 2배 → 3배 → 1배" 순으로 체크했을 때 요약 카드와
 * 차트 범례도 그 순서로 나와, 같은 조합인데도 클릭 순서에 따라 화면이 달라 보인다.
 * 레버리지 배수처럼 자연 순서가 있는 목록에서는 특히 읽기 나쁘다.
 *
 * 정렬을 URL 경계(파싱·토글)에서 한 번만 하는 이유: URL이 단일 진실 소스이므로
 * 여기서 세워두면 아래쪽(요약 카드·차트·범례)은 아무것도 몰라도 순서가 맞는다.
 * 화면마다 각자 정렬하면 한 곳을 빠뜨렸을 때 서로 다른 순서로 보인다.
 */
function sortByCatalogOrder(exposures: readonly IndexExposure[]): IndexExposure[] {
  return [...exposures].sort(
    (a, b) => (CATALOG_ORDER.get(a) ?? 0) - (CATALOG_ORDER.get(b) ?? 0),
  );
}

export function isIndexExposure(value: string): value is IndexExposure {
  return V1_EXPOSURE_SET.has(value);
}

const SEPARATOR = ',';

/**
 * `exp` 쿼리값 → 노출 배열. 단일 값(`exp=SP500_3X`)도 그대로 통과하므로 탭 시절의
 * 공유 링크가 깨지지 않는다.
 *
 * 무효한 값은 기본값으로 치환하지 않고 버린다 — 치환하면 중복이 생겨 같은 상품을
 * 두 번 비교하게 된다. 단일 노출을 파싱하던 시절의 "무효하면 기본값" 규칙을 배열에
 * 그대로 쓸 수 없는 이유다. 전부 무효하면 그때 기본 노출 하나로 폴백한다
 * (§11 "에러 화면을 띄우지 않는다").
 */
export function parseExposures(raw: string | null): IndexExposure[] {
  if (raw === null || raw === '') return [DEFAULT_EXPOSURE];

  const parsed = [
    ...new Set(
      raw
        .split(SEPARATOR)
        .map((value) => value.trim())
        .filter(isIndexExposure),
    ),
  ];

  // 상한을 자른 뒤에 정렬한다 — 먼저 정렬하면 5개 이상을 담은 링크에서 "앞의 4개"가
  // 사용자가 고른 4개가 아니라 카탈로그 앞쪽 4개로 바뀐다.
  return parsed.length === 0
    ? [DEFAULT_EXPOSURE]
    : sortByCatalogOrder(parsed.slice(0, MAX_EXPOSURES));
}

export function serializeExposures(exposures: readonly IndexExposure[]): string {
  return exposures.join(SEPARATOR);
}

/**
 * 체크박스 토글. 마지막 하나는 해제할 수 없고(비교 대상이 0개면 계산할 게 없다),
 * 상한을 넘는 추가는 무시한다.
 *
 * 두 규칙을 UI가 아니라 여기서 지키는 이유: URL이 단일 진실 소스이므로 잘못된
 * 배열이 URL에 들어가는 경로 자체를 막아야 한다. UI는 왜 비활성인지만 알린다.
 */
export function toggleExposure(
  current: readonly IndexExposure[],
  exposure: IndexExposure,
): IndexExposure[] {
  if (current.includes(exposure)) {
    return current.length <= 1 ? [...current] : current.filter((e) => e !== exposure);
  }
  return current.length >= MAX_EXPOSURES
    ? [...current]
    : sortByCatalogOrder([...current, exposure]);
}
