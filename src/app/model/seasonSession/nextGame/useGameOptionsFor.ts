import { useCallback } from 'react'
import type { TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow'
import { LEAGUE_SIDE_HOME } from '@/entities/league/model/league'
import { PLAYER_SIDE_LAST_BAT, PLAYER_SIDE_FIRST_BAT } from '@/entities/game/model/gameState'
import { illnessPenaltyFieldOf } from '@/entities/season-mode/model/seasonEventFlow'
import { seasonEntryOrderOf } from '@/entities/season-mode/model/seasonEntry'
import { SEASON_GAME_MODE } from '@/app/model/seasonSession/constants/seasonConstants'
import { seasonLeaguePitcherOrderOf, seasonLeagueStarterSlotOf } from '@/app/model/seasonSession/game/pitcherOrder'
import { type SeasonScope, useSeasonValue } from '@/app/model/seasonSession/atoms/seasonScope'
import { matchSettingsMirrorAtom, saveAtom } from '@/app/model/seasonSession/atoms/saveAtoms'
import { useSeasonGameSetup } from '@/app/model/seasonSession/state/useSeasonGameSetup'

/**
 * 커리어·팀 상태에서 팀 경기 옵션을 만든다 (세 종류가 같은 화면을 쓴다).
 *
 * `side` 는 원본 `0xb7844(리그, 팀)` 가 돌려주는 값 그대로다 — **1 = 홈(후공)**.
 * 세 갈래(정규·포스트시즌·국가대항전)가 서로 다른 가지를 타므로 부르는 쪽이 골라 넣는다.
 * 경기 준비 `0x6650` 이 그 값을 그대로 `경기[0x28 + side] = 팀번호` 로 꽂는다.
 */
export function useGameOptionsFor(scope: SeasonScope) {
  const { atoms, aceLevels } = scope
  const save = useSeasonValue(atoms, saveAtom)
  const matchSettings = useSeasonValue(atoms, matchSettingsMirrorAtom)
  const { entryOrderOf } = useSeasonGameSetup(scope)
  return useCallback(
    (opponent: number, side: number): TeamGameOptions | null => {
      if (save === null) return null
      const { record } = save.state
      return {
        mode: SEASON_GAME_MODE,
        ourTeamId: record.teamId,
        // [시즌+1] — 질병·보직·사기 보정(0xb5804)이 선수 팀 번호와 견주는 값. 국가대항전은
        // ourTeamId 만 대한민국(10)으로 바뀌고 이 값은 시즌 팀 그대로라 보정이 아무 팀에도 안 붙는다
        seasonTeamId: record.teamId,
        opponentTeamId: opponent,
        playerSide: side === LEAGUE_SIDE_HOME ? PLAYER_SIDE_LAST_BAT : PLAYER_SIDE_FIRST_BAT,
        // 경기진행 설정 시즌 칸 — 0xdd 의 '0' 창이 고친 값. 한 번도 안 고쳤으면 원본 0 초기값(찬스 · 공격 득점권)
        settings: matchSettings.current,
        // 코치는 SR+0x185 다 — 채용 화면(0xd7)이 채운 칸을 그대로 넘긴다 (−1 = 없음)
        // 질병 −30% 는 질병 종류 SR+5 가 아니라 **SR+6 > 0** 을 본다 (0xb5824 `ldrsb [SR,#6]`) — `illnessPenaltyFieldOf`
        season: { illness: illnessPenaltyFieldOf(record), morale: save.state.teamMorale, coach: record.coach },
        // 선발 = 리그 투수 레코드 차례의 0번 (`seasonLeagueStarterSlotOf` — g = SR+0xb2 ≠ 0 이면 0x6548 이 한 칸 돌린 뒤).
        // 엔트리 편집·경기정보는 내 팀 명단을 `rotationSlotOf(dayCounter)` 칸 돈 모양으로 보인다. 리그 차례는 0xb5ca8 만
        // 움직여 늘 투수 0~3 을 k 칸 돌린 모양이라 선발 칸 k 를 날짜 칸에 넣으면 그 모양이 원본 레코드와 같다 —
        // 포스트시즌(`postseasonStarterSlotOf`)과 같은 방식이다. 상대 팀은 레코드 차례 전체(`opponentPitcherOrder` — 0번 선발 · 나머지 벤치 차례)를 넘긴다. 날짜 칸
        // (`opponentDayCounter`)은 경기정보·CPU 엔트리 화면이 보는 같은 차례의 0번이다. 내 팀 벤치 차례는 경기를
        // 세울 때 `withOwnRecordRotation` 이 명단을 돌려 맞춘다
        dayCounter: seasonLeagueStarterSlotOf(save.league, record.teamId, record.games),
        opponentDayCounter: seasonLeagueStarterSlotOf(save.league, opponent, record.games),
        opponentPitcherOrder: seasonLeaguePitcherOrderOf(save.league, opponent, record.games),
        teamAbilities: save.state.teamAbilities,
        // 마선수 레벨 — 0xb6414 가 모드를 가리지 않고 전역 mgr[0x13a + i] 를 읽는다 (b9f896b·e2ee55a)
        aceLevels,
        // 시즌 저장의 팀 레코드 차례 그대로 — 경기용 팀 객체 0xb891c 는 첨자만 들고 선수는 0xb8680 으로 같은
        // 레코드(0x1f570)에서 읽으므로 엔트리 편집(0xe0)이 고친 차례가 곧 타순·벤치·투수 차례다 (c041959).
        // 경기정보 뒤에 편집이 끼면 `startPendingGame` 이 고친 명단으로 다시 싣는다
        ourEntryOrder: entryOrderOf(save.roster),
        // 상대 팀도 시즌 저장의 그 팀 레코드로 선다 (0xb891c → 0xb8680 → 0x1f570). 트레이드로 바뀐 팀만 저장에 있고
        // 나머지는 붙박이 표라 넘기지 않는다(예전 길 그대로)
        ...(save.cpuRosters?.[opponent] === undefined ? {} : { opponentEntryOrder: seasonEntryOrderOf(save.cpuRosters[opponent]) }),
      }
    },
    [aceLevels, entryOrderOf, matchSettings, save],
  )
}
