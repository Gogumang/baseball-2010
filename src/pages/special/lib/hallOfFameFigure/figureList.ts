import { isBugFixed } from '@/shared/config/bugfixes'
import { figureHandOf } from '@/pages/special/lib/hallOfFameFigure/figureLook'
import type { HallOfFameFigureLook } from '@/pages/special/lib/hallOfFameFigure/figureLook'
import {
  advanceBatterAnimation,
  advancePitcherAnimation,
  batterPoseOf,
  isSluggerForm,
  pitcherPoseOf,
  startAnimation,
} from '@/pages/special/lib/hallOfFameFigure/figureAnimation'
import type { FigureAnimation } from '@/pages/special/lib/hallOfFameFigure/figureAnimation'

/** 목록 객체 칸 — 화면을 건너 잇는다 */
export interface FigureListMemory {
  /** [목록+0x40c] 그린 수 */
  readonly draws: number
  /** [목록+0x208] 동작 머무름 */
  readonly hold: number
  /** [목록+0x204] 지금 자세 */
  readonly pose: number
}

export const INITIAL_FIGURE_LIST_MEMORY: FigureListMemory = { draws: 0, hold: 0, pose: 0 }

/** 진입마다 새로 만드는 것 — 그림 두 개 · 애니 두 개 · 다시 싣기 플래그 [목록+0x200] */
export interface FigureEntryState {
  readonly reload: boolean
  readonly slot: number | null
  readonly pitcher: HallOfFameFigureLook | null
  readonly batter: HallOfFameFigureLook | null
  readonly pitcherAnimation: FigureAnimation | null
  readonly batterAnimation: FigureAnimation | null
}

/** 진입 0x25f8c · 0x2613c · 0x25e6c 는 [목록+0x200] 을 1 로 둔다 */
export const INITIAL_FIGURE_ENTRY: FigureEntryState = {
  reload: true,
  slot: null,
  pitcher: null,
  batter: null,
  pitcherAnimation: null,
  batterAnimation: null,
}

/** 한 번 그린 A 자리 몸 그림 */
export type FigureDrawing =
  | { readonly kind: '없음' }
  | { readonly kind: '타자'; readonly look: HallOfFameFigureLook; readonly pose: number }
  /** 투수 이미지 — `image` 는 그림 앞에 뜬 값(null = 빈 그림), `hand` 는 지금 투수 그림 +0x3c */
  | {
      readonly kind: '투수'
      readonly image: { readonly look: HallOfFameFigureLook; readonly pose: number } | null
      readonly hand: number
    }

export interface FigureSlotInput {
  /** 커서 칸 번호 */
  readonly slot: number
  /** 칸 > 4 — [목록+0x288] */
  readonly isBatterSlot: boolean
  /** 찬 칸의 기록 — 빈 칸·잠긴 칸은 null (0x5ea18 이 0) */
  readonly look: HallOfFameFigureLook | null
  /** 이 화면이 그림 앞에 0x669c1 을 부르는가 (홈런더비 하위 16 만 아니다) */
  readonly capturesImage: boolean
}

export interface FigureFrame {
  readonly memory: FigureListMemory
  readonly entry: FigureEntryState
  readonly drawing: FigureDrawing
}

/** 0x5e8bc 의 동작 갈래 — 그린 수 c 가 30 이거나 주기(투수 0x50 · 타자 0x8c)의 배수면 동작을 시작한다 */
const startsMotion = (draws: number, period: number) => draws === 0x1e || (draws !== 0 && draws % period === 0)

function stepPitcher(memory: FigureListMemory, animation: FigureAnimation) {
  let { hold } = memory
  let next = animation
  if (startsMotion(memory.draws, 0x50)) {
    next = startAnimation(next.form, 1)
    hold = 0
  }
  if (next.state === 1 && next.step > 0xb) {
    const before = hold
    hold += 1
    if (before > 4) {
      next = startAnimation(next.form, 0)
      hold = 0
    }
  }
  next = advancePitcherAnimation(next)
  return { memory: { ...memory, hold, pose: pitcherPoseOf(next) }, animation: next }
}

/** 준비(2) 한 단계 뒤 — 유지 셈이 4 를 넘으면 스윙(3)으로 (셈 0) */
function holdReady(hold: number, next: FigureAnimation) {
  if (hold > 4) return { hold: 0, next: startAnimation(next.form, 3) }
  return { hold: hold + 1, next }
}

/** 스윙(3) 끝 무렵(타격형 6 · 장타형 4 단계부터) — 유지 셈이 0xd 를 넘으면 대기(5)로 */
function holdSwingEnd(hold: number, next: FigureAnimation) {
  if (next.step < (isSluggerForm(next.form) ? 4 : 6)) return { hold, next }
  return { hold: hold + 1, next: hold > 0xd ? startAnimation(next.form, 5) : next }
}

function holdBatterMotion(hold: number, next: FigureAnimation) {
  if (next.state === 3) return holdSwingEnd(hold, next)
  if (next.state === 2 && next.step >= 1) return holdReady(hold, next)
  return { hold, next }
}

