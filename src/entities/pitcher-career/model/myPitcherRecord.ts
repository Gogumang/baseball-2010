import { PITCHERS_PER_TEAM } from '@/entities/team/model/teamRoster'
import {
  MY_RECORD_SLOT,
  nariTeamRecordOf,
  nariTeamsOf,
  withNariTeamRecord,
} from '@/entities/career/model/nariTeamRecord'
import type { NariTeamRecordFields, NariTeamRecords } from '@/entities/career/model/nariTeamRecord'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'
import {
  PITCHER_EDITION_MODE,
  START_ASSIGNMENT,
  advanceRotation,
  startAssignmentOf,
  swapWithStarter,
} from '@/entities/pitcher-career/model/pitcherRotation'

/**
 * **투수편 내 팀 투수 배열** — 나리 팀 레코드(`[저장+0xb8] + 4 + 0x1c·내 팀`)의 투수 배열. 내 투수는 그 배열 안의 한 줄이다
 * (`0x1fbd1` = `[g+0x3c]` = `0x1faa1` 이 레코드에서 +0xa 부호비트가 선 첫 줄을 찾아 둔 포인터). 직접 떴다:
 * ```
 * 등록 0x10fb4 (110e2~11228)  내 투수 사본 +0x2c = 10000 ; 보직(+0xb & 3) 0 → 0xb6605(rec, 0) · 2 → 0xb6605(rec, 7)
 *                              (보직 1 은 생성 0x17360 이 쓴 0x80 그대로 → 칸 0) ; 0x204e1(g,3,1) ; 0xb521d(0x1f9a9(g,3,팀), rec, 1)
 * 0xb521c 0x80 갈래 (b52ae~)   배열을 하나 늘려 칸 t(+0xa & 0x1f)의 선수를 맨 끝으로 옮기고 칸 t 에 내 투수
 *                              → 선발 [나, 1, …, 7, 0] · 구원 [0, …, 6, 나, 7]
 * 142 진입 0x1c46c (1c560~)    이전 상태 143 이거나 장면+0x288 이면 건너뜀(마선수 넣기와 같은 문) ;
 *                              g == 0 → 0x1b684 (보직 2 면 그냥, 아니면 내 투수 칸 k 와 0 맞바꿈 0xb5e99) ;
 *                              0xa4f60: −1 → 0xb8c80(내 팀) 0~3 돌리기 · −2 → 없음 · k ≥ 1 → 0xb8c94(내 팀, 0, k) — 모두 영구
 * 0xb8768 → 0xb603c            마선수가 아닌 줄의 칸 번호(+0xa 아랫 5비트)를 첨자로 — 내 투수도. 경기 장면 0x3a2fa 가 다시 매겨
 *                              116 평가(0x1285a · 0xa6aa4)가 보는 포지션 코드 `0xb6394` = **그날 맞바꿈 뒤 내 칸**
 * 0x1c8a8                      g == 0 → 열 팀 `0xb6190` — 내 팀 레코드라 **내 투수 +0x2c 도 10000**
 * ```
 * 선발은 맞바꿈이 두 날씩 짝으로 되돌아와 예전 셈(`[나, 1…7, 0]` 위 0↔k)과 같다. 구원은 내가 7번 칸(옛 7번은 8번)이고,
 * 0~3 이 포스트시즌 경기까지 날마다 영구로 돌아 시즌을 넘어 이어진다.
 */

/** 진행기 쪽 내 투수 칸 번호 — `features/play-pitcher-game` 의 `MY_PITCHER_SLOT`(표 밖 8)과 같은 값 */
const GAME_MY_PITCHER_SLOT = PITCHERS_PER_TEAM

/** 구원 보직의 등록 칸 — `0xb6605(rec, 7)` (0x111aa) */
const RELIEF_REGISTRATION_SLOT = 7

/** 등록 0x10fb4 가 내 투수 +0xa 에 쓰는 칸 — 선발 0 · 구원 7 · 보직 1 은 생성값 0x80 의 0 */
export function myPitcherRegistrationSlotOf(role: PitcherRole): number {
  return role === PITCHER_ROLE.relief ? RELIEF_REGISTRATION_SLOT : 0
}

