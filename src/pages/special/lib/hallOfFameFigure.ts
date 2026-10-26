import { isBugFixed } from '@/shared/config/bugfixes'
import { pitcherPoseOf as stagePitcherPoseOf, pitcherStepRuleOf } from '@/widgets/batting-stage/lib/stageScenery'

/**
 * 명예의 전당 목록 A 자리의 **고른 선수 몸 그림** — 공용 목록 그리기 0x63b14(목록 = 스킨 객체) 의 찬 칸 갈래와
 * 0x669c0 → 0x65e80 을 직접 떠서 옮겼다. 순수 함수만 둔다(그리기는 `ui/HallOfFameFigure.tsx`).
 *
 * ```
 * 화면 그리기 앞(0x32dd8 하위 17·27 · 나리 0x16a34 상태 145 · 시즌 0xe9ac — 홈런더비 하위 16 은 부르지 않는다):
 *   0x669c0(목록) → 0x65e80(목록, &[0x1552ae0], 투수그림 [목록+0x298], 자세 [목록+0x204])
 *     (0,0,54,75) 를 RGB(255,0,255)(투명 키) 로 채우고 투수 그림 vt+0x10(그림, 자세, 0, 27, 62, 0,0,0) →
 *     그 54×75 를 이미지 [0x1552ae0] 로 떠 두고(처음 한 번 만든다) 화면을 지운다.
 * 목록 그리기 0x63b14:
 *   커서가 움직였으면(격자 +0x25) [목록+0x204] = 0 · [목록+0x200] = 1 (0x63c46~0x63c7a)
 *   rec = 0x5ea18(목록, 칸) — [목록+0x288] = 칸 > 4(타자) · 칸 상태 1(나리)·3(명전)이면 그 기록, 아니면 0
 *   rec 가 있고 [목록+0x200] 이면 (0x65240~0x65356):
 *     그림 = 타자 ? [목록+0x290](겹침 타자 0x789f0) : [목록+0x298](단일 PZX 투수 0x79368)
 *     팀 = 칸 0·5(나리) ? (투수 [목록+0x4c4] · 타자 [목록+0x4c0] — 나리 저장의 팀 0x1f8d5(…)+1) : **14**
 *     타자이고 rec[0x19] 아랫니블(배트) 0 이면 0x78a39(배트 기본으로)
 *     그림 vt+8(그림, 팀, 폼 rec[0xb]>>4, 피부 rec[0xb] bit2-3, 손 0xb63c1(rec), −1) · 그림+0x48 = 0(그림자 끔) ·
 *     0x768b5(장비 칸 모두 비움) · 부위 0~3 니블(rec[0x19]·rec[0x1a] 윗·아랫) n ≥ 1 이면 vt+0x14(그림, 부위, n − 1)
 *     타자 애니 [목록+0x28c]: +0x24 = −1 · +0x28 = 폼 · 0xb915d(애니, 5)
 *     투수 애니 [목록+0x294]: +0x24 = −1 · +0xc  = 폼 · 0x9dff9(애니, 0)
 *     [목록+0x200] = 0
 *   rec 가 있으면 0x5e8bc(목록) — 애니 한 걸음, [목록+0x204] = 지금 자세(아래 `stepListFigure`)
 *     칸 0·5 면 team_logo 프레임 [그림+0x30](= 팀) 을 A 가운데 (0x65554~0x65598)
 *     타자면 그림 vt+0x10(그림, 자세, 0, A.x, A.y + 0x2d) 를 바로 (0x655a4~0x655c6)
 *     투수면 [0x1552ae0] 을 0x98975(이미지, A.x − ([투수그림+0x3c] ? 0x32 : 0x3b), A.y − 0x61, −1, −1, 0, 0, 0x10, 2, 1) 로 (0x655cc~0x65608)
 *       — 효과 0x10 · 2 = 정수 두 배 확대. 시즌 카드 0xaf28~0xaf56 와 인자가 같다
 * ```
 * - **투수 그림은 한 그림 늦다**: 이미지는 목록 그리기 **앞**에 뜨므로 그 그림의 생김새·자세는 앞 그림 끝의 값이다.
 *   커서를 타자 칸에서 투수 칸으로 옮긴 첫 그림은 앞서 실었던 투수(이번 진입에 실은 적이 없으면 빈 그림)를
 *   **타자 자세 번호**로 그린다 — [목록+0x204] 하나를 둘이 같이 쓰기 때문이다(원본 그대로 — B-97, 고친 길은 그 그림의 투수 · 자세로).
 *   반면 x 를 가르는 손 [투수그림+0x3c] 는 그리는 그 순간(이번 그림에 실은 뒤)의 값이다.
 * - 손 0xb63c0: 등록 선수(rec[0xa] bit6 = 0 — 명전 등록이 +0xa 를 0/0x20 으로 둔다)는 `폼 & 1`. 투수 그림은 손 ≠ 0(좌완)이면
 *   뒤집고(0x79544, 효과 0x11) 타자 그림은 손 = 0(우타)이면 뒤집는다(0x78d0c).
 * - [목록+0x40c](그린 수) · [목록+0x208](머무름) · [목록+0x204](자세) 는 목록 객체 칸이다. 목록 객체는 메인 메뉴 [this+0x120] ·
 *   나리 [this+0xd8] · 시즌 [this+0xa8] 모두 **같은 전역 스킨 [0x1552cfc]** 이라(확정 r166) 앱에 하나고 화면을 건너 잇는다.
 *   그린 수 +0x40c 는 엔트리 편집기(0x5561c 가 0 · 키 0x55864 +1) · 순위 판 키 0x5787c · 경기설정 창 0x6042c 도 함께 센다
 *   (`shared/lib/skinStepCounter`) — 편집기를 거쳐 오면 동작 주기(30 · 0x50 · 0x8c 배수)의 자리가 바뀐다(원본 그대로).
 *   그림·애니 객체는 진입(0x25f8c · 0x2613c · 0x25e6c · 나리 0x1c8ec)마다 새로 만든다.
 */

