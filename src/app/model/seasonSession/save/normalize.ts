import { type TeamGameProgress, migrateTeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { normalizeSeasonState } from '@/entities/season-mode/model/seasonRecord'
import { EMPTY_LEAGUE, withSemiPlayoffWinner } from '@/entities/league/model/league'
import { EMPTY_LEAGUE_PLAYER_STATS } from '@/entities/league/model/leaguePlayerStats'
import type { SeasonTeamRoster, SeasonPlayer } from '@/entities/season-mode/model/playerRecruit'
import { clearRepeatableSeen } from '@/entities/season-mode/model/seasonEventFlow'
import { SEASON_GAME_MODE } from '@/app/model/seasonSession/constants/seasonConstants'
import { rosterOf, withTablePositions } from '@/app/model/seasonSession/roster/roster'
import type { SeasonGameSaveBlock, SeasonSave } from '@/app/model/seasonSession/save/seasonSave'
import { fullCpuPitcherStaminas, withFullRosterStamina } from '@/app/model/seasonSession/stamina/stamina'
import type { SeasonGameKind } from '@/app/model/seasonSession/types/session'

const SEASON_GAME_KINDS: readonly SeasonGameKind[] = ['정규', '포스트시즌', '국가대항전']

/**
 * **시즌 경기 블록 → 이어 세울 진행.** 시즌 저장이 블록을 모르는 값으로 들고 있으므로 시즌(모드 2) 경기 진행인지 가려 낸다.
 * ⚠️ 웹 전용(남김 — 옛 저장 호환, Q-13): 원본은 파일을 그대로 올린다(0x213c0). 웹은 진행 꼴이 바뀌어 옛 블록을 못 읽으면 null(저장 없음)로
 * 거른다. 읽는 곳은 저장을 올릴 때(`normalizeGameSave`) 하나 — r325 전체 시험 계측에서 null 갈래는 이 함수의 단위 시험(옛 꼴 블록)만 지났다.
 * 웹 판이 저장 꼴을 넓히기 전에 쓴 브라우저 저장을 위해 남긴다.
 */
export function seasonGameProgressOf(raw: unknown): TeamGameProgress | null {
  if (!isObject(raw)) return null
  const progress = raw as Partial<TeamGameProgress>
  if (!isSeasonGameOptions(progress.options) || !isGameInHalf(progress.game) || !hasEntries(progress)) return null
  // 꼴이 넓어진 칸은 옛 블록 이사(`migrateTeamGameProgress`)가 채운다
  return migrateTeamGameProgress(raw as TeamGameProgress)
}

const isObject = (value: unknown): value is object => value !== null && value !== undefined && typeof value === 'object'

/** 시즌(모드 2) 경기 옵션인가 */
function isSeasonGameOptions(options: Partial<TeamGameProgress>['options']): boolean {
  return isObject(options) && options.mode === SEASON_GAME_MODE
}

/** 이닝 수 · 초/말이 선 경기 칸인가 */
function isGameInHalf(game: Partial<TeamGameProgress>['game']): boolean {
  if (!isObject(game)) return false
  return typeof game.inning === 'number' && (game.half === '초' || game.half === '말')
}

/** 양 팀 타자 · 투수 명단이 모두 배열인가 */
function hasEntries(progress: Partial<TeamGameProgress>): boolean {
  const { ourEntry, opponentEntry, ourPitcherEntry, opponentPitcherEntry } = progress
  return [ourEntry, opponentEntry, ourPitcherEntry, opponentPitcherEntry].every((entry) => Array.isArray(entry))
}

/** 저장의 경기 블록을 고른다 — 꼴이 안 맞으면 null */
function normalizeGameSave(raw: unknown): SeasonGameSaveBlock | null {
  if (raw === null || typeof raw !== 'object') return null
  const value = raw as Partial<Record<keyof SeasonGameSaveBlock, unknown>>
  const progress = seasonGameProgressOf(value.progress)
  if (progress === null) return null
  const kind = SEASON_GAME_KINDS.find((candidate) => candidate === value.kind)
  if (kind === undefined) return null
  const shift = typeof value.ownRotationShift === 'number' && Number.isInteger(value.ownRotationShift) ? value.ownRotationShift : 0
  return { progress, kind, ownRotationShift: shift }
}

/**
 * 저장에서 읽은 것을 쓸 수 있는 모양으로 만든다.
 *
 * 저장은 그냥 JSON 이라 **필드가 늘기 전에 저장한 세이브**에는 나중에 생긴 칸이 아예 없다.
 * 예전에는 `as SeasonSave` 로 캐스팅만 해서 그 `undefined` 가 그대로 흘렀고, 경기 한 판만
 * 끝내도 `seasonReputation` 의 `score -= s[1]` 에서 터졌다. 나만의리그 쪽 `normalizeCareer`
 * 와 같은 자세로 **빠진 칸만 기본값으로 채운다** — 있는 값은 손대지 않는다.
 */
export function normalizeSeasonSave(saved: Partial<SeasonSave> | null): SeasonSave | null {
  if (!isObject(saved)) return null
  // 시즌 초기화(`resetSeason` — game_s.sav 지움)가 남긴 덩어리 — 저장소에 clear 가 없어 전역 칸 둘만 남긴 덩어리
  // (`SeasonGlobalCarry`)를 덮어쓴다. 시즌은 없다
  if (saved.state === undefined) return null
  const state = normalizeSeasonState(saved.state)
  // 옛 저장(칸 없음)은 경기 저장 없음 — 블록을 못 읽으면 +0x4e 도 내린다(웹 전용, 블록 없이 표시만 설 수는 없다)
  const gameSave = normalizeGameSave(saved.gameSave)
  return {
    ...saved,
    isGameInProgress: saved.isGameInProgress === true && gameSave !== null,
    gameSave,
    state,
    league: saved.league ?? EMPTY_LEAGUE,
    roster: savedRosterOf(saved, state.record.teamId),
    // 레코드 마선수 칸이 생기기 전 저장 — 마선수가 빠진 레코드(0xb512c 뒤)로 이사한다(그날 넣은 마선수는 남아 있지 않다)
    recordAces: saved.recordAces ?? {},
    ...cupPlayerStatsSlotOf(saved),
    playerStats: saved.playerStats ?? EMPTY_LEAGUE_PLAYER_STATS,
    cpuPitcherStaminas: saved.cpuPitcherStaminas ?? fullCpuPitcherStaminas(state.record.teamId),
    ...seriesSlotOf(saved.series),
  }
}

/** 준PO 승자 칸(L+0x3b)이 생기기 전 시리즈 이사 — `withSemiPlayoffWinner`. 시리즈가 없으면 칸을 그대로 둔다 */
function seriesSlotOf(series: SeasonSave['series']): Pick<SeasonSave, 'series'> {
  return series === undefined || series === null ? {} : { series: withSemiPlayoffWinner(series) }
}

/** 명단 — 없으면 표 명단, 있으면 표 수비 위치를 얹는다. 스태미나 표가 생기기 전 저장은 명단 투수를 10000 으로 */
function savedRosterOf(saved: Partial<SeasonSave>, teamId: number): SeasonTeamRoster {
  const roster = saved.roster === undefined ? rosterOf(teamId) : withTablePositions(saved.roster, teamId)
  // 스태미나 표가 생기기 전 저장은 명단 투수를 0(표에서 만든 값)으로 적었고 경기는 늘 10000 으로 쳤다 —
  // 그 값 그대로 10000 으로 채운다
  const staminaKnown = saved.cpuPitcherStaminas !== undefined
  return withRecordSalaryGrades(staminaKnown ? roster : withFullRosterStamina(roster))
}

/** 대회 중 저장인데 대표팀 쌓임 칸이 없으면 빈 표로 이사 — 그 전 경기들이 쌓은 +0x2a · +0x2e 는 남아 있지 않다 */
function cupPlayerStatsSlotOf(saved: Partial<SeasonSave>): Pick<SeasonSave, 'cupPlayerStats'> {
  const cupActive = saved.cup !== undefined && saved.cup !== null
  return cupActive ? { cupPlayerStats: saved.cupPlayerStats ?? EMPTY_LEAGUE_PLAYER_STATS } : {}
}

/**
 * **영입 기록 사본의 +0x1b 이사** — 원본 영입 0xc554 는 기록 0x30 바이트를 통째로 옮겨 +0x1b(연봉 칸)가 늘 있다. 웹 사본
 * (`SeasonPlayer.record`)이 `salaryGrade` 를 들기 전(2026-10-16) 영입한 선수는 칸이 비어 있고 영입 때 값은 남아 있지 않다 —
 * 예전 웹이 비운 칸을 0 으로 찍던 대로(상세 창 0x5b798 연봉 0) 0 을 채운다. 바꿀 것이 없으면 같은 명단
 */
export function withRecordSalaryGrades(roster: SeasonTeamRoster): SeasonTeamRoster {
  const fill = (players: readonly SeasonPlayer[]) =>
    players.some((player) => player.record !== undefined && player.record.salaryGrade === undefined)
      ? players.map((player) =>
          player.record === undefined || player.record.salaryGrade !== undefined
            ? player
            : { ...player, record: { ...player.record, salaryGrade: 0 } },
        )
      : players
  const pitchers = fill(roster.pitchers)
  const batters = fill(roster.batters)
  return pitchers === roster.pitchers && batters === roster.batters ? roster : { ...roster, pitchers, batters }
}

/**
 * 장면 0x105 를 만들 때(`0x3b14` 4016 `0x8ce94` → `0xacf60`) — 반복 이벤트의 본 비트를 지운다.
 * 메모리에서만 지우고 저장은 다음 저장 때 같이 된다.
 */
export function withSceneConstructed(save: SeasonSave | null): SeasonSave | null {
  if (save === null) return null
  const record = clearRepeatableSeen(save.state.record)
  return record === save.state.record ? save : { ...save, state: { ...save.state, record } }
}
