import { pitcherPoseOf as stagePitcherPoseOf, pitcherStepRuleOf } from '@/widgets/batting-stage/lib/stageScenery'

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

export const startAnimation = (form: number, state: number): FigureAnimation => ({ state, step: 0, count: 0, form })

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
    next =
      reached && animation.step < rule.lastStep ? { ...animation, step: animation.step + 1, count: 0 } : { ...animation, count: animation.count + 1 }
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

export const isSluggerForm = (form: number) => form >= 2 && form <= 3

/** 목록 애니가 아는 폼 0~3 — 옛 검사(`form < 0 || form > 3` 이면 그대로)를 뒤집은 꼴이라 NaN 도 옛처럼 통과한다 */
const isListFigureForm = (form: number) => !(form < 0 || form > 3)

/** 상태 하나의 단계 규칙 — 단계별 유지 틀 수 · 단계 수 · 끝에서 되감나 */
interface StepRule {
  readonly durations: readonly number[]
  readonly steps: number
  readonly wraps: boolean
}

/** 상태 → 규칙 (폼 2·3 장타형이면 다르다). 표에 없는 상태는 아무것도 안 센다 */
const BATTER_STEP_RULES: ReadonlyMap<number, (slugger: boolean) => StepRule> = new Map<number, (slugger: boolean) => StepRule>([
  [2, () => ({ durations: [2, 3], steps: 2, wraps: false })],
  [3, (slugger) => ({ durations: [], steps: slugger ? 5 : 7, wraps: false })],
  [5, (slugger) => ({ durations: slugger ? [3, 3, 3, 3, 3] : [3, 3, 3, 3], steps: slugger ? 5 : 4, wraps: true })],
])

/** 한 틀 — 유지 틀을 다 채웠으면 다음 단계, 마지막 단계면 되감거나 센다 */
function stepByRule(animation: FigureAnimation, rule: StepRule): FigureAnimation {
  const { step, count } = animation
  if (count < (rule.durations[step] ?? 0)) return { ...animation, count: count + 1 }
  if (step < rule.steps - 1) return { ...animation, step: step + 1, count: 0 }
  return rule.wraps ? { ...animation, step: 0, count: 0 } : { ...animation, count: count + 1 }
}

/**
 * 0xb9168 — 상태 2(준비) 유지 [2, 3] 두 단계 · 3(스윙) 유지 0 으로 7(폼 0·1)/5(폼 2·3) 단계 ·
 * 5(대기) 유지 3 으로 4/5 단계를 되풀이. 그 밖 상태는 아무것도 안 센다.
 * ⚠️ 0xb928d 는 0xb9168 뒤 애니 +0xd 가 켜져 있으면 스윙 끝 처리를 더 하는데, 생성자 0xb8ff0 이 +0xd 를 안 써서
 *    목록 애니에선 0 으로 보고 뺐다.
 */
export function advanceBatterAnimation(animation: FigureAnimation): FigureAnimation {
  const { state, form } = animation
  if (!isListFigureForm(form)) return animation
  const rule = BATTER_STEP_RULES.get(state)?.(isSluggerForm(form))
  if (rule === undefined) return animation
  return stepByRule(animation, rule)
}

/**
 * `batterPoseOf` 가 낼 수 있는 자세 — 그림을 미리 칠할 때 쓴다. 몸통 폼 0 타격형(balancer)은 0 ~ 13, 1 장타형(sluger)은 0 ~ 12
 * (sluger 번트가 12 라 13 은 안 나온다 — 13 을 칠하면 sluger 26 · 그림자 · 헬멧 · 배트 27 처럼 PZX 에 없는 칸을 청한다, r319)
 */
export function figureBatterPosesOf(bodyType: number): readonly number[] {
  return Array.from({ length: bodyType === 1 ? 13 : 14 }, (_, pose) => pose)
}

const SLUGGER_STEPS = [0, 1, 2, 3, 4, 0, 1, 2]
/** 상태 → 단계별 자세 — 폼 0·1 타격형 · 2·3 장타형 */
const BATTER_POSES: ReadonlyMap<number, { readonly balancer: (step: number) => number; readonly slugger: (step: number) => number }> = new Map([
  [2, { balancer: (step: number) => (step % 2) + 4, slugger: (step: number) => (step % 2) + 5 }],
  [3, { balancer: (step: number) => ([0, 1, 2, 3, 4, 5, 6, 0][step] ?? 0) + 6, slugger: (step: number) => (SLUGGER_STEPS[step] ?? 0) + 7 }],
  [4, { balancer: () => 13, slugger: () => 12 }],
  [5, { balancer: (step: number) => [0, 1, 2, 3, 0, 1, 2, 1][step] ?? 0, slugger: (step: number) => SLUGGER_STEPS[step] ?? 0 }],
])

/** 0xb905c — 2 준비 4·5(폼 2·3 은 5·6) · 3 스윙 6~12(7~11) · 4 번트 13(12) · 5 대기 0~3(0~4) */
export function batterPoseOf(animation: FigureAnimation): number {
  const { state, step, form } = animation
  if (!isListFigureForm(form)) return 0
  const poseOf = BATTER_POSES.get(state)
  if (poseOf === undefined) return 0
  return isSluggerForm(form) ? poseOf.slugger(step) : poseOf.balancer(step)
}

/* ── 목록 쪽 0x5e8bc ──────────────────────────────────────────────────────────────── */