/** 기록 +0xb 와 장비 니블 — 그림 vt+8 · vt+0x14 에 넘기는 값 */
export interface HallOfFameFigureLook {
  /** rec[0xb] >> 4 = 2 × 타입 + 손 */
  readonly form: number
  /** rec[0xb] bit2-3 */
  readonly skin: number
  /** vt+8 의 팀 — 나리 칸은 나리 저장의 팀, 명전 칸은 14 */
  readonly team: number
  /** 부위 0~3 니블 (rec[0x19] 윗 · 아랫, rec[0x1a] 윗 · 아랫) — 0 미장착 */
  readonly equipment: readonly [number, number, number, number]
}

/** 명전 칸(칸 0·5 밖)의 팀 — 0x65296 `movs r5, #0xe` */
export const HALL_OF_FAME_FIGURE_TEAM = 14

/** 손 0xb63c0 — 등록 선수는 폼의 아랫비트 (0 우·1 좌) */
export const figureHandOf = (look: HallOfFameFigureLook) => look.form & 1

/** 그림 자리 (0x65e80 · 0x655a4 · 0x655cc) */
export const HALL_OF_FAME_FIGURE = {
  /** 투수 이미지 [0x1552ae0] 크기와 그 안에서 그림을 그리는 자리 */
  image: { width: 54, height: 75, figureX: 27, figureY: 62 },
  /** 투수 이미지를 찍는 자리 — (A.x − (손 ? 0x32 : 0x3b), A.y − 0x61) */
  imageDx: { leftHanded: -0x32, rightHanded: -0x3b },
  imageDy: -0x61,
  /** 투수 이미지 확대 — 0x98975 효과 0x10 · 2 (0x655f0~0x655f6) */
  imageScale: 2,
  /** 타자 그림 — (A.x, A.y + 0x2d) */
  batterDy: 0x2d,
} as const

/* ── 투수 애니 0x9df30 (vtable 0xd73d0: 갱신 0x9e005 · 자세 0x9e0b9) ─────────────────── */

export interface FigureAnimation {
  /** +0x14(투수) · +0x18(타자) */
  readonly state: number
  /** +0x1c */
  readonly step: number
  /** +0x20 */
  readonly count: number
  /** 투수 +0xc · 타자 +0x28 */
  readonly form: number
}

const startAnimation = (form: number, state: number): FigureAnimation => ({ state, step: 0, count: 0, form })

/**
 * 0x9df8c → 0x9e004 — 카운터가 유지값에 닿으면 다음 단계, 대기(2)가 단계 3 을 넘으면 상태 0.
 * 유지 표(0xd73e9 · 0xd73e4)와 마지막 단계는 경기 장면과 같은 객체(vtable 0xd73d0)라 `stageScenery.pitcherStepRuleOf` 하나를 쓴다.
 */
