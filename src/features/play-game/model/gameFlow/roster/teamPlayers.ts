import {
  ACE_BATTER_ROSTER_SLOT,
  aceBatterPlayerOf,
  gameAceBatterOf,
  type GameAcePitcher,
  gameAcePitcherOf,
  ACE_PITCHER_SLOT,
} from '@/features/play-game/model/gameAces'
import { teamBatters, batterAt } from '@/entities/team/model/teamRoster'
import type { QuickAtBatBatter } from '@/entities/game/model/quickAtBat'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/**
 * 명단 칸의 선수 — 마타자 칸(`ACE_BATTER_ROSTER_SLOT`)이면 142 가 넣은 마타자, 아니면 로스터 붙박이 선수.
 */
/**
 * 그 팀 로스터 칸 타자의 이름 (0xb62c0) — 142 가 넣은 마타자 칸은 마선수 이름, 그 밖은 붙박이 표 행. 자동진행 중계 글 · DUE UP 이 읽는다.
 * 내 선수 칸은 부르는 쪽(커리어 이름)이 채운다.
 */
export function teamBatterNameAt(progress: GameProgress, isOurs: boolean, rosterSlot: number): string | null {
  if (rosterSlot === ACE_BATTER_ROSTER_SLOT) {
    const aces = isOurs ? progress.aces?.ours : progress.aces?.opponent
    return aces === undefined ? null : (aceBatterPlayerOf(aces.batter)?.name ?? null)
  }
  const roster = teamBatters(isOurs ? progress.ourTeamId : progress.opponentTeamId)
  return roster[rosterSlot % roster.length]?.name ?? null
}

export function teamBatterAt(progress: GameProgress, isOurs: boolean, rosterSlot: number): QuickAtBatBatter {
  if (rosterSlot === ACE_BATTER_ROSTER_SLOT) {
    const aces = isOurs ? progress.aces?.ours : progress.aces?.opponent
    const ace = aces === undefined ? undefined : gameAceBatterOf(aces.batter, progress.aces?.levels)
    if (ace !== undefined) return ace
  }
  // 상대 줄은 레코드 장비 니블(나리 새 시즌 0x665e8)을 0xb6414 로 먹는다 — 내 팀은 굴리지 않는다
  return isOurs ? batterAt(progress.ourTeamId, rosterSlot) : batterAt(progress.opponentTeamId, rosterSlot, progress.opponentEquipment)
}

/** 그 팀 명부 8번 칸의 마투수 (142 가 넣은 것) — 없으면 undefined */
export function teamAcePitcherOf(progress: GameProgress, isOurs: boolean): GameAcePitcher | undefined {
  const aces = isOurs ? progress.aces?.ours : progress.aces?.opponent
  return aces === undefined ? undefined : gameAcePitcherOf(aces.pitcher, progress.aces?.levels)
}

/** 지금 마운드가 마투수(8번 칸)면 그 선수 */
export function moundAcePitcherOf(progress: GameProgress, isOurs: boolean): GameAcePitcher | undefined {
  const mound = isOurs ? progress.ourMound : progress.opponentMound
  return mound.pitcherSlot === ACE_PITCHER_SLOT ? teamAcePitcherOf(progress, isOurs) : undefined
}
