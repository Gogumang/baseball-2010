import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { outsShownDuringResultWait } from '@/features/play-game/model/benchClearingScene'
import { runnerRunAbilitiesOf } from '@/features/play-team-game/model/teamGameFlow'
import type { TeamGameOptions, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'

const smallLogoUrlOf = (teamId: number) => assetUrl(`./sprites/team_logo_ini/${String(teamId).padStart(3, '0')}.png`)

/** 명단 칸의 장비 니블 네 칸(히트·파워·수비·주루) → `BattingStage` 의 `batterEquipmentLevels` (니블 그대로) */
export function batterEquipmentPropsOf(equipment: readonly number[] | undefined) {
  if (equipment === undefined) return {}
  const [hit = 0, power = 0, defense = 0, run = 0] = equipment
  return { batterEquipmentLevels: { hit, power, defense, run } }
}

/**
 * 경기 장면 HUD 0x4c4bc(0x373d0) 재료 — 사람 타석 · 사람 수비 타석이 같은 값을 그린다.
 * 위 줄 = 측 0(선공) — 사람 팀이 앉은 측 (0x373d0)
 */
export function stageHudOf(progress: TeamGameProgress, options: TeamGameOptions) {
  const { game } = progress
  return {
    inning: game.inning,
    half: game.half,
    ourScore: game.ourScore,
    opponentScore: game.opponentScore,
    balls: progress.atBat.balls,
    strikes: progress.atBat.strikes,
    // 붙든 삼진(0x12 대기)은 진입 3e1a6 이 이미 올린 아웃으로 그린다 (r298)
    outs: outsShownDuringResultWait(game.outs, progress.pendingBenchClearing),
    bases: game.bases,
    ourLogoUrl: smallLogoUrlOf(options.ourTeamId),
    opponentLogoUrl: smallLogoUrlOf(options.opponentTeamId),
    ourTeamId: options.ourTeamId,
    opponentTeamId: options.opponentTeamId,
    playerSide: game.playerSide,
    // 0x35b94 상태 0xe 주루 칸 — 루에 선 주자의 신원(원본 주자 목록)대로 그 주자의 경기용 주력
    runnerRunAbilities: runnerRunAbilitiesOf(progress),
    // st[0x15 + i] — 이번 공에 도루를 출발한 주자는 루에 안 그린다 (0xa9bd4 가 세우고 0xf 진입 · 타구 판 시작이 지운다)
    hiddenRunnerBases: progress.stealDisplayFrom ?? [],
  }
}
