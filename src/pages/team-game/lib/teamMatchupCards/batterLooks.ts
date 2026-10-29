import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { currentBatterEntry, isOurOffense } from '@/features/play-team-game/model/teamGameFlow'
import type { TeamEntryBatter } from '@/features/play-team-game/model/teamGameRoster'
import { NO_ROSTER_SLOT } from '@/features/play-team-game/model/teamGameRoster'
import { leagueBatterIdOf } from '@/entities/league/model/leaguePlayerStats'
import { BATTERS } from '@/shared/config/original/roster'
import { aceBatterProfileOf, batterHandOf } from '@/widgets/matchup-cards/lib/matchupRecord'

/**
 * 타자 레코드 +0xb(폼 니블) — 붙박이 표 행, 표 밖 선수(영입한 명전·나리)는 기록 사본의 +0xb(`TeamEntryBatter.profile`).
 * ⚠️ 칸이 생기기 전의 옛 기록 사본은 모른다(null)
 */
export function batterProfileOf(teamId: number, entry: TeamEntryBatter): number | null {
  if (entry.rosterSlot === NO_ROSTER_SLOT) return entry.profile ?? null
  return BATTERS[leagueBatterIdOf(entry.tableTeamId ?? teamId, entry.rosterSlot)]?.profile ?? null
}

/**
 * 타자 손 `0xb63c0`(1 좌타 · 0 우타) — 마타자는 마선수 표, 그 밖은 레코드 +0xb 폼 니블. ⚠️ +0xb 를 모르는 옛 기록 사본은
 * 우타(0)로 둔다.
 */
export function teamBatterHandOf(teamId: number, entry: TeamEntryBatter): number {
  if (entry.aceIndex >= 0) return batterHandOf(0, entry.aceIndex)
  const profile = batterProfileOf(teamId, entry)
  return profile === null ? 0 : batterHandOf(profile)
}

/**
 * **경기 시작 인트로 배경의 타자 손** — 인트로 진입 0x3b084 가 3b0d2 에서 공격 측 `st[9]` 팀을 장면 +0x220 에 두고
 * 3b0f2 `0xae89d`(그 팀의 지금 타자 = 팀[+0x32] 칸) → 3b0fe `0xb63c1`(손) 을 3b108 에서 경기 구장 `[장면+0xf10]` +0x60 에 쓴다
 * (직접 뜸, r215). 인트로 배경 0x40ff0 은 그 손으로 좌우가 갈린다(0 이면 우타 거울).
 * - 새 경기: 팀[+0x32] 를 쓰는 곳은 넷뿐(팀 초기화 0xb7c42 = 0 · 0x3a55a 모드 7 · 미션 0xaa888/0xaa89e · 확정 0xaebe4 — E 문서)이고
 *   st[9] = 0(0xb6814)이라 **1회초 첫 타자(측 0 의 1번)** 다.
 * - 이어하기(모드 1 · 2 · 8 · 9): 상태 9 의 0x21c54 가 저장 블록을 팀 · st 로 되복사한 뒤 인트로를 다시 탄다(R10 5절). 블록은 0x18
 *   틱 0 의 0x4f928 이 4f972 예약 확정 0xaebe4 **뒤** 4f9ae 0x1fdec 로 쓴 것이라(직접 뜸) 팀[+0x32] 는 다음에 칠 타자 · st[9] 는 그때
 *   공격 측 — 곧 이어하기 경기의 **지금 공격 팀 · 다음 타자**(웹 `game.half` · `battingOrderIndex` · `opponentOrderIndex`)다.
 */
export function teamIntroBatterHandOf(progress: TeamGameProgress): number {
  const { options } = progress
  const ours = isOurOffense(progress)
  const entry = ours ? progress.ourEntry[progress.game.battingOrderIndex] : progress.opponentEntry[progress.opponentOrderIndex]
  if (entry === undefined) return 0
  return teamBatterHandOf(ours ? options.ourTeamId : options.opponentTeamId, entry)
}

/**
 * **사람 타석 타자 그림 · 판정 재료** — 지금 타자 `0xae89c(공격 팀 = 우리)` 레코드에서 (`BattingStage` 의 batterForm · batterSkinIndex ·
 * batterHand). 타석 교대 0x47d98~0x47dd6 이 타자 그림 적재 0x78ab0 에 폼 `rec[0xb] >> 4` · 피부 `(rec[0xb] >> 2) & 3` ·
 * 손 0xb63c0 을 넘기고, 0x47d58~0x47d70 이 같은 손을 장면 +0x17e1(배치 side)에 쓴다. 마타자는 XlsACE_BAT +0xb
 * (`aceBatterProfileOf`)와 손 표 0xd88b0 — 폼의 낮은 비트가 아니다. ⚠️ +0xb 를 모르는 옛 기록 사본은 0(타격형 · 우타 · 피부 0)
 */
export function teamBattingStageBatterOf(progress: TeamGameProgress): {
  readonly batterForm: number
  readonly batterSkinIndex: number
  readonly batterHand: number
} {
  const teamId = progress.options.ourTeamId
  const batter = currentBatterEntry(progress)
  if (batter === undefined) return { batterForm: 0, batterSkinIndex: 0, batterHand: 0 }
  const profile = batter.aceIndex >= 0 ? aceBatterProfileOf(batter.aceIndex) : (batterProfileOf(teamId, batter) ?? 0)
  return { batterForm: profile >> 4, batterSkinIndex: (profile >> 2) & 3, batterHand: teamBatterHandOf(teamId, batter) }
}

/**
 * 상대 명단 일반 타자 전부의 레코드 +0xb 와 장비 니블 — 팀 경기 로딩 판이 상대 타자 장비 겹(0x78fd8) 그림을 미리 받는 재료.
 * 마타자(0xb63a0 ≥ 0)는 장비 겹이 없어 뺀다
 */
export function opponentBatterRecordsOf(
  teamId: number,
  entry: readonly TeamEntryBatter[],
): { readonly profile: number; readonly equipment?: readonly number[] }[] {
  return entry.flatMap((batter) =>
    batter.aceIndex >= 0 || batter.equipment === undefined ? [] : [{ profile: batterProfileOf(teamId, batter) ?? 0, equipment: batter.equipment }],
  )
}