/** 등록 꼴 — 붙박이 `[0..7]` 의 칸 t 선수를 맨 끝으로, 칸 t 에 내 투수 (0xb521c 0x80 갈래) */
export function registeredMyPitcherOrderOf(role: PitcherRole): readonly number[] {
  const order: number[] = Array.from({ length: PITCHERS_PER_TEAM }, (_unused, slot) => slot)
  const slot = myPitcherRegistrationSlotOf(role)
  order.push(order[slot] ?? slot)
  order[slot] = MY_RECORD_SLOT
  return order
}

/** 그날 경기 준비의 내 팀 몫 */
export interface MyPitcherDay {
  readonly dayCounter: number
  readonly role: PitcherRole
  readonly isPostseason: boolean
}

/** `0x1b684` — 보직 2 가 아니면 내 투수 칸 k(마지막으로 찾은 줄)와 0 을 맞바꾼다 */
export function moveMyPitcherToStart(order: readonly number[], role: PitcherRole): readonly number[] {
  if (role === PITCHER_ROLE.relief) return order
  const k = order.lastIndexOf(MY_RECORD_SLOT)
  return k < 0 ? order : swapWithStarter(order, k)
}

/** 142 진입 0x1c46c 의 내 팀 몫 (1c590~1c5de) — 레코드를 제자리에서 고친다 */
export function prepareMyPitcherOrder(order: readonly number[], day: MyPitcherDay): readonly number[] {
  const started = day.dayCounter === 0 ? moveMyPitcherToStart(order, day.role) : order
  const k = startAssignmentOf({
    mode: PITCHER_EDITION_MODE,
    dayCounter: day.dayCounter,
    role: day.role,
    isPostseason: day.isPostseason,
  })
  if (k === START_ASSIGNMENT.rotate) return advanceRotation(started)
  if (k === START_ASSIGNMENT.keep) return started
  return swapWithStarter(started, k)
}

/**
 * 레코드에 배열이 없던 옛 저장의 배열 — 등록 꼴에서 이 시즌(포스트시즌이면 이 시리즈)의 0..g−1 날을 밟는다. 예전 웹 셈
 * (날짜 g 로만 센 차례)과 같은 날짜 셈이다. `includeToday` 면 오늘(g) 준비까지.
 */
export function legacyMyPitcherOrderOf(day: MyPitcherDay, includeToday: boolean): readonly number[] {
  const last = includeToday ? day.dayCounter : day.dayCounter - 1
  let order = registeredMyPitcherOrderOf(day.role)
  for (let d = 0; d <= last; d += 1) order = prepareMyPitcherOrder(order, { ...day, dayCounter: d })
  return order
}

/** 레코드의 내 팀 배열 — 없으면 null */
export function recordedMyPitcherOrderOf(fields: NariTeamRecordFields): readonly number[] | null {
  return nariTeamRecordOf(nariTeamsOf(fields), fields.teamId).pitchers ?? null
}

/** 내 팀 배열을 레코드에 */
export function withMyPitcherOrder(fields: NariTeamRecordFields, order: readonly number[]): NariTeamRecords {
  const records = nariTeamsOf(fields)
  return withNariTeamRecord(records, fields.teamId, { ...nariTeamRecordOf(records, fields.teamId), pitchers: order })
}

/** 내 투수의 포지션 코드 `0xb6394` = 배열 안 내 칸 (0xb603c 가 다시 매긴 값). 없으면 0 */
export function myPitcherPositionCodeOf(order: readonly number[]): number {
  return Math.max(0, order.indexOf(MY_RECORD_SLOT))
}

/** 진행기 칸 번호로 — 내 투수 줄은 `MY_PITCHER_SLOT`(8) */
export function gameMyPitcherOrderOf(order: readonly number[]): readonly number[] {
  return order.map((slot) => (slot === MY_RECORD_SLOT ? GAME_MY_PITCHER_SLOT : slot))
}
