import {
  type HomeRunTextFrame,
  type HomeRunTextState,
  derbyHomeRunTextOn,
  drawHomeRunTextOnce,
} from '@/widgets/batting-stage/lib/homeRunBanner/homeRunText'

/**
 * 켠 칸(`…HomeRunTextOn`)에서 그림을 `draws` 번 그린 결과 — 마지막 그림(`draws ≥ 1`)과 그린 뒤의 칸.
 * `draws` 가 0 이면 그림 없이 켠 칸 그대로다. `restartDraws` 의 그림(1 부터 센 차례) 앞에서는 단계를 0 으로 되돌린다 —
 * 같은 판에서 홈런 갈래를 한 번 더 지난 틱(더비의 폴 뒤 담장선, 0x5279a 가 +0x1961 = 0 을 다시 쓴다)이다.
 */
export function homeRunTextAfterDraws(
  on: HomeRunTextState,
  draws: number,
  restartDraws: readonly number[] = [],
): { readonly frame: HomeRunTextFrame | null; readonly state: HomeRunTextState } {
  let state = on
  let frame: HomeRunTextFrame | null = null
  for (let draw = 0; draw < draws; draw += 1) {
    if (restartDraws.includes(draw + 1)) state = derbyHomeRunTextOn(state)
    const drawn = drawHomeRunTextOnce(state)
    frame = drawn.frame
    state = drawn.next
  }
  return { frame, state }
}

/**
 * 부르는 쪽이 모는 HOMERUN 글자 창 — 홈런더비처럼 글자를 켜는 때(홈런 틱)와 그리기가 멈추는 때(관문이 닫힌 틱 · 키 건너뛰기)를
 * 진행기가 아는 화면이 넘긴다. 시각은 경기 장면 시계(`gameSceneNow()`) 기준 ms.
 */
export interface HomeRunTextWindow {
  /** 첫 그림 시각 */
  readonly startedAt: number
  /** 이 시각부터는 안 그린다(관문이 닫혀 0x40b18 이 안 불린다 · 키 건너뛰기가 +0x1960 을 끈다). null 이면 끝 없음 */
  readonly endsAt: number | null
  /** 켠 칸 (`derbyHomeRunTextOn` · `generalHomeRunTextOn`) */
  readonly on: HomeRunTextState
  /** 단계를 0 으로 되돌리는 그림 차례(1 부터) — `homeRunTextAfterDraws` */
  readonly restartDraws?: readonly number[]
}

/** 시각 `now` 의 그림 — 창 밖이면 null. 그림 수 = 첫 그림부터 흐른 틱 + 1 */
export function homeRunTextFrameAt(window: HomeRunTextWindow, now: number, millisecondsPerTick: number): HomeRunTextFrame | null {
  if (now < window.startedAt) return null
  if (window.endsAt !== null && now >= window.endsAt) return null
  const draws = Math.floor((now - window.startedAt) / millisecondsPerTick) + 1
  return homeRunTextAfterDraws(window.on, draws, window.restartDraws).frame
}
