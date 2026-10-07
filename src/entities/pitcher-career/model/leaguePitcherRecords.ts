import {
  pitcherOrderOf,
  postseasonPitcherOrderOf,
  rotateLeaguePitchers,
} from '@/entities/league/model/league'
import type { League, PostseasonSeries } from '@/entities/league/model/league'
import type { PitcherStaminaTable } from '@/entities/league/model/postseasonPlay'
import { cpuGameRotationAdvances } from '@/entities/pitcher-career/model/pitcherRotation'
import { recoverStaminaAfterGameDay } from '@/entities/pitcher-career/model/pitcherStamina'
import {
  leaguePitcherAppearancesOf,
  recordLeaguePitcherAppearances,
} from '@/entities/league/model/leaguePlayerStats'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats'
import type { GameLeaguePitchers } from '@/entities/game/model/gamePitcherLines'
import type { PitcherOfRecord } from '@/entities/game/model/winLossSave'
import { PITCHERS_PER_TEAM } from '@/entities/team/model/teamRoster'

/**
 * **나만의리그(타자편 모드 4 · 투수편 모드 3) 리그 팀 투수 레코드** — 차례와 스태미나 `+0x2c`.
 *
 * 두 편 모두 리그 열 팀의 저장 레코드를 경기 사이에 그대로 들고 간다 (직접 떴다):
 * ```
 * 0x1c46c 경기 준비   1c576  g = S+0xb2 ; g ≠ 0 이면 두 팀 0xb8c80 → 0xb5ca8 (모드 3 내 팀은 0xa4f60 맞바꿈)
 *                     1c8a8  g == 0 이면 i = 0..9: 0xb6190(0x1f9a9(저장, 모드, i))   ; 열 팀 투수 전원 10000
 * 0x4ea0c 경기 끝     정규: 내 경기 → 4f296 CPU 경기 0xc2a48 → 4f29a 하루 끝 0xb818c
 *                     포스트시즌(L+0x34): 4f268 → 곧장 4f29a (CPU 리그 경기 없음)
 *                     4f2a2 모드 4 → 4f2e8 · 모드 3 → 4f304: i = 0..9: 0xb617c(0x1f989(저장, i))   ; 열 팀 +회복
 * 0x13da0 대진 [확인] CPU 끼리 포스트시즌 0xc2760 — +0x2c 를 깎기만 한다(회복 없음)
 * ```
 * g 는 정규시즌이면 치른 경기 수, 포스트시즌이면 **그 시리즈에서 치른 경기 수**라 시리즈 첫 경기마다 0 이다
 * (`leagueDayCounterOf`) — 그래서 열 팀 10000 채우기는 시즌 첫 경기와 시리즈마다의 첫 사람 경기 준비에서 돈다.
 * 회복량 0x66ed0 은 모드 3 의 내 육성 선수(40%·80%)가 아니면 20% 다 — 내 투수는 커리어가 따로 든다.
 *
 * 투수편 내 투수도 내 팀 레코드 투수 배열의 한 줄이라(등록 0x10fb4 → 0xb521d · `0x1fbd1` = 그 줄) g == 0 의 0xb6190 이 내 +0x2c 도
 * 10000 으로 채운다 — 포스트시즌 시리즈마다 첫 경기 포함. 웹은 내 스태미나를 커리어 칸(`stamina`)이 들고 142 준비가 채운다
 * (`pitcherCareer.prepareMyPitcherMatch`).
 */

/** 리그 표를 든 커리어 칸 */
export interface LeaguePitcherRecordFields {
  readonly league: League
  readonly postseason: PostseasonSeries | null
  /** 팀 번호 → 붙박이 표 칸(0~7)별 레코드 `+0x2c`. 없는 팀·칸은 10000 */
  readonly leaguePitcherStaminas?: PitcherStaminaTable
}

/** 지금 포스트시즌 대진이 돌고 있는가 — 끝난 대진(`종료`)은 정규시즌 셈으로 돌아간다 */
function isPostseasonRunning(series: PostseasonSeries | null): series is PostseasonSeries {
  return series !== null && series.round !== '종료'
}

/**
 * 사람 경기 준비 `0x1c46c` 가 세운 그 팀의 **투수 레코드 차례** — 0번이 선발, 나머지가 벤치 차례.
 *
 * - 정규시즌: 리그 차례(`League.pitcherOrders`)를 g ≠ 0 이면 0xb5ca8 로 한 칸 돌린 것. 그날 CPU 경기를 돌리는
 *   `playLeagueDay` 가 같은 칸을 리그에 남긴다(타자편 `rotatesHumanGameTeams` 참 · 투수편은 상대만 — `applyPitcherLeagueDay`).
 * - 포스트시즌: 정규시즌 끝 차례 + 앞 시리즈에서 이어 온 칸 + 이 시리즈 g 칸 (`postseasonPitcherOrderOf`).
 */
