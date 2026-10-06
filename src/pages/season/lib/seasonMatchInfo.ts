/**
 * **시즌 경기정보 0xdd 의 값 줄** — 공용 목록 k 4 의 값 칸 `0x5dcc0(skin, x0, y0, 1)` 시즌(모드 2) 갈래.
 *
 * 줄 종류는 일반모드와 같은 다섯 줄(순위·승패·선발·마투수·마타자)이고, 두 팀은 rec+0(내 팀) ·
 * rec+4(상대) 다 — 0x6548 이 `this+0xfc..` 를 rec 로 되쓴 값이라 국가대항전이면 내 쪽이 대한민국(10)이다.
 * 직접 뜬 갈래(0x5df40~0x5dfea · 0x5e2ce~0x5e3fe):
 * ```
 * R = 0x1fcb5(저장, 모드)                         ; 리그 레코드 L (시즌은 SR+0x80)
 * 순위: L+0xac(국가대항전) ? 0xb834c(L, 팀) : 0xb7aa0(L, 팀, 0)   → 값 + 1
 *       L+0x34(포스트시즌) 이면 "--"(0xd2160), 아니면 숫자만(0x6f598, 자리 쉼표 없음 · "위" 없음)
 * 승패: L+0xac ? 0xb847c / 0xb84a0 (대회 승 L+0xb0+i · 패 L+0xb4+i)
 *              : 0xb7908(L, 팀, 0) / 0xb7968(L, 팀, 0)             → "%d승%d패"(0xd2154)
 *       0xb7908 은 L+0x34 면 **이번 시리즈 승** = (길이 표 0xd89c8[r] >> 1) − 남은 승수 + 1,
 *       0xb7968 은 L+0x32 − 그 값 (= 이번 라운드 경기 수 − 승) 이다.
 * 선발: 투수 0번 — 0x6548 이 로테이션(0xb8c80)을 돌린 뒤라 그날 선발이다
 * 마투수 · 마타자: 0xb56b5 · 0xb56e1 (팀 안 마선수 찾기, 없으면 "-")
 * ```
 */
import { rankingOf } from '@/entities/league/model/league'
import type { League, PostseasonSeries } from '@/entities/league/model/league'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'
import { teamPitchers } from '@/entities/team/model/teamRoster'
import { rotationSlotOf } from '@/entities/pitcher-career/model/pitcherRotation'
import { MATCH_INFO_LABEL_FRAMES } from '@/pages/general-mode/lib/prepareLayout'
import { EMPTY_VALUE, aceBatterNameOf, acePitcherNameOf } from '@/pages/general-mode/lib/matchInfoLines'
import type { MatchInfoLine } from '@/pages/general-mode/lib/matchInfoLines'

/** 포스트시즌 중 순위 칸 — 0xd2160 `"--"` */
export const POSTSEASON_RANK_TEXT = '--'

/**
 * **국가대항전 순위 `0xb834c(L, 팀)`** — 0부터. 못 찾으면 0.
 *
 * 4국 표(팀 L+0xa8 · 승 L+0xb0 · 패 L+0xb4)를 지역에 복사해 교환정렬한다. ⚠️ **원본 그대로 옮긴 모양**:
 * ```
 * for i = 0..3:
 *   for j = i..2:                  ; b83de~b844c — j 가 i 에서 시작해 **2 에서 멈춘다**
 *     승[i] < 승[j]                 → 세 칸을 맞바꿈
 *     승[i] == 승[j] && 패[i] > 패[j] → 맞바꿈
 * ```
 * 그래서 **넷째 칸(미국, 13)은 한 번도 견주지 않아 늘 4위**다. 대진표 순위 `0xb7f0c`
 * (`nationalCupRankingOf`)와 다른 함수다 — 고치지 않는다.
 */
export function nationalCupMatchInfoRankOf(cup: NationalCup, team: number): number {
  const teams = [...cup.teams]
  const wins = [...cup.wins]
  const losses = [...cup.losses]
  const swap = (i: number, j: number) => {
    ;[teams[i], teams[j]] = [teams[j], teams[i]]
    ;[wins[i], wins[j]] = [wins[j], wins[i]]
    ;[losses[i], losses[j]] = [losses[j], losses[i]]
  }
  for (let i = 0; i < teams.length; i += 1) {
    for (let j = i; j <= 2; j += 1) {
      if (wins[i] < wins[j]) swap(i, j)
      else if (wins[i] === wins[j] && losses[i] > losses[j]) swap(i, j)
    }
  }
  return Math.max(0, teams.indexOf(team))
}

