import type { CatchTable, ChaseChoice } from '@/entities/fielding/model/catchPrediction'
import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'

export interface CatchForecast {
  readonly table: CatchTable
  readonly choice: ChaseChoice
  /** 표 전체에서 가장 이른 포구 틱 (플레이 +0x11c). 없으면 0xffff */
  readonly earliestCatchTick: number
  /** 포구 지점 */
  readonly point: WorldPoint
  /**
   * **담장 갈래 0xb3e5c~0xb3ebc** — 공이 담장선을 먼저 넘으면(공+0xaa4 ≠ −1 && aa4 < min(땅볼, 가슴, 낮은 공 틱)) 고른 야수는
   * AI 0xb 로 공점(aa4 − 2)의 (x, 0, z) 에 간다(+0x90). 점프 · 슬라이딩 틱은 최소에 안 든다. 아니면 null
   */
  readonly fenceChasePoint: WorldPoint | null
  /**
   * 두 번째 패스(b1878)로 넘어갔나 — 그 자리 b188a~b1892 가 **공 가진 야수(+0x130, 0xb0c90)의 +0xc0 = 4** 를 적는다.
   * 그림 0x438c4 의 "!"(애니 13)만 본다. `secondPass` 를 안 준 예보(a = 1)는 늘 거짓
   */
  readonly secondPassStarted: boolean
  /**
   * **움직임 허용 +0x13c[칸]** (r196, 직접 뜬 것) — 예보 머리 b1376~b1398 이 아홉 칸 모두 `a ≠ 0 || 공+0xaac ≠ 0`(악송구 · 원바운드)로
   * 적고, 두 번째 패스 b189a~b18b4 가 모두 1 로 고친다. 플레이 객체 칸이라 다음 예보까지 남는다 — 추적야수 AI 1(b4af6)이 0 이면 목표를
   * 안 고친다(보통 송구를 받는 야수). `secondPass` 를 안 준 예보(a = 1)는 늘 참
   */
  readonly movable: boolean
  /**
   * **다이빙 후보 틱 +0x178[칸]** (b15e4~b1642, 직접 뜬 것 — r180): 예보 머리 b130c~b1334 가 아홉 칸을 1000(+0x19c 거리는 9999)으로
   * 채우고, 판정 갈래(잠금 · vtc8 관문 뒤 b14d0)에서 `공 첫 점 0xa25b0(공, 0) == 0xd8758 (20000, 1000, 30000)`(0xbc0f4 — 세 칸 같음) &&
   * h ≤ 500 && 1000 < d ≤ 2000 && d < +0x19c[칸] 이면 +0x178[칸] = t · +0x19c[칸] = d (d 는 포구 판정과 같은 값 — 정지면 220 × n 을 뺀 것).
   * 판정보다 앞이라 +0x1e8(지정 야수) 모드에 안 닫힌다. 웹 틱 구간(`window`)과도 상관없다. 없으면 1000 — `DIVE_TICK_NONE`
   */
  readonly diveTicks: readonly number[]
  /**
   * **고르기 0xb3b38 의 백업 갈래 b3ebe~b3f62** (직접 뜬 것, r180): 담장 갈래(`fenceChasePoint`)가 아니고 고른 야수가 외야(칸 6~8 —
   * 0xb8da8 `+0x88 − 6 ≤ 2`)면, 칸 5~8 중 외야이고 고른 야수가 아닌 야수 가운데 위치(+0x20)와 낮은 공 점 Q(sp+0x74 — `nearestSlotTo`
   * 의 점) 맨해튼 거리(0xbfa2c = |dx| + |dz|)가 가장 짧은(처음 최소 400000, `<`) 야수 하나를 AI 0xc(백업)로. 없으면 −1. 목표는 안 바꾼다 —
   * AI 고리 b4b78 이 매 틱 정한다(`backupPointOf`)
   */
  readonly backupSlot: number
}

/** +0x178[칸] 의 빈 값 (b1314 `#0xfa << 2`) — AI 고리 b46fa 가 1000 이면 다이빙 검사를 건너뛴다 */
export const DIVE_TICK_NONE = 1000

export interface CatchForecastOptions {
  /** 필살 점프 창 (플레이 +0x1f5) — `rollSpecialDefense` 의 A 굴림이 성공했을 때만 선다 */
  readonly jumpUnlocked?: boolean
  /** 필살 슬라이딩 창 (플레이 +0x1f6) — B 굴림 */
  readonly slideUnlocked?: boolean
  /** 지정 야수만 잡게 하는 모드 (플레이 +0x1e8 · +0x154) */
  readonly onlySlot?: number
  /**
   * 표를 만들 때의 추적야수 +0x130 — **타구 시작(0xb280a)에서는 1(포수)** 이고,
   * 원본은 그 야수만 `t ≤ 4` 동안 건너뛴다 (P2 2a `if j == 추적야수 && t ≤ 4 : 건너뜀`).
   * 그 가드가 "포수가 홈플레이트 위 타구를 그 자리에서 주워 버리는 것" 을 막는다.
   */
  readonly initialChaserSlot?: number
  /**
   * **플레이 +0x127** — 타구 시작 0x51408 이 0 으로 비운 뒤 뽑은 패턴이 `0xb07c8 == 1`(패턴 플래그 비트 1)이면 세운다
   * (0x514e6), 쥐기 0xb2710 이 지운다. 서 있으면 낙구 틱까지 복제가 낙구 지점으로 **실제로 달린다**(b1416).
   */
  readonly chaseToLanding?: boolean
  /**
   * **인자 a = 0** (송구 0xb2e38 의 vt24(0), b307c) — 움직임허용[j] = `a ≠ 0 || 공+0xaac ≠ 0`(b1376~b138c)이고,
   * 궤적 끝(t == 공+0x6c, b1878)까지 남은틱이 안 끝나면 두 번째 패스: 추적야수 +0xc0 = 4 · 공+0xaac = 1 · a = 1 ·
   * 움직임허용 모두 1 · **t = 10 부터 다시**(n · 복제 · 표는 그대로, b1888~b18ba). 안 주면 a = 1(타구 · 다시 쏘기).
   */
  readonly secondPass?: { readonly movable: boolean }
  /**
   * 방금 던진 야수 — 던지기 0xa1620 끝(a1a3a)이 +0xb1 = 1 을 세워 복제의 vtc8 이 거짓이다. 야수 틱 0xa1284 는 동작(+0xa8)이
   * 14~18 이 아니면 a1406~a141a 에서 `vtc8()` 이 거짓일 때 곧장 a143e 로 가 +0xb0~+0xb3 을 지우고 vt10(0xa124c — 목표 = 위치 ·
   * 동작 0)을 부른다. 이동(a1346)은 그 앞이라 **첫 복제 틱**은 판정도 걸음도 없고, 둘째 복제 틱부터 풀린다(U-78, 에뮬 확인 —
   * 동작 5 · +0xac 0 · +0xb1 1 로 한 번 돌리면 +0xb1 = 0 · 동작 0 · 위치 그대로). +0xac == 2(a13ae)는 잠기지 않은 야수의 갈래다.
   * vt10 이 복제 목표를 제 위치로 두므로 움직임허용이 아닌 패스에서 던진 야수의 복제는 그 뒤 제자리다.
   */
  readonly thrownSlot?: number
}

/** 0xb3b60 — 표가 비었을 때의 틱 100000 */
export const NO_LOW_TICK = 100_000
