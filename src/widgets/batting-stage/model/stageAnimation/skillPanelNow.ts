/** 경기 스킬 표시 판 0x4b5b4 의 이 그림 몫 (`model/skillPanelDriver`) */
import type { PitcherAbility } from '@/entities/pitching/model/pitch'
import { pitcherHandOfPitch } from '@/entities/pitching/model/pitcherHand'
import { skillBitsOfIds } from '@/widgets/batting-stage/lib/skillPanel'
import type { SkillPanelSituation, SkillPanelView } from '@/widgets/batting-stage/lib/skillPanel'
import type { StageLoop } from '@/widgets/batting-stage/model/stageAnimation/stageLoop'
import { batterSideNow } from '@/widgets/batting-stage/model/stageAnimation/batterSide'

/** 수비 투수 레코드 +0x14 — 번호를 직접 든 능력치(마투수)면 번호 − 16, 아니면 비트 그대로 (`resolvePitch.pitcherSkillIdsOf` 와 같은 고름) */
function pitcherSkillBitsOf(pitcher: PitcherAbility): number {
  return pitcher.skillIds !== undefined ? skillBitsOfIds(pitcher.skillIds, true) : (pitcher.skillBits ?? 0)
}

/** 점수판 몫 — 이닝 · 점수 · 주자. HUD 가 없으면 1회 · 0 점 · 빈 루 */
function hudSituationOf(hud: StageLoop['refs']['latestRef']['current']['hud']) {
  if (hud === null) return { inning: 1, attackScore: 0, defenseScore: 0, runnerCount: 0, hasSecondBaseRunner: false }
  const { bases } = hud
  return {
    inning: hud.inning,
    // 사람이 치는 타석 — 공격 측이 사람 팀이다
    attackScore: hud.ourScore,
    defenseScore: hud.opponentScore,
    runnerCount: Number(bases.first) + Number(bases.second) + Number(bases.third),
    hasSecondBaseRunner: bases.second,
  }
}

/** 마운드 투수의 손 — 레퍼토리(폼 · +0x18)로 0xb63c0 */
function repertoireHandOf(repertoire: PitcherAbility['repertoire']): number {
  return pitcherHandOfPitch({ pitcherForm: repertoire?.form ?? 0, pitcherMagicNumber: repertoire?.magicId ?? 0 })
}

function skillPanelSituationNow(loop: StageLoop): SkillPanelSituation {
  const latest = loop.refs.latestRef.current
  return {
    ...(latest.gameMode === undefined ? {} : { gameMode: latest.gameMode }),
    ...hudSituationOf(latest.hud),
    pitcherHand: repertoireHandOf(latest.pitcherAbility.repertoire),
    batterHand: batterSideNow(loop),
    batterRecordSlot: latest.batterRecordSlot,
    recentAtBatCodes: latest.recentAtBatCodes,
  }
}

/** 이 그림의 판 — 0xd · 0xf 진입을 보고 원본 틱마다 0x4b5b4 를 한 번 돌린다. 그리지 않는 상태면 null */
export function stepSkillPanelNow(loop: StageLoop, nowTick: number, extraDraw = false): SkillPanelView | null {
  const { latestRef, phaseRef, phaseStartTickRef } = loop.refs
  const latest = latestRef.current
  const source = latest.skillPanel
  if (source === undefined) return null
  const isStateF = phaseRef.current === '대기' && !latest.isPaused && nowTick >= phaseStartTickRef.current
  return loop.stepSkillPanel({
    source,
    isStateF,
    stateFMark: phaseStartTickRef.current,
    isDrawnState: isStateF || phaseRef.current === '투구중',
    nowTick,
    batterSkillBits: skillBitsOfIds(latest.batterSkillIds, false),
    pitcherSkillBits: pitcherSkillBitsOf(latest.pitcherAbility),
    strikes: latest.hud?.strikes ?? 0,
    batterRecordSlot: latest.batterRecordSlot,
    batterHand: batterSideNow(loop),
    situation: () => skillPanelSituationNow(loop),
    extraDraw,
  })
}
