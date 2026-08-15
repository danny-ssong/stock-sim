# personal-finance — 한국 투자 시뮬레이터

국내 투자자가 미국 지수 ETF(나스닥100/S&P500, 1~3배 레버리지, 배당 ETF)를 해외 직접투자 · 국내 상장 ETF · ISA 계좌 중 어디에 담을지 비교하고, 미래 설계·과거 백테스트·시나리오 비교를 계산해 보여주는 프로젝트다. 계산은 전부 클라이언트에서 수행하며(백엔드 DB 없음, 상태는 URL), 이 저장소가 담당하는 부분은 그 계산이 읽는 **원화 환산 총수익 시계열 데이터 파이프라인**이다 — 원천 데이터 수집(Yahoo Finance, 한국은행 ECOS) → 날짜 축 정렬 → 레버리지 상품의 상장 이전 구간 합성(백필) → 바이너리 산출물(`public/data/`) 생성까지를 다룬다.

## 실행 순서

```bash
# 1. 의존성 설치
npm install

# 2. 한국은행 ECOS API 키 발급 (https://ecos.bok.or.kr, 무료)
#    발급받은 키를 .env.local에 기입한다. .env.example 참고.
cp .env.example .env.local
# ECOS_API_KEY=발급받은키

# 3. 원천 데이터 수집 (Yahoo Finance + ECOS)
#    ⚠️ 외부 API를 호출하므로 무분별하게 반복 실행하지 않는다.
npm run fetch-raw

# 4. 수집한 원천 데이터로 산출물(public/data/) 생성
#    data/raw/의 캐시만 읽으므로 자유롭게 재실행 가능하다.
npm run build-data

# 5. 테스트
npm test
```

## `data/raw/`는 커밋되지 않는다

`data/raw/`(Yahoo Finance 응답 캐시, ECOS 환율 응답)는 `.gitignore` 대상이다. 언제든 `npm run fetch-raw`로 재수집할 수 있는 원천이기 때문이다. 대신 `npm run build-data`가 만드는 `public/data/`는 **git에 커밋한다** — 배포 환경이 매번 `fetch-raw`를 돌리지 않고도 최신 산출물을 서빙할 수 있어야 하기 때문이다.

새로 클론한 환경에서 원천 데이터 없이도 돌아가야 하는 검증(예: 커밋된 산출물의 불변식 확인, `src/lib/data/artifacts.test.ts`)은 `data/raw/`가 아니라 `public/data/`를 직접 읽는다.

## `public/data/` 포맷

- 상품별 `{id}.bin` — 가격 값 자체를 담은 **`Float32Array`(리틀엔디언) 바이너리**. JSON 대비 약 1/5 크기다. 계산은 정밀도를 위해 `Float64Array`로 하고, 저장 시에만 `Float32Array`로 줄인다(`src/lib/data/binary.ts`).
- `meta.json` — 상품 메타데이터 배열(`DataManifest`, `src/lib/data/build.ts`)

`.bin`의 값은 **원화 환산 총수익 지수 레벨**이다. 절대 수준 자체에는 의미가 없고, 두 시점의 비율(수익률·성장 배수)로만 해석해야 한다. 미국 상장 상품은 원화 환율을 곱해 두었고, 국내 상장 상품은 이미 원화 표시다.

`meta.json`의 상품별 주요 필드:

| 필드 | 의미 |
|---|---|
| `availableFrom` | 이 날짜부터 유효한 값이 있다는 뜻. 이전 구간은 상장 전(또는 백필 대상이 아님)이라 NaN이다 |
| `syntheticUntil` | 합성(백필)된 구간의 마지막 날짜. 백필하지 않은 상품은 `null` |
| `filledGapDays` | 거래일 축(미국 기준)과 실제 상장 시장의 휴장일이 어긋나 생긴 내부 결측을, 직전 유효값으로 전진 채움한 일수. 국내 상장 상품에서 특히 크다(한국 공휴일이 미국 거래일 축의 구멍이 되므로). 0이면 결측이 없었다는 뜻이고, 이 필드가 있다고 값이 왜곡됐다는 뜻은 아니다 — 보정 사실을 감추지 않기 위해 항상 기록한다 |

## 문서

- 설계 스펙(최종 권위): `docs/superpowers/specs/2026-08-14-investment-simulator-design.md`
- 데이터 파이프라인 구현 계획: `docs/superpowers/plans/2026-08-15-data-pipeline.md`
