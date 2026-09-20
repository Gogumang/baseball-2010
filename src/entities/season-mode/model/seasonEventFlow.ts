import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { seasonDayOf } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import type { SeasonSceneState } from '@/entities/season-mode/model/seasonStateMachine'

/**
 * s_event(시즌 이벤트) 연결 지점 — `docs/re/P4-season-flow.md` 2a·2b·6 절 (확정).
 *
 * **아직 이 저장소에 s_event 해독본이 없다**: `base/extracted/` 에는 `s_event_txt.json`(대사)만
 * 있고 `src/shared/config/original/data/events.json` 은 r_event 313건뿐이다. 그래서 여기에는
 * **발동 조건과 연결 지점만** 두고, 이벤트 본문(대사·명령)은 담지 않는다 — 없는 값을 지어내지 않는다.
 */

/** 이벤트 폴링이 쓰는 화면 코드 */
export const SEASON_SCREEN_CODE = {
  관리메뉴: 201,
  외출지도: 209,
} as const

/**
 * 자동 발동(대상 4) 이벤트는 **5건뿐**이다 (P4 2a).
 * 날짜 창의 단위는 `연차idx × 45 + 경기수 + 1` (A-2).
 */
export interface AutoSeasonEvent {
  readonly id: number
  /** 되풀이되는 이벤트인가 (s_event 의 "반복" 칸) */
  readonly repeats: boolean
  /** 날짜 창 [시작, 끝]. null 이면 날짜 조건이 없다 */
  readonly window: readonly [number, number] | null
  readonly note: string
}

export const AUTO_SEASON_EVENTS: readonly AutoSeasonEvent[] = [
  { id: 400, repeats: false, window: null, note: '오프닝 — 새 선수 플래그가 섰을 때 0x8bde0 이 튼다' },
  { id: 1, repeats: false, window: [1, 1], note: '시즌모드 환영 (선택지 2/3/4)' },
  { id: 5, repeats: false, window: [3, 3], note: '경기설정 안내 (선택지 6/7/8)' },
  { id: 100, repeats: false, window: [21, 21], note: '20경기 축하 — G +1000 (저장 파일당 한 번)' },
  { id: 490, repeats: true, window: [1, 13 * 45], note: '질병 유행 — 조건 22' },
]

/** 20경기 축하 이벤트가 주는 G */
export const EVENT_100_GAME_POINT = 1000
/** 이벤트 100 이 한 번 주고 나면 서는 전역 플래그 (저장+0xbe) */
export const EVENT_100_ID = 100
/** 질병 이벤트 id */
export const ILLNESS_EVENT_ID = 490
/** 오프닝 이벤트 id */
export const OPENING_EVENT_ID = 400

/**
 * 자동 이벤트 폴링이 도는 상태 (0xe9ac 0xeb74~0xec0e): 관리 메뉴(0xc9) 또는 외출 지도(0xd1).
 *
 * ⚠️ 다만 판정 `0xacfbc` 에서 trigger 0 은 화면코드 105 또는 **201(관리 메뉴)** 만 받고
 * s_event 는 전부 trigger 0 이다 → **외출 지도(209)에서는 s_event 가 하나도 안 뜬다**(무해한 원본 이상).
 */
export function pollsSeasonEvents(state: SeasonSceneState): boolean {
  return state === SEASON_SCENE_STATE.관리메뉴 || state === SEASON_SCENE_STATE.외출지도
}

/** 실제로 이벤트가 떠 줄 수 있는 화면인가 (trigger 0 이 받는 화면코드) */
export function acceptsSeasonEvents(state: SeasonSceneState): boolean {
  return state === SEASON_SCENE_STATE.관리메뉴
}

export interface SeasonEventGlobals {
  /** 저장+0xbe — 이벤트 100 의 1000 G 를 이미 받았는가 (기기/저장 파일당 한 번) */
  readonly event100Awarded: boolean
  /** 새 선수 플래그 (this+0xf9) — 서 있으면 오프닝 400 이 먼저 뜬다 */
  readonly newPlayerFlag: boolean
}

/**
 * 날짜 창 안인가 — 대상 4 이벤트의 `+9~+0xc` 날짜 칸.
 * 원본의 "지금" 은 `연차idx × 45 + 경기수 + 1` 이다.
 */
export function isInEventWindow(event: AutoSeasonEvent, record: SeasonRecord): boolean {
  if (event.window === null) return true
  const now = seasonDayOf(record)
  return now >= event.window[0] && now <= event.window[1]
}

/**
 * 이벤트 100 특례 (`0xacfbc` 0xad056~0xad07a 확정):
 * 이미 받았으면 **본 것으로 표시하고 불발**시킨다. 저장(0x1f1d8)은 모드를 가리지 않는
 * 전역 기록이라 시즌을 새로 시작해도 다시 주지 않는다.
 */
export function isEvent100Blocked(globals: SeasonEventGlobals): boolean {
  return globals.event100Awarded
}

/**
 * 지금 자동으로 뜰 s_event 의 id. 없으면 null.
 *
 * 순서는 원본 폴링과 같다: 새 선수 플래그가 서 있으면 오프닝 400 이 먼저,
 * 아니면 파일 순서(= `AUTO_SEASON_EVENTS` 순서)로 첫 번째로 맞는 것.
 * 질병 490 의 확률 굴림은 `rollIllness` 가 따로 한다 — 여기서는 조건만 본다.
 */
export function nextAutoSeasonEventId(
  record: SeasonRecord,
  state: SeasonSceneState,
  globals: SeasonEventGlobals,
  illnessTriggered: boolean,
): number | null {
  if (!acceptsSeasonEvents(state)) return null
  if (globals.newPlayerFlag) return OPENING_EVENT_ID

  for (const event of AUTO_SEASON_EVENTS) {
    if (event.id === OPENING_EVENT_ID) continue
    if (!isInEventWindow(event, record)) continue
    if (event.id === EVENT_100_ID && isEvent100Blocked(globals)) continue
    if (event.id === ILLNESS_EVENT_ID && !illnessTriggered) continue
    return event.id
  }
  return null
}

