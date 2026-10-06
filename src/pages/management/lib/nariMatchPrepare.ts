/**
 * **나만의리그 142 경기 준비(매치업)** — 진입 `0x1c46c` · 키 `0x13c30` · 그림 `0x15d98` (직접 떴다, 장면 0x106 모드 3·4 공용).
 *
 * 진입 0x1c46c 의 마선수 넣기 (1c55c~1c668):
 * ```
 * 1c55c  이전 상태 == 143(0x8f) 이거나 장면+0x288 ≠ 0 → 아래를 건너뛴다          ; +0x288 = 이 장면에서 한 번 (장면 셋업 0xfb7c 가 0)
 * 1c574  g = (s8)S+0xb2 ; g ≠ 0 → 상대 0xb8c80 (로테이션) …                      ; 웹 `leagueGamePitchersOf` · `pitcherLeagueGameSetupOf`
 * 1c5fe  S+0x12c(국가대항전) == 0 이면:
 * 1c60c    b = 0x9f604(저장)        ← 굴림 1  내 마타자 — 열린 마타자(저장 +0x35..+0x39) 중 균등
 * 1c61a    p = 0x9f650(저장)        ← 굴림 2  내 마투수 — 열린 마투수(저장 +0x30..+0x34) 중 균등
 * 1c62e    0xb88c8(내 팀, p) · 0xb8870(내 팀, b)
 * 1c640    0xb88c8(상대, 0x66968(p))   ← 굴림 3  상대 마투수
 * 1c656    0xb8870(상대, 0x66994(b))   ← 굴림 4  상대 마타자
 * 1c668  장면+0x288 = 1
 * ```
 * 그래서 **장면이 새로 설 때마다(이어하기 · 경기 뒤) 처음 142 에 들어설 때 한 번** 넷을 굴린다. 109 로 물러났다 다시
 * 들어와도 안 굴린다 — 0xb88c8 은 `0xb8680(팀)` 이 돌려주는 명부(모드 3·4 → 0x1f989 = 저장 블록 [g+0xb8]/[g+0xbc] 의
 * 나리 팀 레코드)에 `0xb521d` 로 마선수를 넣고, 그것을 빼는 코드가 없어 다시 세운 팀 객체(0xb891c)에도 남는다(확정).
 * 0x9f604·0x9f650 은 열린 수가 0 이어도 `bfa55(0, 0)` 을 부른다(개수 검사 없음, 0x9f630·0x9f67c).
 *
 * 키 0x13c30 (머리띠가 다 내려왔을 때만 — 전역 +0xe4):
 * ```
 * −5 · '5'   저장 [모드+0x4c] = 1 · 저장(0x1f1b9 · 0x1fd45 · 0x1fded · 0x22755) · 밀기(1, 0, 5, 1500) → 144 → 경기 장면
 *            ([모드+0x4c] = 전역기록 0x1f1d9 의 "그 모드 경기 중간 저장됨" — 모드 3·4 칸(+0x4f · +0x50)은 읽는 곳이 없다)
 * −16        0xbd59d · S+0x12c → 135 · S+0xb4 → 128 · 그 밖 109
 * −3 · '4'   장면+0x164 = 1 · 밀기(8, 0, 4, 1000) → 143 (엔트리 편집)
 * −4 · '6'   장면+0x164 = 0 · 밀기(8, 0, 3, 1000) → 143
 * 그 밖      목록 [+0xa0] vt+0x18
 * ```
 * 그림 0x15d98: 공용 목록 `0x63b15([+0xd8], [+0xa0], 4, 이전 ≠ 143, 틀 수, −1)` — k 4 경기정보(일반모드·시즌 0xdd 와 같은 배치)
 * + 머리띠 0x7f4ed (틀 0x16928 의 142 갈래: 제목 8 타자편 / 9 투수편 · 바닥 5).
 */
import type { RandomPort } from '@/shared/api/random/randomPort'
import { rollOpponentAceIndex } from '@/entities/game/model/aceOpponent'
import type { League, PostseasonSeries } from '@/entities/league/model/league'
import { EMPTY_VALUE } from '@/pages/general-mode/lib/matchInfoLines'
import type { MatchInfoLine } from '@/pages/general-mode/lib/matchInfoLines'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import type { PlayerSide } from '@/entities/game/model/gameState'
import { leagueGamePitchersOf, nextOpponentOf } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { leagueGamePlayerSideOf } from '@/entities/career/model/leagueGameSetup'
import { teamPitchers } from '@/entities/team/model/teamRoster'
import { seasonMatchInfoLines } from '@/pages/season/lib/seasonMatchInfo'
import type { GameAceSetup } from '@/features/play-game/model/gameAces'
import type { NationalCup, NationalCupMatchup } from '@/entities/national-cup/model/nationalCup'

/** 마선수 번호가 없을 때 — 표 0xd7638[0] = −1 */
export const NO_NARI_ACE = -1

