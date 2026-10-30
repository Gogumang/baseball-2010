import { gameSceneTickNow } from '@/shared/lib/commonWindow/commonWindow'

/**
 * **키를 누를 때 화면에 있던 그림의 틱** — 웹판 전용 (r211).
 *
 * 원본은 틀마다 갱신하고 한 번 그린 뒤 다음 틀까지 쉰다. 키 콜백은 그 쉬는 사이에 와서 받은 칸에 적히고(0x39f4c), 다음 틀 머리가
 * 읽는다(`sceneKeyLatch`). 그래서 키를 받은 틀 = **마지막으로 그린 틀** = 누른 사람이 본 그림이다 — 스윙 키 틱 F = 보이던 공 틱 + 1
 * (`keyTickOf`)의 "보이던" 이 이것이다.
 *
 * 웹의 장면 틱은 실제 시각에서 센다(`gameSceneTickOf`). 그리기(requestAnimationFrame)가 밀리면(느린 기기 · 30Hz 절전 · 무거운 틀) 시각으로는
 * 이미 다음 틱인데 화면은 아직 앞 틱 그림이다. 또 주 스레드가 바쁘면 키 사건 손잡이가 늦게 돌아, 그 사이 새 그림이 한 장 더 그려진다.
 * 손잡이에서 지금 틱(`gameSceneTickNow`)을 읽으면 본 그림보다 한두 틱 늦게 센다 — 사람은 그림을 보고 눌렀는데 판정은 늦게 누른 것이 된다
 * (한 틱 늦으면 타이밍 100 → 79, 두 틱이면 판정 없음 — r209).
 *
 * 그래서 루프가 그린 그림마다 (그린 시각, 그 그림의 장면 틱)을 적어 두고(`mark`), 키는 **사건이 난 시각**(`inputTimeOf`) 앞에 마지막으로
 * 그린 그림의 틱으로 센다(`tickSeenAt`). 원본의 "받은 틀 = 마지막으로 그린 틀" 과 같은 셈이다. 그림 기록이 없으면(루프 전 · 시험) 지금 틱이다.
 *
 * **화면에 나온 시각 보정 (r406, 웹 표시 보정 — 원본 판정식 · 난수는 그대로)**: 다 그린 그림(캔버스 · React 커밋)은 그 자리에서 보이지 않고
 * 다음 화면 갱신(vsync) 때 나온다. 그린 시각부터 센다면 그 사이(한 화면 틀 안)에 누른 키는 사람이 아직 못 본 새 그림으로 세어져 한 틱 늦게
 * 판정된다(최적 창이 한 틱뿐이라 100 → 70). 그래서 그린 시각에 한 화면 틀(`PRESENT_DELAY_MS`)을 더한 때부터 그 그림이 보인 것으로 센다 —
 * 같은 누름이 사람이 본 앞 그림 틱으로 세어질 뿐 판정 차례는 같다. 120Hz 화면에서는 반 틀 일찍 나오지만, 새 그림을 보고 8ms 안에 누를 수는
 * 없으니 앞 그림으로 세는 편이 맞다.
 */
export interface ShownSceneTicks {
  /** 장면 틱 `tick` 의 그림을 실제 시각 `at`(`performance.now()` 기준)에 다 그렸다 — 화면에는 `at + PRESENT_DELAY_MS` 에 나온다 */
  readonly mark: (tick: number, at?: number) => void
  /**
   * 실제 시각 `inputTime` 에 화면에 있던 그림의 틱 — 그 앞에 마지막으로 화면에 나온 그림. 없거나 너무 오래됐으면(`MAX_SEEN_LAG_TICKS`) `nowTick`.
   * `nowTick`(지금 장면 틱)보다 뒤일 수는 없다
   */
  readonly tickSeenAt: (inputTime: number, nowTick: number) => number
  /** 기록을 비운다 — 루프가 내려가거나 처음부터 다시 셀 때 */
  readonly clear: () => void
}