/**
 * 질병 확률 (조건 22, `0xadb32` 의 모드 2 갈래).
 * 시즌모드는 사기를 **팀 사기**로 읽고, 나리 쪽에만 있는 유리몸·행운 보정이 없다.
 */
export function illnessChancePercentOf(teamMorale: number): number {
  if (teamMorale > 70) return 0
  if (teamMorale > 50) return 2
  if (teamMorale > 30) return 4
  if (teamMorale > 10) return 7
  return 14
}

/** 치료 뒤 질병이 다시 안 뜨는 경기 수 (SR+0x7c) */
export const ILLNESS_COOLDOWN = 20
/** 질병에 걸릴 때 들어가는 입원 실패 여유 칸 (`0xd4d98[종류]` = 3) */
export const ILLNESS_SLACK_ON_CATCH = 3
/** 질병 종류 수 (1~4, StrMODE[185+종류]) */
export const ILLNESS_KIND_COUNT = 4

/**
 * 질병 발동 판정 — 이벤트 490 이 실제로 터지는가.
 * ```
 * SR+5 ≠ 0 → 불발 (이미 앓고 있다)
 * SR+0x7c > 0 → 불발 (쿨다운)
 * rand(0,100) < p → 발동
 * ```
 * 관리 메뉴는 짝수 경기 뒤에만 열리므로 굴림도 2경기에 한 번이다.
 */
export function rollIllness(record: SeasonRecord, teamMorale: number, random: RandomPort): boolean {
  if (record.illness !== 0) return false
  if (record.illnessCooldown > 0) return false
  return randomIntegerBelow(random, 0, 100) < illnessChancePercentOf(teamMorale)
}

/**
 * 질병 적용 (`0x8c730`).
 *
 * 종류는 보상 11 의 값 0 을 글 만들기(`0x8c14e`)가 `rand(0,4)+1` 로 **다시 써서** 정해진다 —
 * 그래서 값 0 이어도 치료가 아니라 **실제로 병에 걸린다** (A 문서의 "원본 버그" 해석은 P4 가 뒤집었다).
 */
export function catchIllness(record: SeasonRecord, random: RandomPort): SeasonRecord {
  const kind = randomIntegerBelow(random, 0, ILLNESS_KIND_COUNT) + 1
  return { ...record, illness: kind, illnessSlack: ILLNESS_SLACK_ON_CATCH, illnessCooldown: ILLNESS_COOLDOWN }
}

/** 입원 치료 확률의 경계 — `r = rand(0,101)` 이 89 이하면 낫는다 (90/101) */
export const HOSPITAL_CURE_THRESHOLD = 89

export interface IllnessCureResult {
  readonly record: SeasonRecord
  readonly cured: boolean
}

/**
 * 외출 "입원" 의 치료 굴림 (`0xcc6a`).
 * `r ≤ 89` 이거나 남은 여유 칸이 0 이면 낫고, 아니면 여유 칸이 하나 준다(0 바닥).
 * 낫지 못해도 여유 칸이 0 이 되면 다음엔 반드시 낫는다.
 */
export function cureIllnessAtHospital(record: SeasonRecord, random: RandomPort): IllnessCureResult {
  const roll = randomIntegerBelow(random, 0, 101)
  if (roll <= HOSPITAL_CURE_THRESHOLD || record.illnessSlack === 0) {
    return {
      record: { ...record, illness: 0, illnessSlack: 0, illnessCooldown: ILLNESS_COOLDOWN },
      cured: true,
    }
  }
  return { record: { ...record, illnessSlack: Math.max(record.illnessSlack - 1, 0) }, cured: false }
}

/** GP 아이템 칸 2 는 무조건 낫는다 (StrMODE[123]) */
export function cureIllnessByItem(record: SeasonRecord): SeasonRecord {
  return { ...record, illness: 0, illnessSlack: 0, illnessCooldown: ILLNESS_COOLDOWN }
}

/** 팀 능력치 정액 감소 — 사기 구간별 (J-4). 질병은 여기가 아니라 별도로 −30% 다 */
export function moralePenaltyOf(teamMorale: number): number {
  if (teamMorale > 50) return 0
  if (teamMorale > 30) return 50
  if (teamMorale > 10) return 100
  return 200
}

/** 질병 중에는 내 팀 선수 전원의 경기용 능력치가 30% 깎인다 (`0xb570c` 시즌 갈래) */
export const ILLNESS_ABILITY_PENALTY_PERCENT = 30

/**
 * 경기를 한 판 치렀을 때 시즌 레코드가 넘어가는 칸들.
 * ```
 * SR+0xb2 (경기 수) += 1
 * SR+4  = 0            ; 트레이닝·외출 한 번 제한 풀기 (0x4f158)
 * SR+0x7c −= 1         ; 질병 쿨다운 (0x4f3a2, 모드 2·3·4 공통)
 * SR+0x54 −= 1         ; 상대 투구 목표점 보기 (0x4f38c)
 * ```
 * 구내매점 SR+0x55 는 여기가 아니라 **경기 뒤 평가 화면**에서 준다 (`seasonAttendance.ts`).
 */
export function advanceAfterGame(record: SeasonRecord): SeasonRecord {
  return {
    ...record,
    games: record.games + 1,
    acted: false,
    illnessCooldown: Math.max(record.illnessCooldown - 1, 0),
    aimVisionGames: Math.max(record.aimVisionGames - 1, 0),
  }
}