/** 마선수 한 역할의 칸 수 — 저장 +0x30..+0x34 · +0x35..+0x39 */
const ACE_SLOTS = 5

/** 열린 마선수 로컬 번호 0~4 (전역 저장 +0x30.. 마투수 · +0x35.. 마타자) */
export interface NariOpenedAces {
  readonly pitcherIds: readonly number[]
  readonly batterIds: readonly number[]
}

/** 142 진입이 두 팀에 넣은 마선수 번호 0~4 (없으면 −1) */
export interface NariMatchAces {
  readonly myBatter: number
  readonly myPitcher: number
  readonly opponentPitcher: number
  readonly opponentBatter: number
}

/** `0x9f604` / `0x9f650` — 칸 0..4 를 차례로 보며 열린 것만 쌓고 `bfa55(0, 개수)` 로 하나. 없으면 −1 */
function rollOpenedAce(random: RandomPort, opened: readonly number[]): number {
  const list = Array.from({ length: ACE_SLOTS }, (_unused, slot) => slot).filter((slot) => opened.includes(slot))
  const index = Math.trunc(random.nextInRange(0, list.length))
  return list.length === 0 ? NO_NARI_ACE : list[index]
}

/** 진입 0x1c46c 의 굴림 넷 — 내 마타자 → 내 마투수 → 상대 마투수 → 상대 마타자 (1c60c · 1c61a · 1c640 · 1c656) */
export function rollNariMatchAces(random: RandomPort, opened: NariOpenedAces): NariMatchAces {
  const myBatter = rollOpenedAce(random, opened.batterIds)
  const myPitcher = rollOpenedAce(random, opened.pitcherIds)
  const opponentPitcher = rollOpponentAceIndex(myPitcher, random)
  const opponentBatter = rollOpponentAceIndex(myBatter, random)
  return { myBatter, myPitcher, opponentPitcher, opponentBatter }
}

/**
 * 굴린 넷을 경기 팀에 싣는 꼴로 — 1c62e `0xb88c8(내 팀, p)` · `0xb8870(내 팀, b)` · 1c64e `0xb88c8(상대, …)` ·
 * 1c660 `0xb8870(상대, …)`. 마선수는 저장의 나리 팀 레코드(명부)에 들어가 경기 장면이 세우는 팀에 그대로 실린다
 * (`features/play-game/model/gameAces` 머리말). 레벨 배율은 전역 레벨 칸(`mgr[0x13a..]`)을 본다.
 */
export function nariGameAcesOf(aces: NariMatchAces, levels?: Readonly<Record<number, number>>): GameAceSetup {
  return {
    ours: { batter: aces.myBatter, pitcher: aces.myPitcher },
    opponent: { batter: aces.opponentBatter, pitcher: aces.opponentPitcher },
    ...(levels === undefined ? {} : { levels }),
  }
}

/** 142 취소(−16)가 갈 곳 — S+0x12c(국가대항전) → 135 · S+0xb4(포스트시즌) → 128 · 그 밖 109 (0x13c72~0x13cb4) */
export type NariMatchCancelTarget = '국가대항전' | '포스트시즌' | '다음경기순위'

export function nariMatchCancelTargetOf(state: { readonly isNationalCup: boolean; readonly isPostseason: boolean }): NariMatchCancelTarget {
  if (state.isNationalCup) return '국가대항전'
  return state.isPostseason ? '포스트시즌' : '다음경기순위'
}

/** 구장 번호가 그대로인 팀의 끝 — 기본 열 팀 0~9 (0x78664 의 `cmp r1, #9`) */
const LAST_HOME_STADIUM_TEAM = 9
/** 히든 팀 홈이면 고르는 구장 수 — `bfa55(0, 10)` */
const STADIUM_COUNT = 10

/**
 * 142 진입의 구장 `0x78664(무대, 홈 팀)` (1c7c6, 이전 상태가 143 이 아니면 — 장면+0x288 과 상관없이 들어올 때마다):
 * ```
 * 78664  홈 팀 ≤ 9 → 무대+0x70 = 홈 팀  /  그 밖 → 무대+0x70 = bfa55(0, 10)
 * ```
 * 나리 정규·포스트시즌 팀은 0~9 라 굴리지 않고, 국가대항전(10~13)만 한 번 굴린다. 웹은 구장 그림이 없어 값은 버린다.
 */
export function rollNariMatchStadium(random: RandomPort, homeTeamId: number): number {
  if (homeTeamId <= LAST_HOME_STADIUM_TEAM) return homeTeamId
  return Math.trunc(random.nextInRange(0, STADIUM_COUNT))
}

