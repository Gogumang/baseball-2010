import type { MutableRefObject } from 'react'
import type { SkillPanelSource, StageHud } from '@/widgets/batting-stage/model/stageRefs'
import type { SkillPanelScene } from '@/widgets/batting-stage/lib/skillPanel'
import { outsShownDuringResultWait } from '@/features/play-game/model/benchClearingScene'
import { confirmedCountOf } from '@/features/play-game/model/useSceneConfirm'
import { hiddenStealBasesOf, runnerRunAbilitiesOf } from '@/features/play-game/model/gameFlow'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import type { AtBatState } from '@/entities/at-bat/model/atBatState'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

/** 타석 캔버스(`BattingStage`)에 넘기는 값 묶음 — 점수판 HUD · 경기 스킬 표시 판 */

const smallLogoUrlOf = (teamId: number) => assetUrl(`./sprites/team_logo_ini/${String(teamId).padStart(3, '0')}.png`)

/** 타석 점수판 HUD 의 값 */
export function gameStageHudOf(progress: GameProgress, atBat: AtBatState): StageHud {
  return {
    inning: progress.game.inning,
    half: progress.game.half,
    ourScore: progress.game.ourScore,
    opponentScore: progress.game.opponentScore,
    balls: atBat.balls,
    strikes: atBat.strikes,
    // 붙든 삼진(0x12 대기)은 진입 3e1a6 이 이미 올린 아웃으로 그린다 (r298)
    outs: outsShownDuringResultWait(progress.game.outs, progress.pendingBenchClearing),
    bases: progress.game.bases,
    // HUD 팀 아이콘은 작은 로고 ui/team_logo_ini (0x373d0) — 적재 0x48a38 이 경기[0x28 + 측] 팀(0xb6bdd)으로 싣는다.
    // 국가대항전이면 0x39fdc(3a148~3a22a)가 우리 측에 대한민국(10)을 앉히므로 시즌 팀(career.teamId)이 아니다
    ourLogoUrl: smallLogoUrlOf(progress.ourTeamId),
    opponentLogoUrl: smallLogoUrlOf(progress.opponentTeamId),
    ourTeamId: progress.ourTeamId,
    opponentTeamId: progress.opponentTeamId,
    // 위 줄 = 측 0(선공) — 사람 팀이 앉은 측 (0x373d0)
    playerSide: progress.game.playerSide,
    // 0x35b94 상태 0xe 주루 칸 — 루에 선 주자의 신원(원본 주자 목록)대로 그 주자 주력, 내가면 내 능력치
    runnerRunAbilities: runnerRunAbilitiesOf(progress),
    // st[0x15 + i] — 이번 공에 도루를 출발한 주자는 루에 안 그린다 (0xa9bd4 가 세우고 0xf 진입 · 타구 판 시작이 지운다).
    // 새 타석의 0xf 진입은 0xe 의 첫 OK 뒤라 받은 OK 수를 넘긴다
    hiddenRunnerBases: hiddenStealBasesOf(progress, confirmedCountOf(progress.sceneConfirm)),
  }
}

/** 경기 스킬 표시 판(0xd 진입 48fa4 · 0x4b5b4) — 0xd 진입마다 새 0xe 대기 객체 · 사람 팀이 공격 측(st[9]) */
export function gameStageSkillPanelOf(progress: GameProgress, skillPanelScene: MutableRefObject<SkillPanelScene> | undefined): SkillPanelSource {
  return {
    entryKey: progress.sceneConfirm ?? null,
    attackSide: progress.game.playerSide,
    ...(skillPanelScene === undefined ? {} : { scene: skillPanelScene }),
  }
}