/** 적어 두는 그림 수 — 60Hz 에서 0.5초 남짓. 키 손잡이가 이보다 늦게 도는 일은 없다 */
const SHOWN_LIMIT = 32
/** 본 그림이 지금 틱보다 이만큼 넘게 앞이면 기록이 낡은 것으로 본다(루프가 오래 섰다) — 지금 틱으로 센다 */
export const MAX_SEEN_LAG_TICKS = 8
/** 다 그린 그림이 화면에 나오기까지 — 다음 화면 갱신(60Hz 한 틀). 위 머리말의 "화면에 나온 시각 보정" */
export const PRESENT_DELAY_MS = 1000 / 60

export function createShownSceneTicks(): ShownSceneTicks {
  let shown: { readonly shownAt: number; readonly tick: number }[] = []
  return {
    mark: (tick, at = performance.now()) => {
      shown.push({ shownAt: at + PRESENT_DELAY_MS, tick })
      if (shown.length > SHOWN_LIMIT) shown = shown.slice(-SHOWN_LIMIT)
    },
    tickSeenAt: (inputTime, nowTick) => {
      for (let index = shown.length - 1; index >= 0; index -= 1) {
        const entry = shown[index]
        if (entry === undefined || entry.shownAt > inputTime) continue
        if (nowTick - entry.tick > MAX_SEEN_LAG_TICKS) return nowTick
        return Math.min(entry.tick, nowTick)
      }
      return nowTick
    },
    clear: () => {
      shown = []
    },
  }
}

/**
 * **경기 장면 그림 기록(하나뿐)** — 장면 그림과 그 위 입력 부품이 따로 선 자리를 위한 칸 (r217).
 * 투수편 장면(`PitcherSideStage`)이 그림마다 적고, 그 위에 서는 투구 게이지(`PitchGradeGauge`) · 조준(`AimCursor`)이 키를 받은 틱을
 * 여기서 센다 — 게이지 커서 · 조준점은 부품이 틱 시계로 올리고 그림은 장면이 그리므로, 사람이 본 것은 장면이 마지막으로 그린 그림이다.
 * 장면이 내려가면 비운다. 기록이 없으면(장면 없이 선 부품 · 시험) 지금 틱이다
 */
export const gameSceneShownTicks: ShownSceneTicks = createShownSceneTicks()

/** 실제 시각 `inputTime` 에 경기 장면 화면에 있던 그림의 틱(`gameSceneShownTicks`) — 기록이 없으면 지금 틱 */
export function gameSceneTickSeenAt(inputTime: number): number {
  return gameSceneShownTicks.tickSeenAt(inputTime, gameSceneTickNow())
}

/** 웹이 대신 쏜 키 사건(터치 버튼)의 진짜 누른 시각 — 손가락이 닿은 pointer 사건의 시각 */
const stampedTimes = new WeakMap<Event, number>()

/** 대신 쏘는 사건 `event` 에 진짜 누른 시각을 붙인다 (`widgets/touch-controls` 의 키 쏘기) */
export function stampInputTime(event: Event, time: number): void {
  stampedTimes.set(event, time)
}

/** 사건 시각이 이보다 오래 전이면 믿지 않는다(시각 바탕이 다른 환경) */
const MAX_INPUT_AGE_MS = 1000

/**
 * 키 · 누름 사건이 난 실제 시각(`performance.now()` 기준). `event.timeStamp` 는 주 스레드가 손잡이를 돌린 때가 아니라 사건이 난 때다.
 * 터치 버튼이 대신 쏜 사건은 붙여 둔 손가락 시각(`stampInputTime`). 시각 바탕이 다르거나(옛 브라우저 · 시험 DOM 의 Date 시각) 앞뒤가 안 맞으면 지금 시각
 */
export function inputTimeOf(event: Event | null | undefined, now: number = performance.now()): number {
  if (event === null || event === undefined) return now
  const stamped = stampedTimes.get(event)
  const time = stamped ?? event.timeStamp
  return isImplausibleInputTime(time, now) ? now : time
}

/** 사건 시각을 못 믿는가 — 수가 아니거나 0 이하 · 지금(+1ms)보다 뒤 · 너무 오래 전(시각 바탕이 다른 환경) */
function isImplausibleInputTime(time: number, now: number): boolean {
  return !Number.isFinite(time) || time <= 0 || time > now + 1 || now - time > MAX_INPUT_AGE_MS
}