export interface SeasonMatchInfoInput {
  readonly league: League
  /** 포스트시즌 시리즈 — L+0x34 가 서 있을 때 승패 칸이 이번 시리즈 승패다 */
  readonly series: PostseasonSeries | null
  /** 진행 중인 국가대항전 (L+0xac) — 있으면 순위·승패를 대회 표에서 읽는다 */
  readonly cup: NationalCup | null
  /** L+0x34 = SR+0xb4 */
  readonly inPostseason: boolean
  /** rec+0 — 경기에 들어갈 내 팀 (국가대항전이면 10) */
  readonly myTeamId: number
  /** rec+4 */
  readonly opponentTeamId: number
  /**
   * 로테이션 칸을 고르는 값 — 경기 옵션의 `dayCounter` 와 같은 값. 시즌 세션은 정규시즌·포스트시즌에서 날짜 g 가 아니라
   * **리그 투수 레코드 차례로 센 선발 칸**(`seasonLeagueStarterSlotOf` · `postseasonStarterSlotOf`, 0~3)을 넣는다 —
   * 차례가 투수 0~3 을 k 칸 돌린 모양이라 `rotationSlotOf(k) = k` 가 곧 그 차례의 0번이다
   */
  readonly dayCounter: number
  /** 상대 칸만 다른 날짜 — 국가대항전 상대국은 첫날 0 · 그 뒤 1 (경기 옵션 `opponentDayCounter`). 없으면 `dayCounter` */
  readonly opponentDayCounter?: number
  /** 내 팀에 넣은 마투수 0..4 (없으면 −1) */
  readonly acePitcherId: number
  /** 내 팀에 넣은 마타자 0..4 (없으면 −1) */
  readonly aceBatterId: number
  /** 0xdd 진입 0x6548 이 상대 팀에 넣은 마투수·마타자 0..4 (`0x66968`·`0x66994`). 없으면(국가대항전) "-" */
  readonly opponentAces?: { readonly pitcher: number; readonly batter: number } | null
  /**
   * 내 팀 "선발" 값 — 엔트리 편집(0xe0)이 고친 명단의 투수 0번 (`seasonEntry.seasonStarterNameOf`).
   * 없으면 붙박이 표의 로테이션 칸으로 셈한다.
   */
  readonly myStarterName?: string | null
}

const LABELS = ['순위', '승패', '선발', '마투수', '마타자'] as const

function rankTextOf(input: SeasonMatchInfoInput, team: number): string {
  if (input.inPostseason) return POSTSEASON_RANK_TEXT
  const rank = input.cup !== null
    ? nationalCupMatchInfoRankOf(input.cup, team)
    // 0xb7aa0(L, 팀, 0) 은 L+0x34·L+0x36 이 모두 0 이면 정규 순위표 갈래(b7afc)다
    : Math.max(0, rankingOf(input.league).indexOf(team))
  return String(rank + 1)
}

function winLossTextOf(input: SeasonMatchInfoInput, team: number): string {
  const format = (wins: number, losses: number) => `${wins}승${losses}패`
  if (input.cup !== null) {
    const index = input.cup.teams.indexOf(team)
    return format(input.cup.wins[index] ?? 0, input.cup.losses[index] ?? 0)
  }
  if (input.inPostseason && input.series !== null) {
    const side = input.series.teams.indexOf(team)
    // 0xb7968 = L+0x32(이번 라운드 경기 수) − 이번 시리즈 승 — 웹 시리즈는 경기 수 대신 두 팀 승을 들고 있어
    // 상대 승으로 같은 값을 낸다 (라운드마다 L+0x32 가 0 부터인 것은 유력)
    if (side < 0) return format(-1, -1)
    return format(input.series.wins[side], input.series.wins[1 - side])
  }
  return format(input.league.wins[team] ?? 0, input.league.losses[team] ?? 0)
}

/** 그 팀 붙박이 표에서 `rotationSlotOf(값)` 칸 투수 — 값은 위 `dayCounter` 주석대로 리그 차례의 선발 칸이다 */
function starterNameOf(team: number, dayCounter: number): string {
  return teamPitchers(team)[rotationSlotOf(dayCounter)]?.name ?? EMPTY_VALUE
}

/**
 * 시즌 경기정보 다섯 줄.
 *
 * 상대 마선수: 원본 0x6548 은 정규·포스트시즌에서 상대 팀에도 `0x66968`·`0x66994` 로 굴린 마투수·마타자를
 * 넣는다(66f8·670a) — 0xb56b5·0xb56e1 이 팀 레코드에서 그 마선수를 찾아 보인다. 웹은 0xdd 진입에서 굴린
 * 값(경기 옵션 `opponentAces`)을 받는다. 국가대항전은 안 넣어(66ae) "-" 다.
 * 국가대항전 상대 선발은 day 0 이면 0번 · 그 뒤로는 늘 1번이다(7dd3826) — `opponentDayCounter` 로 받는다.
 */
export function seasonMatchInfoLines(input: SeasonMatchInfoInput): readonly MatchInfoLine[] {
  const { myTeamId, opponentTeamId } = input
  const values: readonly (readonly [string, string])[] = [
    [rankTextOf(input, myTeamId), rankTextOf(input, opponentTeamId)],
    [winLossTextOf(input, myTeamId), winLossTextOf(input, opponentTeamId)],
    [
      input.myStarterName ?? starterNameOf(myTeamId, input.dayCounter),
      starterNameOf(opponentTeamId, input.opponentDayCounter ?? input.dayCounter),
    ],
    [acePitcherNameOf(input.acePitcherId), acePitcherNameOf(input.opponentAces?.pitcher ?? -1)],
    [aceBatterNameOf(input.aceBatterId), aceBatterNameOf(input.opponentAces?.batter ?? -1)],
  ]
  return values.map(([user, cpu], index) => ({
    labelFrame: MATCH_INFO_LABEL_FRAMES[index],
    label: LABELS[index],
    user,
    cpu,
  }))
}