export function advancePitcherAnimation(animation: FigureAnimation): FigureAnimation {
  let next = animation
  // 마선수 갈래 +0x24 ≥ 0 은 이 목록에서 안 쓴다 (목록 애니 생성 뒤 +0x24 = −1)
  const rule = pitcherStepRuleOf(animation.state, null)
  if (rule !== null) {
    const reached = animation.count >= (rule.durations[animation.step] ?? 0)
    next = reached && animation.step < rule.lastStep
      ? { ...animation, step: animation.step + 1, count: 0 }
      : { ...animation, count: animation.count + 1 }
  }
  if (next.state === 2 && next.step > 3) return startAnimation(next.form, 0)
  return next
}

/** 0x9e0b8 — 상태 0·1 은 폼 표(0xd7475 · 0xd7467 · 0xd7459), 2 는 대기 표(0xd7454). 표는 `stageScenery.pitcherPoseOf` 하나다 */
export function pitcherPoseOf(animation: FigureAnimation): number {
  if (animation.state !== 0 && animation.state !== 1 && animation.state !== 2) return 0
  return stagePitcherPoseOf({ state: animation.state, step: animation.step }, animation.form, null)
}

/* ── 타자 애니 0xb9014 (vtable 0xd8aa4: 갱신 0xb928d → 0xb9168 · 자세 0xb905d), 마선수 아님(+0x24 = −1) ── */

const isSluggerForm = (form: number) => form >= 2 && form <= 3

/**
 * 0xb9168 — 상태 2(준비) 유지 [2, 3] 두 단계 · 3(스윙) 유지 0 으로 7(폼 0·1)/5(폼 2·3) 단계 ·
 * 5(대기) 유지 3 으로 4/5 단계를 되풀이. 그 밖 상태는 아무것도 안 센다.
 * ⚠️ 0xb928d 는 0xb9168 뒤 애니 +0xd 가 켜져 있으면 스윙 끝 처리를 더 하는데, 생성자 0xb8ff0 이 +0xd 를 안 써서
 *    목록 애니에선 0 으로 보고 뺐다.
 */
export function advanceBatterAnimation(animation: FigureAnimation): FigureAnimation {
  const { state, step, count, form } = animation
  if (form < 0 || form > 3) return animation
  const slugger = isSluggerForm(form)
  const rule = state === 2
    ? { durations: [2, 3], steps: 2, wraps: false }
    : state === 3
      ? { durations: [], steps: slugger ? 5 : 7, wraps: false }
      : state === 5
        ? { durations: slugger ? [3, 3, 3, 3, 3] : [3, 3, 3, 3], steps: slugger ? 5 : 4, wraps: true }
        : null
  if (rule === null) return animation
  if (count < (rule.durations[step] ?? 0)) return { ...animation, count: count + 1 }
  if (step < rule.steps - 1) return { ...animation, step: step + 1, count: 0 }
  return rule.wraps ? { ...animation, step: 0, count: 0 } : { ...animation, count: count + 1 }
}

/** `batterPoseOf` 가 낼 수 있는 자세 0 ~ 13 — 그림을 미리 칠할 때 쓴다 */
export const FIGURE_BATTER_POSES: readonly number[] = Array.from({ length: 14 }, (_, pose) => pose)

/** 0xb905c — 2 준비 4·5(폼 2·3 은 5·6) · 3 스윙 6~12(7~11) · 4 번트 13(12) · 5 대기 0~3(0~4) */
export function batterPoseOf(animation: FigureAnimation): number {
  const { state, step, form } = animation
  if (form < 0 || form > 3) return 0
  const slugger = isSluggerForm(form)
  if (state === 2) return (step % 2) + (slugger ? 5 : 4)
  if (state === 3) return slugger ? ([0, 1, 2, 3, 4, 0, 1, 2][step] ?? 0) + 7 : ([0, 1, 2, 3, 4, 5, 6, 0][step] ?? 0) + 6
  if (state === 4) return slugger ? 12 : 13
  if (state === 5) return slugger ? ([0, 1, 2, 3, 4, 0, 1, 2][step] ?? 0) : ([0, 1, 2, 3, 0, 1, 2, 1][step] ?? 0)
  return 0
}

/* ── 목록 쪽 0x5e8bc ──────────────────────────────────────────────────────────────── */

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
  reload: true, slot: null, pitcher: null, batter: null, pitcherAnimation: null, batterAnimation: null,
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

