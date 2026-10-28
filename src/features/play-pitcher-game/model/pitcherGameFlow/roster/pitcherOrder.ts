import { ACE_PITCHER_SLOT, type GameAcePitcher, gameAcePitcherOf, type GameTeamAces, NO_GAME_ACES } from '@/features/play-game/model/gameAces'
import { PITCHERS_PER_TEAM } from '@/entities/team/model/teamRoster'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import {
  isMyStartDay,
  PITCHER_EDITION_MODE,
  ROTATION_SIZE,
  rotationSlotOf,
  START_ASSIGNMENT,
  startAssignmentOf,
  swapWithStarter,
} from '@/entities/pitcher-career/model/pitcherRotation'
import { ACE_PITCHER_LIST_INDEX, MY_PITCHER_SLOT, OUR_ACE_PITCHER_SLOT } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/constants'
import type { PitcherGameOptions } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/optionsTypes'

/* ── 로테이션 ─────────────────────────────────────────────────────────────────── */

/** 오늘 내 투수가 선발인가 — 보직 선발이고 날짜 카운터가 짝수인 날 (0xa4f60 표, P1 1-2) */
export function startsToday(options: PitcherGameOptions): boolean {
  if (options.role !== PITCHER_ROLE.starter) return false
  const assignment = startAssignmentOf({
    mode: PITCHER_EDITION_MODE,
    dayCounter: options.dayCounter,
    role: options.role,
    isNationalCup: options.isNationalCup === true,
  })
  // keep(−2) = 시즌 첫 경기·포스트시즌이라 맞바꿈이 없다 → 로스터 0번이 곧 내 투수다
  if (assignment === START_ASSIGNMENT.keep) return true
  return isMyStartDay(options.dayCounter)
}

/** 날짜만큼 돈 4인 로테이션 (0xb8c80 → 0xb5ca8) — 0~3 칸은 `(g + i) % 4`, 4번 뒤는 그대로 */
function rotatedPitcherSlots(dayCounter: number): number[] {
  const first = rotationSlotOf(dayCounter)
  return Array.from({ length: PITCHERS_PER_TEAM }, (_unused, slot) => (slot < ROTATION_SIZE ? (first + slot) % ROTATION_SIZE : slot))
}

/**
 * 오늘 **우리 팀 투수 목록**의 차례 — 0번이 선발이고 나머지가 그 차례대로 벤치다 (`0xb891c` 의 `team[i] = i`,
 * `0xb8b08(team, i)` = 벤치 i 번).
 *
 * 리그 경기는 레코드 차례(`options.ourPitcherOrder`)를 받는다. 안 넘긴 길의 예전 셈:
 * - 선발 보직: 등록 꼴 `[나, 1, …, 7, 0]` 위에서 `0xa4f60` 의 k 로 0↔k 를 맞바꾼다. 내 선발 날(g 짝수)은 맞바꿈이 되돌아와
 *   내가 0번이다 (레코드 차례와 같다).
 * - 그 밖(구원): 0~3 이 날마다 돌고(0xb8c80) 나는 끝 — 원본 등록 꼴(나 7번)과 다르다.
 */
export function ourPitcherOrderOf(options: PitcherGameOptions): number[] {
  const order = options.ourPitcherOrder === undefined ? rosterOurPitcherOrderOf(options) : [...options.ourPitcherOrder]
  // 142 가 명부 8번 칸에 마투수를 넣었으면 옛 8번(웹 목록 끝)은 맨 끝으로 밀린다 (0xb521c b527e~b528e)
  if (gameAcePitcherOf(teamAcesOf(options, true).pitcher, undefined) === undefined) return order
  return [...order.slice(0, ACE_PITCHER_LIST_INDEX), OUR_ACE_PITCHER_SLOT, ...order.slice(ACE_PITCHER_LIST_INDEX)]
}

/** 한 팀에 실린 마선수 번호 */
export function teamAcesOf(options: PitcherGameOptions, isOurs: boolean): GameTeamAces {
  return (isOurs ? options.aces?.ours : options.aces?.opponent) ?? NO_GAME_ACES
}

/** 그 팀 명부의 마투수 — 레벨 배율 먹은 값. 없으면 undefined */
export function teamAcePitcherOf(options: PitcherGameOptions, isOurs: boolean): GameAcePitcher | undefined {
  return gameAcePitcherOf(teamAcesOf(options, isOurs).pitcher, options.aces?.levels)
}

/** 그 팀 마투수의 웹 칸 번호 */
export function acePitcherSlotOf(isOurs: boolean): number {
  return isOurs ? OUR_ACE_PITCHER_SLOT : ACE_PITCHER_SLOT
}

/** 로스터만으로 짠 우리 팀 투수 목록 (마투수 넣기 앞) */
function rosterOurPitcherOrderOf(options: PitcherGameOptions): number[] {
  const assignment = startAssignmentOf({
    mode: PITCHER_EDITION_MODE,
    dayCounter: options.dayCounter,
    role: options.role,
    isNationalCup: options.isNationalCup === true,
  })
  if (options.role !== PITCHER_ROLE.starter) return [...rotatedPitcherSlots(options.dayCounter), MY_PITCHER_SLOT]
  const seasonStart = [MY_PITCHER_SLOT, ...Array.from({ length: PITCHERS_PER_TEAM - 1 }, (_unused, slot) => slot + 1), 0]
  return startsToday(options) || assignment < 1 ? seasonStart : swapWithStarter(seasonStart, assignment)
}

/**
 * 상대 팀 투수 목록 — 하루 한 칸씩 도는 4인 로테이션 (0xb8c80 → 0xb5ca8, S5 U-16). 0번이 오늘 선발이다.
 * 리그가 들고 다니는 차례(`options.opponentPitcherOrder`)가 있으면 그것이다.
 */
export function opponentPitcherOrderOf(options: PitcherGameOptions): readonly number[] {
  const order = options.opponentPitcherOrder ?? rotatedPitcherSlots(options.dayCounter)
  // 142 가 상대 명부 8번 칸(로스터 여덟 뒤 = 벤치 맨 끝)에 넣은 마투수 (0xb88c8)
  return teamAcePitcherOf(options, false) === undefined ? order : [...order, ACE_PITCHER_SLOT]
}
