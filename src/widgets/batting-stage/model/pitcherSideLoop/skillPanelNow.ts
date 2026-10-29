/**
 * 경기 스킬 표시 판(0x4c4bc 4cad4 → 0x4b5b4) — 0xf 에 들 때마다 표지를 올리고, 판 재료를 모아 이 틀에 한 번 돌린다(`skillPanelDriver`).
 * 판을 세운 뒤 첫 그림에서 함성 29 를 낸다
 */
import { skillBitsOfIds } from '@/widgets/batting-stage/lib/skillPanel'
import type { SkillPanelSituation, SkillPanelView } from '@/widgets/batting-stage/lib/skillPanel'
import type { SkillPanelFrame } from '@/widgets/batting-stage/model/skillPanelDriver'
import type { PitcherSideSkillPanelSource } from '@/widgets/batting-stage/model/stageRefs'
import type { PitcherSideLoop } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideLoop'
import type { PitcherSideFrame } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideFrame'
import type { PitchInputNow } from '@/widgets/batting-stage/model/pitcherSideLoop/idleMotion'

const NO_BASES = { first: false, second: false, third: false } as const
/** hud 가 없으면 1 회 · 0 대 0 */
const NO_HUD_SCORE = { inning: 1, attackScore: 0, defenseScore: 0 } as const

export function stepSkillPanelNow(loop: PitcherSideLoop, frame: PitcherSideFrame, input: PitchInputNow): SkillPanelView | null {
  if (input.entersStateF) loop.skillPanelStateFSerial += 1
  loop.wasSkillPanelStateF = input.isStateF
  const skillPanel = frame.current.skillPanel
  const panelFrame = skillPanel === undefined ? null : skillPanelFrameOf(loop, frame, input, skillPanel)
  loop.lastSkillPanelFrame = panelFrame
  return panelFrame === null ? null : loop.stepSkillPanel(panelFrame)
}

function skillPanelFrameOf(
  loop: PitcherSideLoop,
  frame: PitcherSideFrame,
  input: PitchInputNow,
  skillPanel: PitcherSideSkillPanelSource,
): SkillPanelFrame {
  const { inputKind, isStateF } = input
  return {
    source: { ...skillPanel, isDefenseCpu: skillPanel.isDefenseCpu ?? false },
    isStateF,
    stateFMark: loop.skillPanelStateFSerial,
    isDrawnState: isStateF || inputKind === '조준' || inputKind === '게이지' || frame.stage.phase.kind === '투구중',
    nowTick: frame.nowTick,
    batterSkillBits: skillBitsOfIds(skillPanel.batterSkillIds, false),
    pitcherSkillBits: skillBitsOfIds(skillPanel.pitcherSkillIds, true),
    strikes: frame.current.hud?.strikes ?? 0,
    batterRecordSlot: skillPanel.batterRecordSlot,
    batterHand: frame.side,
    situation: () => skillPanelSituationOf(frame, skillPanel),
  }
}

/**
 * 0xd 진입 상황 — 사람이 던지는 타석이라 공격 측(CPU)이 hud 의 상대 점수다. 주자 0xa9888 은 1~3 루(타자는 0x17 진입에
 * 목록에 든다 — 0x46418 4650e)
 */
function skillPanelSituationOf(frame: PitcherSideFrame, skillPanel: PitcherSideSkillPanelSource): SkillPanelSituation {
  const { current } = frame
  const hud = current.hud
  const bases = hud?.bases ?? NO_BASES
  return {
    gameMode: current.gameMode,
    ...(hud === null ? NO_HUD_SCORE : { inning: hud.inning, attackScore: hud.opponentScore, defenseScore: hud.ourScore }),
    runnerCount: Number(bases.first) + Number(bases.second) + Number(bases.third),
    hasSecondBaseRunner: bases.second,
    pitcherHand: current.pitcherHand,
    batterHand: frame.side,
    batterRecordSlot: skillPanel.batterRecordSlot,
    recentAtBatCodes: skillPanel.recentAtBatCodes,
  }
}