function stepBatter(memory: FigureListMemory, animation: FigureAnimation) {
  let { hold } = memory
  let next = animation
  if (startsMotion(memory.draws, 0x8c)) {
    next = startAnimation(next.form, 2)
    hold = 0
  }
  if (next.state === 3) {
    if (next.step >= (isSluggerForm(next.form) ? 4 : 6)) {
      const before = hold
      hold += 1
      if (before > 0xd) next = startAnimation(next.form, 5)
    }
  } else if (next.state === 2 && next.step >= 1) {
    const before = hold
    hold += 1
    if (before > 4) {
      next = startAnimation(next.form, 3)
      hold = 0
    }
  }
  next = advanceBatterAnimation(next)
  return { memory: { ...memory, hold, pose: batterPoseOf(next) }, animation: next }
}

/** 한 그림 — 이미지 뜨기(0x669c1) → 목록 그리기(0x63b14) 의 A 자리 차례 그대로 */
export function drawListFigure(memory: FigureListMemory, entry: FigureEntryState, input: FigureSlotInput): FigureFrame {
  // 0x669c1 — 목록 그리기 앞, 앞 그림 끝의 투수 그림·자세로 뜬다
  const image = input.capturesImage && entry.pitcher !== null ? { look: entry.pitcher, pose: memory.pose } : null
  let nextMemory = memory
  let nextEntry = entry
  if (entry.slot === null) {
    // 진입 첫 그림 — 다시 싣기는 진입이 이미 켰다. 자세는 앞 화면 값 그대로
    nextEntry = { ...nextEntry, slot: input.slot }
  } else if (entry.slot !== input.slot) {
    // 0x63c46~0x63c7a — 커서가 움직이면 자세 0 · 다시 싣기
    // 원본 표지 격자 +0x25 는 칸이 바뀐 키에서만 선다 — 확정: 격자 키 0x6c17c~0x6c192 가 옮긴 뒤 +0xc · +0x10 을 옛 값과 견줘 다를 때만 1
    nextMemory = { ...nextMemory, pose: 0 }
    nextEntry = { ...nextEntry, slot: input.slot, reload: true }
  }
  if (input.look === null) return { memory: nextMemory, entry: nextEntry, drawing: { kind: '없음' } }

  if (nextEntry.reload) {
    nextEntry = input.isBatterSlot
      ? { ...nextEntry, reload: false, batter: input.look, batterAnimation: startAnimation(input.look.form, 5) }
      : { ...nextEntry, reload: false, pitcher: input.look, pitcherAnimation: startAnimation(input.look.form, 0) }
  }
  nextMemory = { ...nextMemory, draws: nextMemory.draws + 1 }
  if (input.isBatterSlot && nextEntry.batterAnimation !== null && nextEntry.batter !== null) {
    const stepped = stepBatter(nextMemory, nextEntry.batterAnimation)
    return {
      memory: stepped.memory,
      entry: { ...nextEntry, batterAnimation: stepped.animation },
      drawing: { kind: '타자', look: nextEntry.batter, pose: stepped.memory.pose },
    }
  }
  if (!input.isBatterSlot && nextEntry.pitcherAnimation !== null && nextEntry.pitcher !== null) {
    const stepped = stepPitcher(nextMemory, nextEntry.pitcherAnimation)
    // B-97 고친 길 — 이번 그림에 실은 투수와 이번 걸음의 자세로 뜬다(한 그림 늦음 · 타자 자세 번호를 걷는다). 굴림 없음
    const drawnImage = isBugFixed('B-97')
      ? (input.capturesImage ? { look: nextEntry.pitcher, pose: stepped.memory.pose } : null)
      : image
    return {
      memory: stepped.memory,
      entry: { ...nextEntry, pitcherAnimation: stepped.animation },
      drawing: { kind: '투수', image: drawnImage, hand: figureHandOf(nextEntry.pitcher) },
    }
  }
  return { memory: nextMemory, entry: nextEntry, drawing: { kind: '없음' } }
}

/** 그림 n 번 (건너뛴 갱신도 원본은 한 번씩 그렸다) — 마지막 그림을 돌려준다 */
export function drawListFigureTimes(
  memory: FigureListMemory, entry: FigureEntryState, input: FigureSlotInput, times: number,
): FigureFrame {
  let frame: FigureFrame = { memory, entry, drawing: { kind: '없음' } }
  for (let index = 0; index < Math.max(1, times); index += 1) frame = drawListFigure(frame.memory, frame.entry, input)
  return frame
}

/** 투수 이미지를 찍는 x 보정 — [투수그림+0x3c] ≠ 0 이면 0x32, 아니면 0x3b (0x655d4~0x655e6) */
export const pitcherImageDxOf = (hand: number) =>
  hand !== 0 ? HALL_OF_FAME_FIGURE.imageDx.leftHanded : HALL_OF_FAME_FIGURE.imageDx.rightHanded
