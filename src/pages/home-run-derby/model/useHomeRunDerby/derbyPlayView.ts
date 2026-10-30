import type { DerbyBattedBall } from '@/entities/home-run-derby/model/derbyBattedBall'
import { isBigFlyPattern } from '@/entities/home-run-derby/model/eventZone'
import { isBigHitWatch } from '@/entities/batting/model/bigHitWatch'
import { derbyFieldTimelineOf, type DerbyFieldInput, type DerbyFieldTimeline } from '@/pages/home-run-derby/lib/derbyField'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { derbyHomeRunTextOn, homeRunTextAfterDraws, type HomeRunTextState, type HomeRunTextWindow } from '@/widgets/batting-stage/lib/homeRunBanner'

/**
 * **더비 홈런의 HOMERUN 글자 창** — 홈런 갈래 0x5279a~0x527ac 는 +0x1961(단계) = 0 · +0x1960 = 1 만 쓴다(`derbyHomeRunTextOn`).
 * 글자는 0x17 그리기 0x46c88 이 `관문 0xb0d28 열림 && state[0x1d]` 일 때 부르는 0x40b18 이 그리므로 **홈런 틱 h … 관문이 닫히기 전 틱**에만
 * 보이고(그 뒤 10틱은 안 그림), 키 건너뛰기(0x519cc)는 그 그림의 갱신보다 먼저 +0x1960 = 0 이라 키 틱 k 의 그림부터 없다.
 * 폴 뒤 담장선에서 홈런 갈래를 한 번 더 지나면 그 틱에 단계가 다시 0 이다. `scene` = 앞 연출이 남긴 칸(+0x1963 · +0x1962 · 글자 칸).
 * `startedAt` = 판을 넘겨받은 시각(공 틱 0). 홈런이 아니면 창이 없고 칸도 그대로다.
 */
export function derbyHomeRunTextOf(
  batted: DerbyBattedBall,
  startedAt: number,
  scene: HomeRunTextState,
  millisecondsPerTick: number,
): { readonly window: HomeRunTextWindow | null; readonly after: HomeRunTextState } {
  const homeRunTick = batted.homeRunTicks[0]
  if (homeRunTick === undefined) return { window: null, after: scene }
  const lastDrawTick = (batted.skippedAtTick ?? batted.closeTick) - 1
  const draws = Math.max(0, lastDrawTick - homeRunTick + 1)
  const restartDraws = batted.homeRunTicks
    .slice(1)
    .filter((tick) => tick <= lastDrawTick)
    .map((tick) => tick - homeRunTick + 1)
  const on = derbyHomeRunTextOn(scene)
  return {
    window: {
      startedAt: startedAt + homeRunTick * millisecondsPerTick,
      endsAt: startedAt + (lastDrawTick + 1) * millisecondsPerTick,
      on,
      restartDraws,
    },
    after: homeRunTextAfterDraws(on, draws, restartDraws).state,
  }
}

/**
 * **비거리 판 0x36cd4** 이 지금 보는 판 — 0x17 그리기 0x46c88(0x46cb6)이 플레이+0x118 == 8(더비 판) 이면 판 내내 그린다.
 * 숫자는 표시 비거리 +0x36 이라 공이 나는 동안 틱마다 따라 오른다(`derbyDisplayDistanceAt`, `previous` = 앞 공이 남긴 값).
 */
export interface DerbyDistanceBoard {
  /** 판을 넘겨받은 시각(공 틱 0) — `gameSceneNow()` 기준 ms */
  readonly startedAt: number
  readonly batted: DerbyBattedBall
  /** 이 판이 다시 쓰기 전의 +0x36 */
  readonly previous: number
  /** 이 판의 필드 화면 재료 — 카메라 · 공 틱 · 이벤트 존 (`lib/derbyField`, A-01) */
  readonly field: DerbyFieldPlay
}

/** 판 하나의 필드 화면 — 재료와 미리 셈한 그림들 */
export interface DerbyFieldPlay {
  readonly input: DerbyFieldInput
  readonly timeline: DerbyFieldTimeline
}

/**
 * 판 하나의 필드 화면을 셈한다 — 이벤트 존(0x36dfc 3726c~)도 여기서 정해진다. 난수를 안 쓴다.
 * 감상 플래그 +0x199a(0x392ac)는 판 공 [+0x204] 의 폴 틱 · 거리 눈금을 본다
 */
export function derbyFieldPlayOf(batted: DerbyBattedBall, detail: Pick<PitchOutcomeDetail, 'resultCode' | 'pattern'>): DerbyFieldPlay {
  const input: DerbyFieldInput = {
    batted,
    resultCode: detail.resultCode,
    isBigFlyPattern: detail.pattern != null && isBigFlyPattern(detail.pattern),
    watchesBigHit: isBigHitWatch({
      resultCode: detail.resultCode,
      poleTick: batted.trajectory.poleTick,
      carryScale: batted.trajectory.carryScale ?? 0,
    }),
  }
  return { input, timeline: derbyFieldTimelineOf(input) }
}