export function humanGamePitcherOrderOf(
  fields: LeaguePitcherRecordFields,
  mode: number,
  dayCounter: number,
  teamId: number,
): readonly number[] {
  if (isPostseasonRunning(fields.postseason)) return postseasonPitcherOrderOf(fields.postseason, teamId)
  const league = cpuGameRotationAdvances(mode, dayCounter) ? rotateLeaguePitchers(fields.league, [teamId]) : fields.league
  return pitcherOrderOf(league, teamId)
}

/** 사람 경기 준비 뒤 그 팀의 칸별 레코드 `+0x2c` — g == 0 이면 1c8a8 이 열 팀을 10000 으로 채운다(없음 = 10000) */
export function humanGamePitcherStaminasOf(
  fields: LeaguePitcherRecordFields,
  dayCounter: number,
  teamId: number,
): readonly number[] | undefined {
  if (dayCounter === 0) return undefined
  return fields.leaguePitcherStaminas?.[teamId]
}

/** 사람 경기 끝 표 — 준비가 채운 표(g == 0 이면 빈 표 = 전원 10000)에 두 팀 경기 끝 값을 되적는다 */
export function staminaTableAfterHumanGame(
  fields: LeaguePitcherRecordFields,
  dayCounter: number,
  teams: readonly { readonly teamId: number; readonly staminas: readonly number[] | undefined }[],
): PitcherStaminaTable {
  const table: Record<number, readonly number[]> = dayCounter === 0 ? {} : { ...fields.leaguePitcherStaminas }
  for (const team of teams) {
    if (team.staminas !== undefined) table[team.teamId] = team.staminas
  }
  return table
}

/** 하루 끝 4f2e8(모드 4)·4f304(모드 3) — 열 팀 투수 모두 `0xb617c` (내 육성 선수가 아니면 +20%, 10000 에서 자름) */
export function recoveredLeagueStaminas(table: PitcherStaminaTable, mode: number): PitcherStaminaTable {
  const recovered: Record<number, readonly number[]> = {}
  for (const [team, staminas] of Object.entries(table)) {
    recovered[Number(team)] = staminas.map((stamina) =>
      recoverStaminaAfterGameDay(stamina, { mode, isMine: false, isStarterRole: false }),
    )
  }
  return recovered
}

/**
 * 사람 경기 투수 줄을 리그 선수 기록표에 쌓는다 — 정산 0xa8024 · 경기 끝 0xa7de8 이 CPU 끼리 경기와 같은 칸을 올린다.
 *
 * 투수 칸 쓰기(아웃 0xa8cca · 탈삼진 0xa8d1c · 실점 0xa8ef4)는 `[sp+0x38] = 0xa56dc(R, 0xae83c(수비 팀), 0)` 이 참일 때만
 * 돈다(a8044~a804e). 0xa56dc 의 모드 3·4 갈래(점프표 0xd8204 → 0xa571c)는 시즌 객체 0x1fa2d 의 +0x12c(국가대항전)·
 * +0xb4(포스트시즌)가 서 있으면 거짓 — 그래서 **정규시즌 경기만** 쌓는다(`isRegularSeason`). 마선수(0xb633d)도 거짓이지만
 * 나만의리그 사람 경기 로스터에는 마선수가 없다. 내 육성 선수(표 밖 칸)는 커리어가 따로 센다 — 건너뛴다.
 */
export function recordHumanGamePitchers(
  stats: LeaguePlayerStats,
  pitchers: GameLeaguePitchers | undefined,
  isRegularSeason: boolean,
): LeaguePlayerStats {
  if (pitchers === undefined || !isRegularSeason) return stats
  const recordOf = (record: PitcherOfRecord | null) =>
    record === null ? null : { side: record.side, pitcherSlot: record.number }
  const appearances = leaguePitcherAppearancesOf(
    pitchers.lines,
    {
      winner: recordOf(pitchers.decision.winner),
      loser: recordOf(pitchers.decision.loser),
      save: recordOf(pitchers.decision.save),
    },
    (side) => pitchers.sideTeams[side] ?? pitchers.sideTeams[0],
    (_teamId, pitcherSlot) => pitcherSlot < 0 || pitcherSlot >= PITCHERS_PER_TEAM,
  )
  return recordLeaguePitcherAppearances(stats, appearances)
}
