import { leagueGamePitchersOf, nextOpponentOf, type PlayerCareer } from '@/entities/career/model/playerCareer'
import {
  nariQuickLineupOf,
  nariTeamRecordOf,
  nariTeamsOf,
  recordMatchAcesOf,
  recordTeamAcesOf,
  renumberedBattingOrderOf,
} from '@/entities/career/model/nariTeamRecord'
import { nariMoraleOf, nariTeamRecordMoraleOf, withNariGameMorale } from '@/entities/career/model/nariMorale'
import { nariTeamRecordEquipmentOf } from '@/entities/career/model/nariCpuEquipment'
import { effectiveAbilityOf } from '@/entities/career/model/condition'
import { leagueDayCounterOf, leagueGamePlayerSideOf } from '@/entities/career/model/leagueGameSetup'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import type { MatchSetup } from '@/app/model/careerSession/game/useStartMatch'

/** 선수가 없을 때(시험 진입점) — 팀 0 · 후공 · 날짜 0 */
const NO_CAREER_MATCH: MatchSetup = {
  ourTeamId: 0,
  battingOrder: undefined,
  opponentTeamId: undefined,
  dayCounter: 0,
  playerSide: PLAYER_SIDE_LAST_BAT,
}

/**
 * 경기 장면 0x39fdc 모드 3·4 갈래 — 두 팀을 `0xb891c(…, 모드, 팀)` 로 세우고 `0xb8768` 로 칸 번호를 다시 매긴다(0x3a2fa).
 * 선수는 저장의 **나리 팀 레코드**에서 나온다(`nariTeamsOf`): 내 팀 타순·벤치는 레코드 타자 배열 차례, 142 가 넣은 마선수는
 * 두 팀 레코드의 9번(마타자)·8번(마투수) 칸이다. 투수 0~7 차례는 리그 칸(`leagueGamePitchersOf`)이다. 굴림 없음.
 */
export function leagueMatchSetupOf(current: PlayerCareer | null, aceLevels: Readonly<Record<number, number>> | undefined): MatchSetup {
  if (current === null) return NO_CAREER_MATCH
  // 상대는 일정표(정규시즌)나 지금 시리즈(포스트시즌)가 정한다 — 무작위가 아니다
  const opponent = nextOpponentOf(current)
  const records = nariTeamsOf(current)
  const mine = nariTeamRecordOf(records, current.teamId)
  const theirs = nariTeamRecordOf(records, opponent)
  const recordAces = recordMatchAcesOf(records, current.teamId, opponent)
  return {
    ourTeamId: current.teamId,
    battingOrder: renumberedBattingOrderOf(current),
    opponentTeamId: opponent,
    // 날짜 카운터 g = S+0xb2(= L+0x32) — 경기 준비 0x1c46c 가 0x1c576 에서 읽고 0이 아니면 두 팀 로테이션을 돌린다.
    // 정규시즌은 오늘까지 치른 경기 수, 포스트시즌은 **시리즈 안 경기 수**다 (`leagueDayCounterOf` — b811c · b777a · b819a).
    // 커리어 `gamesPlayed` 는 내 경기만 세므로 포스트시즌 g 로 쓰지 않는다.
    dayCounter: leagueDayCounterOf(current),
    // 내 팀의 측 — 경기 준비 0x1c46c(0x1c4f0)·장면 0x39fdc 모드 3·4 가지(0x3a164 → [sp+0x3c])가 정규시즌·포스트시즌
    // 가리지 않고 `0xb7844(L, 내 팀)` 로 정한다: 정규시즌은 일정표 0xd89cb · 9일 주기 뒤집기(`leagueSideOf`),
    // 포스트시즌은 대진 윗 시드(칸 0)가 홈·후공, 아랫 시드가 원정·선공 (`leagueGamePlayerSideOf`).
    playerSide: leagueGamePlayerSideOf(current),
    // 0x1c46c 가 세운 두 팀 투수 — 리그가 들고 다니는 레코드 차례(g ≠ 0 이면 한 칸 돈 것 · 포스트시즌은 시리즈 이월)와
    // 레코드 +0x2c (g == 0 이면 1c8a8 이 열 팀 10000)
    pitchers: leagueGamePitchersOf(current, opponent),
    // 142 진입 0x1c46c 가 두 팀 명부(저장의 나리 팀 레코드)에 넣은 마선수 — 경기 장면 0x39fdc 가 같은 명부로 팀을 세운다
    aces:
      recordAces === null
        ? undefined
        : { ours: recordTeamAcesOf(mine), opponent: recordTeamAcesOf(theirs), ...(aceLevels === undefined ? {} : { levels: aceLevels }) },
    ourRecordLineup: nariQuickLineupOf(mine),
    myRunAbility: effectiveAbilityOf(withNariGameMorale(current)).run,
    // 두 팀 레코드 +2 = 0xa3a24 — 대회가 아니라 커리어 사기
    teamMorale: nariMoraleOf(current),
    // 상대 리그 팀 레코드 +2 에 남은 값 — 그 팀이 지난번 치른 경기 때의 나리 사기 (`nariTeamRecordMoraleOf`, r101)
    opponentStaleMorale: nariTeamRecordMoraleOf(current, opponent),
    // 상대 팀 객체 0xb8680 → 0x1f989 가 읽는 저장 레코드의 장비 니블 (새 시즌 0x665e8 — `nariCpuEquipment`)
    opponentEquipment: nariTeamRecordEquipmentOf(records, opponent),
  }
}