export interface NariMatchInfoInput {
  readonly league: League
  /** S+0xb4 — 있으면 순위 칸 "--" · 승패 칸은 이번 시리즈 */
  readonly postseason: PostseasonSeries | null
  readonly myTeamId: number
  readonly opponentTeamId: number
  /** 내 팀 레코드 0번 투수 이름 — 0x1c46c 가 로테이션을 돌린 뒤 (`0x5e0e8` 은 레코드 0번을 읽는다) */
  readonly myStarterName: string
  /** 상대 팀 투수 레코드 차례 — 0번이 선발 */
  readonly opponentPitcherOrder: readonly number[]
  /** 이번 장면에서 굴린 마선수 — 국가대항전이면 null("-") */
  readonly aces: NariMatchAces | null
  /** 진행 중인 국가대항전 (S+0x12c) — 있으면 순위·승패를 대회 표에서 읽는다(0x5dcc0 → 0xb834c) */
  readonly cup?: NationalCup | null
}

/**
 * 142 경기정보 다섯 줄 — 값 줄 0x5dcc0 은 모드 2·3·4 가 한 갈래다(R4 2d: 순위 · 승패는 0x1fcb5(저장, 모드)의 리그 레코드,
 * 선발 · 마선수는 0x1f9a9(저장, 모드, 팀) 레코드). 시즌 0xdd 의 `seasonMatchInfoLines` 를 나리 리그(S+0x80)로 부른다.
 */
export function nariMatchInfoLines(input: NariMatchInfoInput): readonly MatchInfoLine[] {
  const { aces } = input
  return seasonMatchInfoLines({
    league: input.league,
    series: input.postseason,
    cup: input.cup ?? null,
    inPostseason: input.postseason !== null,
    myTeamId: input.myTeamId,
    opponentTeamId: input.opponentTeamId,
    // 선발은 아래 두 값으로 준다 — 날짜 칸 셈은 안 쓴다
    dayCounter: 0,
    opponentPitcherOrder: input.opponentPitcherOrder,
    myStarterName: input.myStarterName,
    acePitcherId: aces?.myPitcher ?? NO_NARI_ACE,
    aceBatterId: aces?.myBatter ?? NO_NARI_ACE,
    opponentAces: aces === null ? null : { pitcher: aces.opponentPitcher, batter: aces.opponentBatter },
  })
}

/** 142 화면이 그리는 값 — 두 팀(rec+0 · rec+4) · 선공 측(rec+8) · 다섯 줄 */
export interface NariMatchScreenData {
  readonly lines: readonly MatchInfoLine[]
  readonly myTeamId: number
  readonly opponentTeamId: number
  readonly playerSide: PlayerSide
}

/**
 * 타자편(모드 4) 142 — 상대는 일정표·시리즈(`nextOpponentOf`), 측은 `0xb7844(L, 내 팀)`(1c4f0), 두 팀 선발은 0x1c46c 가
 * 돌린 레코드 0번(`leagueGamePitchersOf` — 경기를 세울 때와 같은 값)이다.
 */
export function batterMatchInfoOf(career: PlayerCareer, aces: NariMatchAces | null): NariMatchScreenData {
  const opponentTeamId = nextOpponentOf(career)
  const pitchers = leagueGamePitchersOf(career, opponentTeamId)
  return {
    lines: nariMatchInfoLines({
      league: career.league,
      postseason: career.postseason,
      myTeamId: career.teamId,
      opponentTeamId,
      myStarterName: teamPitchers(career.teamId)[pitchers.ourOrder[0] ?? 0]?.name ?? EMPTY_VALUE,
      opponentPitcherOrder: pitchers.opponentOrder,
      aces,
    }),
    myTeamId: career.teamId,
    opponentTeamId,
    playerSide: leagueGamePlayerSideOf(career),
  }
}

/**
 * 국가대항전 142 — 135 확인(0x10680)에서 온다. 내 팀은 `0xb7614(L, n, 0)` 의 대한민국(10), 상대는 그 라운드 대진.
 * 순위·승패는 대회 표, 마선수 칸은 "-"(1c5fe 가 안 넣는다).
 *
 * ⚠️ 근사(예전 그대로): 웹 국가대항전 경기는 두 팀 로테이션(0x1c46c 의 0xb8c80)과 측(0xb7844)을 아직 안 옮겨 날짜 0 차례 ·
 *    후공으로 친다(`useCareerSession.startCupGame` 주석). 선발 줄도 그 경기와 같은 값(두 팀 레코드 0번)을 적는다.
 */
export function cupMatchInfoOf(career: PlayerCareer, matchup: NationalCupMatchup, cup: NationalCup): NariMatchScreenData {
  return {
    lines: nariMatchInfoLines({
      league: career.league,
      postseason: null,
      myTeamId: matchup.myTeam,
      opponentTeamId: matchup.opponent,
      myStarterName: teamPitchers(matchup.myTeam)[0]?.name ?? EMPTY_VALUE,
      opponentPitcherOrder: teamPitchers(matchup.opponent).map((_pitcher, slot) => slot),
      aces: null,
      cup,
    }),
    myTeamId: matchup.myTeam,
    opponentTeamId: matchup.opponent,
    playerSide: PLAYER_SIDE_LAST_BAT,
  }
}