function stepBatter(memory: FigureListMemory, animation: FigureAnimation) {
  const started = startsMotion(memory.draws, 0x8c)
  const held = holdBatterMotion(started ? 0 : memory.hold, started ? startAnimation(animation.form, 2) : animation)
  const next = advanceBatterAnimation(held.next)
  return { memory: { ...memory, hold: held.hold, pose: batterPoseOf(next) }, animation: next }
}

/**
 * 칸 들어옴 — 진입 첫 그림은 칸만 적는다(다시 싣기는 진입이 이미 켰다. 자세는 앞 화면 값 그대로).
 * 0x63c46~0x63c7a — 커서가 움직이면 자세 0 · 다시 싣기.
 * 원본 표지 격자 +0x25 는 칸이 바뀐 키에서만 선다 — 확정: 격자 키 0x6c17c~0x6c192 가 옮긴 뒤 +0xc · +0x10 을 옛 값과 견줘 다를 때만 1
 */
function enterListSlot(memory: FigureListMemory, entry: FigureEntryState, slot: number) {
  if (entry.slot === null) return { memory, entry: { ...entry, slot } }
  if (entry.slot === slot) return { memory, entry }
  return { memory: { ...memory, pose: 0 }, entry: { ...entry, slot, reload: true } }
}

/** 다시 싣기 — 칸 편의 그림을 싣고 애니를 처음(타자 대기 5 · 투수 0)부터 */
function reloadFigure(entry: FigureEntryState, isBatterSlot: boolean, look: HallOfFameFigureLook): FigureEntryState {
  if (!entry.reload) return entry
  return isBatterSlot
    ? { ...entry, reload: false, batter: look, batterAnimation: startAnimation(look.form, 5) }
    : { ...entry, reload: false, pitcher: look, pitcherAnimation: startAnimation(look.form, 0) }
}

function drawBatterFrame(memory: FigureListMemory, entry: FigureEntryState): FigureFrame | null {
  if (entry.batterAnimation === null || entry.batter === null) return null
  const stepped = stepBatter(memory, entry.batterAnimation)
  return {
    memory: stepped.memory,
    entry: { ...entry, batterAnimation: stepped.animation },
    drawing: { kind: '타자', look: entry.batter, pose: stepped.memory.pose },
  }
}

type CapturedImage = { readonly look: HallOfFameFigureLook; readonly pose: number } | null

function drawPitcherFrame(memory: FigureListMemory, entry: FigureEntryState, capturesImage: boolean, image: CapturedImage): FigureFrame | null {
  if (entry.pitcherAnimation === null || entry.pitcher === null) return null
  const stepped = stepPitcher(memory, entry.pitcherAnimation)
  // B-97 고친 길 — 이번 그림에 실은 투수와 이번 걸음의 자세로 뜬다(한 그림 늦음 · 타자 자세 번호를 걷는다). 굴림 없음
  const fixedImage = capturesImage ? { look: entry.pitcher, pose: stepped.memory.pose } : null
  const drawnImage = isBugFixed('B-97') ? fixedImage : image
  return {
    memory: stepped.memory,
    entry: { ...entry, pitcherAnimation: stepped.animation },
    drawing: { kind: '투수', image: drawnImage, hand: figureHandOf(entry.pitcher) },
  }
}

/** 한 그림 — 이미지 뜨기(0x669c1) → 목록 그리기(0x63b14) 의 A 자리 차례 그대로 */
export function drawListFigure(memory: FigureListMemory, entry: FigureEntryState, input: FigureSlotInput): FigureFrame {
  // 0x669c1 — 목록 그리기 앞, 앞 그림 끝의 투수 그림·자세로 뜬다
  const image = input.capturesImage && entry.pitcher !== null ? { look: entry.pitcher, pose: memory.pose } : null
  const entered = enterListSlot(memory, entry, input.slot)
  if (input.look === null) return { memory: entered.memory, entry: entered.entry, drawing: { kind: '없음' } }
  const nextEntry = reloadFigure(entered.entry, input.isBatterSlot, input.look)
  const nextMemory = { ...entered.memory, draws: entered.memory.draws + 1 }
  const frame = input.isBatterSlot ? drawBatterFrame(nextMemory, nextEntry) : drawPitcherFrame(nextMemory, nextEntry, input.capturesImage, image)
  return frame ?? { memory: nextMemory, entry: nextEntry, drawing: { kind: '없음' } }
}

/** 그림 n 번 (건너뛴 갱신도 원본은 한 번씩 그렸다) — 마지막 그림을 돌려준다 */
export function drawListFigureTimes(memory: FigureListMemory, entry: FigureEntryState, input: FigureSlotInput, times: number): FigureFrame {
  let frame: FigureFrame = { memory, entry, drawing: { kind: '없음' } }
  for (let index = 0; index < Math.max(1, times); index += 1) frame = drawListFigure(frame.memory, frame.entry, input)
  return frame
}
