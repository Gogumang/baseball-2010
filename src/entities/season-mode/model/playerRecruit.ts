import type { SeasonEntryBatterRecord, SeasonEntryPitcherRecord } from '@/entities/season-mode/model/seasonEntry'

/**
 * 시즌 선수영입 (상태 0xe2 → 0xdf → 0xc554) — `docs/re/S6-season-cleanup.md` 4 절 **확정**,
 * 고르는 규칙은 `docs/re/R13-season-leftovers.md` 9 절, 가드는 `docs/re/P4-season-flow.md` 5 절.
 *
 * ⚠️ **영입은 교체가 아니라 끼워넣기다** (S6 4-3 확정, CORRECTIONS "R13 9절" 정정):
 * 로스터가 매번 한 칸 늘고, 고른 자리에 있던 선수는 **맨 끝(벤치 마지막)으로 밀릴 뿐 빠지지 않는다.**
 * 정원 상한도 없다. 진짜 교체 함수 `0xb5648` 이 따로 있지만 영입은 그것을 쓰지 않는다.
 */

/**
 * 선수 레코드 `+0xa` 의 구조 (S6 3-2, 원본 Xls 4표로 직접 확인):
 * ```
 * bit7 0x80 : 육성(내) 선수 · 명예의전당 선수
 * bit6 0x40 : 마선수(ACE)
 * bit5 0x20 : 종류 보조 비트
 * bit4..0   : 팀 안 칸 번호 (타자 0~11 · 투수 0~7) 또는 마선수 순번 0~4
 * ```
 * bit6:bit5 두 비트가 **선수 종류 코드**다.
 */
export const PLAYER_KIND_MASK = 0x60
export const PLAYER_SLOT_MASK = 0x1f
export const PLAYER_OWN_BIT = 0x80

export const PLAYER_KIND = {
  일반투수: 0x00,
  일반타자: 0x20,
  마타자: 0x40,
  마투수: 0x60,
} as const
export type PlayerKind = (typeof PLAYER_KIND)[keyof typeof PLAYER_KIND]

/** 종류 = `(b >> 5) & 3` 로 외우는 편이 정확하다 */
export function playerKindOf(kindByte: number): PlayerKind {
  return (kindByte & PLAYER_KIND_MASK) as PlayerKind
}

/** id 구간 — `0xb4..0xc7` 명예의전당 **투수** 20명 · `0xc8..` 명예의전당 타자 · `0xfe` 내 선수 */
export const HALL_OF_FAME_FIRST_ID = 0xb4
export const HALL_OF_FAME_LAST_PITCHER_ID = 0xc7
export const OWN_PLAYER_ID = 0xfe

/**
 * 투수인가 — `0xb6278` (S6 3-3 확정).
 * ```
 * if ((b & 0x60) == 0x60) return 1                  ; 마투수
 * if (id != 0xfe && id > 0xb3)  return (id <= 0xc7) ; 명예의전당 투수 20명만 투수
 * if (b & 0x20) return 0                            ; 일반 타자
 * if (b & 0x40) return 0                            ; 마타자
 * return 1
 * ```
 * ⚠️ J-3 의 "마타자는 이 식 때문에 보직 벌점을 면제받는다" 는 **틀렸다** (S6 정정 4번):
 * `(b&0x60)==0x60` 은 마투수만 걸리고 마타자는 id 가지로 가서 정상적으로 타자가 된다.
 */
export function isPitcherRecord(id: number, kindByte: number): boolean {
  if ((kindByte & PLAYER_KIND_MASK) === PLAYER_KIND.마투수) return true
  if (id !== OWN_PLAYER_ID && id > HALL_OF_FAME_FIRST_ID - 1) return id <= HALL_OF_FAME_LAST_PITCHER_ID
  if (kindByte & 0x20) return false
  if (kindByte & 0x40) return false
  return true
}

/** 시즌 로스터에 들어가는 선수 한 명 (원본 0x30 바이트 레코드 중 이 규칙이 쓰는 칸만) */
export interface SeasonPlayer {
  /**
   * 영입 때 옮긴 **기록 사본**(이름 rec + 1 · 0xb6414 능력치 · 투수 레퍼토리·보직) — 붙박이 표 밖 선수만.
   * 영입 0xc554 는 원본 기록 0x30 바이트를 통째로 팀 레코드에 복사하므로(S6 4-2) 그 뒤 원본(나리 저장)이 바뀌어도
   * 시즌 선수는 영입 순간의 기록으로 선다. 나리 선수(id 0xfe)가 이 칸을 든다. 명전 선수는 지금의 명전 칸을 읽는다
   * (`seasonHallOfFameRecordSourceOf` — 칸이 바뀌는 길은 삭제뿐이라 결과가 같다).
   */
  readonly record?: SeasonEntryBatterRecord | SeasonEntryPitcherRecord
  /** +0 */
  readonly id: number
  /** +0xa — 상위 3비트(종류·육성)와 하위 5비트(칸 번호)가 한 바이트에 같이 있다 */
  readonly kindByte: number
  /** +0x1c 하위 니블 — 타자의 수비 위치 */
  readonly fieldPosition: number
  /** +0x2c — 투수 스태미나 */
  readonly stamina: number
  /**
   * **이 선수의 붙박이 표 팀** — 원본 id(+0)는 Xls 행 번호 그대로라(투수 `팀 × 8 + 칸` · 타자 `팀 × 12 + 칸`,
   * `base/extracted/XlsPITCHER_DATA.json` 줄마다 바이트 0 이 줄 번호다) 팀이 id 안에 들어 있다. 웹 `id` 는 그 팀 안
   * 칸만 들어서, 트레이드(0xd1cc~0xd3ae)로 **다른 팀 레코드에 옮겨진** 선수는 그 팀을 여기 따로 든다.
   * 없으면 명단 주인 팀이다 — 옛 저장·표에서 만든 명단은 모두 그렇다. 주인 팀과 같아지면 지운다(`withTableTeam`).
   */
  readonly tableTeamId?: number
}

/** 이 선수의 이름·능력치·+0x1b·기록 번호를 읽을 붙박이 표 팀 — `tableTeamId`, 없으면 명단 주인 팀 */
export function tableTeamOf(player: SeasonPlayer, ownerTeamId: number): number {
  return player.tableTeamId ?? ownerTeamId
}

/**
 * 선수를 `ownerTeamId` 의 명단으로 옮길 때 붙박이 표 팀을 적는다 — 원본은 레코드를 통째로 옮겨 id 가 따라가므로
 * 표 팀이 바뀌지 않는다. 표 팀이 새 주인과 같으면 칸을 지워 "주인 팀 선수" 와 같은 모양으로 둔다.
 */
export function withTableTeam(player: SeasonPlayer, fromOwnerTeamId: number, toOwnerTeamId: number): SeasonPlayer {
  const team = tableTeamOf(player, fromOwnerTeamId)
  const { tableTeamId: _dropped, ...rest } = player
  return team === toOwnerTeamId ? rest : { ...rest, tableTeamId: team }
}

export interface SeasonTeamRoster {
  readonly pitchers: readonly SeasonPlayer[]
  readonly batters: readonly SeasonPlayer[]
}

/** `0xb6394(P)` = `P[0xa] & 0x1f` — 팀 안 칸 번호 */
export function slotOf(player: SeasonPlayer): number {
  return player.kindByte & PLAYER_SLOT_MASK
}

/**
 * `0xb6604(P, i)` = `P[0xa] = (P[0xa] & 0xe0) | (i & 0x1f)` — **하위 5비트 세터**다.
 *
 * ⚠️ R13 9절이 "시즌 선수 만들기" 로 적은 것은 틀렸다 (S6 정정 6번).
 * 게다가 원본은 이 세터를 **저장된 명예의전당·나리 기록에 그대로 건다** — 즉
 * 원본 레코드의 칸 번호가 실제로 바뀌고 다음 영입 때까지 남는다(부작용, 원본 그대로).
 */
export function withSlot(player: SeasonPlayer, slot: number): SeasonPlayer {
  return { ...player, kindByte: (player.kindByte & 0xe0) | (slot & PLAYER_SLOT_MASK) }
}

/**
 * **나리 선수 기록** — 영입 후보 칸 0(투수) · 5(타자)의 원본 `0x22168(저장)` · `0x220ec(저장)` (직접 떴다):
 * ```
 * 0x213c0(저장, 3|4, 1)                         ; 나만의리그 투수편(3)·타자편(4) 저장을 올린다
 * L = [저장 + 0xb8|0xbc] ; 팀 = (s8)L[0x11d]       ; 그 저장의 내 팀
 * T = L + 4 + 팀·0x1c
 * for i in 0..수: P = 0xb51fc|0xb53d0(T, i) ; (s8)P[0xa] < 0 → return P   ; 첫 육성 선수(bit7)
 * return 0
 * ```
 * 그 기록은 나리 선수 생성 0x17360 이 `+0xa = 0x80`(투수) / `0xa0`(타자, 0x1762e~0x17634 · 타자편은 0x1764a 가 0xa7)으로,
 * 나리 경기 쪽 사본도 `+0 = 0xfe`(0x10ff8 · 0x110e2)로 단 내 선수다 — id `0xfe` 는 `0xb6278` 이 명전 구간에서 빼는 값이다.
 * 하위 5비트(나리 팀 칸)는 영입 `0xb6604` 가 덮어쓰므로 상위 비트만 의미가 있다.
 * 영입 0xc554 는 이 기록을 명전 칸과 똑같이 통째로 옮긴다(복사 전 고치는 칸은 +0xa 하위 5비트 · 투수 +0x2c 뿐).
 */
export const NARI_PITCHER_KIND_BYTE = PLAYER_OWN_BIT
export const NARI_BATTER_KIND_BYTE = PLAYER_OWN_BIT | PLAYER_KIND.일반타자

/** 나리 선수 기록 → 시즌 명단 선수 (id 0xfe · +0xa 0x80/0xa0 · 기록 사본) */
export function nariRecruitPlayerOf(record: SeasonEntryBatterRecord | SeasonEntryPitcherRecord, isPitcher: boolean): SeasonPlayer {
  return {
    id: OWN_PLAYER_ID,
    kindByte: isPitcher ? NARI_PITCHER_KIND_BYTE : NARI_BATTER_KIND_BYTE,
    fieldPosition: 0,
    stamina: 0,
    record,
  }
}

/** 영입된 투수의 스태미나는 10000 으로 채워진다 (`선수+0x2c = 0x2710`) */
export const RECRUIT_PITCHER_STAMINA = 10_000

/**
 * 투수 끼워넣기 — `0xb521c` 의 기본 가지 (S6 4-3).
 * ```
 * 0xb4e34(T, 1)                                    ; 배열을 한 칸 늘린다
 * memcpy(맨 끝 칸, 0xb51fc(T, k), 0x30)            ; 옛 k번 선수를 맨 끝으로
 * memcpy(0xb51fc(T, k), 새선수, 0x30)              ; k 칸에 새 선수
 * ```
 * ⚠️ **투수 쪽만 뒷정리가 빠졌다** (S6 4-4, 원본 그대로 둔다): 타자 가지는 밀려난 선수의
 * 칸 번호를 `0xb6605` 로 고쳐 주는데 투수 가지에는 그 줄이 없다 → 밀려난 투수와 새 투수가
 * **같은 `+0xa` 하위 5비트**를 갖는다. 배열 접근은 첨자로만 하므로 경기에는 영향이 없고
 * 표시용 칸 번호만 어긋난다.
 */
export function insertPitcher(
  pitchers: readonly SeasonPlayer[],
  player: SeasonPlayer,
  slot: number,
): SeasonPlayer[] {
  const next = [...pitchers]
  const pushed = next[slot]
  if (pushed === undefined) return next
  next.push(pushed) // 옛 선수는 맨 끝으로 — 칸 번호는 고치지 않는다(원본 그대로)
  next[slot] = player
  return next
}

/**
 * 타자 끼워넣기 — `0xb53f0` 의 기본/`0x20` 가지 (S6 4-3).
 * ```
 * 0xb4e34(T, 0)                                    ; 배열 한 칸 늘림
 * pos = old[0x1c] & 0xf                            ; 밀려날 선수의 수비 위치
 * 0xb8e85(old, 0, 0)                               ; 그 선수 수비 위치 = 0
 * 0xb6605(old, T+0x10 − 1)                         ; 그 선수 칸 번호 = 마지막
 * memcpy(맨 끝 칸, old, 0x30) ; memcpy(k 칸, 새선수, 0x30)
 * 0xb8e85(새선수, pos, 0)                          ; 새 선수 수비 위치 = 밀려난 선수의 자리
 * ```
 */
export function insertBatter(
  batters: readonly SeasonPlayer[],
  player: SeasonPlayer,
  slot: number,
): SeasonPlayer[] {
  const next = [...batters]
  const pushed = next[slot]
  if (pushed === undefined) return next
  const position = pushed.fieldPosition & 0xf
  const lastIndex = next.length // 한 칸 늘린 뒤의 마지막 첨자
  next.push(withSlot({ ...pushed, fieldPosition: 0 }, lastIndex))
  next[slot] = { ...player, fieldPosition: position }
  return next
}

/** 영입 목록의 코드 (`[this+0xa8]+0x12c`, 점프표 `0xcbe8c`) */
export const RECRUIT_LIST_CODE = {
  취소: 0,
  나리투수: 1,
  나리타자: 2,
  명예투수: 3,
  명예타자: 4,
} as const
export type RecruitListCode = (typeof RECRUIT_LIST_CODE)[keyof typeof RECRUIT_LIST_CODE]

export type RecruitSourceKind = '나리투수' | '나리타자' | '명예투수' | '명예타자'

/**
 * 영입 화면의 커서 칸 k → 원본 기록 (R13 9절 확정, `0xc4ea`).
 * 칸 배치는 **`0 = 나리 투수, 1~4 = 명예 투수, 5 = 나리 타자, 6~ = 명예 타자`** 다.
 * 쪽(투수/타자)은 `k > 4` 로 가른다.
 */
export function recruitSourceOf(cursor: number): RecruitSourceKind {
  if (cursor === 0) return '나리투수'
  if (cursor <= 4) return '명예투수'
  if (cursor === 5) return '나리타자'
  return '명예타자'
}

/** 영입한 선수가 투수 쪽인가 — 원본은 `[sp] = (k > 4) ? 1(타자) : 0(투수)` 로 가른다 */
export function recruitsPitcher(cursor: number): boolean {
  return cursor <= 4
}

/**
 * 중복 검사 `0xb5054(팀, 쪽)` — 나리 선수는 팀에 **한 명씩만**.
 * 판정은 `+0xa < 0`(부호 있는 읽기 = bit7 = 육성/명전 표시)이다.
 * 걸리면 StrMODE[181] "이미 영입된 선수 입니다".
 */
export function hasRecruitedCareerPlayer(players: readonly SeasonPlayer[]): boolean {
  return players.some((player) => (player.kindByte & PLAYER_OWN_BIT) !== 0)
}

/** 중복 검사 `0xb50ac(팀, 쪽, i)` — 같은 명예의전당 선수 번호가 이미 있는가 */
export function hasRecruitedHallOfFamePlayer(players: readonly SeasonPlayer[], id: number): boolean {
  return players.some((player) => player.id === id)
}

export type RecruitRefusal = '이미영입'

export interface RecruitResult {
  readonly roster: SeasonTeamRoster
  /**
   * 고쳐진 **원본 기록**. 원본은 `0xb6604` 로 저장된 나리·명예 레코드의 칸 번호를
   * 실제로 바꿔 놓는다 — 부작용을 숨기지 않으려고 돌려준다.
   */
  readonly source: SeasonPlayer
}

/**
 * 영입 확정 — `0xc554~0xc5cc`.
 * ```
 * 선수 = 0xb6604(원본, 자리)                       ; 원본 레코드의 칸 번호를 자리로
 * 투수: 선수+0x2c = 0x2710 ; 0xb6cc4(선수) ; 0xb521c(팀, 선수, 0)
 * 타자: 0xb8e28(선수)                    ; 0xb53f0(팀, 선수, 0)
 * ```
 * **비용도 인기도 조건도 없다.** 통과하면 StrMODE[180] "선수 영입을 완료하였습니다".
 *
 * (`0xb6cc4`·`0xb8e28` 이 원본 레코드의 무엇을 더 만지는지는 해독되지 않았다 — 여기서는
 * 스태미나만 채운다. 값을 지어내지 않으려고 나머지는 건드리지 않았다.)
 */
export function recruitPlayer(
  roster: SeasonTeamRoster,
  source: SeasonPlayer,
  asPitcher: boolean,
  slot: number,
): RecruitResult {
  const renumbered = withSlot(source, slot)
  if (asPitcher) {
    const player = { ...renumbered, stamina: RECRUIT_PITCHER_STAMINA }
    return {
      roster: { ...roster, pitchers: insertPitcher(roster.pitchers, player, slot) },
      source: player,
    }
  }
  return {
    roster: { ...roster, batters: insertBatter(roster.batters, renumbered, slot) },
    source: renumbered,
  }
}

/**
 * 명전 선수인가 — `0xb6348(P)` (직접 떴다):
 * ```
 * if (P[0xa] & 0x40) return 0                          ; 0xb633c — 마선수 비트
 * 투수(0xb6278): (u8)(id + 0x4c) <= 0x18 → 1            ; id 0xb4..0xcc
 * 타자          : (u8)(id + 0x38) <= 8    → 1            ; id 0xc8..0xd0
 * ```
 */
export function isHallOfFameRecord(player: SeasonPlayer): boolean {
  if ((player.kindByte & 0x40) !== 0) return false
  if (isPitcherRecord(player.id, player.kindByte)) return ((player.id + 0x4c) & 0xff) <= 0x18
  return ((player.id + 0x38) & 0xff) <= 8
}

/**
 * 명전 칸을 지울 때 시즌 명단에서 그 선수를 빼기 — `0x221dc(저장, 선수 번호, 투수?)` (직접 떴다, R11 3-2).
 * ```
 * 0x213c0(저장, 2, 1) ; [저장+0xb4] == 0 || 전역기록+0x42 == 0 → 끝      ; 시즌 저장이 없으면 아무것도 안 한다
 * for 팀 0..9: T = 0x1f570(저장, 팀)
 *   투수: j = 첫 0xb6348(P) && P[0] == 번호 →
 *         memcpy(T[j], T[끝]) ; memset(T[끝], 0) ; 수 −= 1 ; 저장 0x211fc ; 끝
 *   타자: pos = T[j][0x1c] & 0xf ; memcpy(T[j], T[끝]) ; memset(T[끝], 0) ; 0xb8e85(T[j], pos, 0) ; 0xb6605(T[j], j)
 *         수 −= 1 ; 저장 ; 끝
 * ```
 * → **맨 끝 선수가 지운 자리로 옮겨 온다**(타자는 지운 선수의 수비 위치·칸 번호를 이어받고, 투수는 옛 칸 번호를 그대로
 * 든다 — 영입 0xb521c 처럼 투수 쪽 칸 번호 정리가 없다). 첫 하나만 지우고 끝난다.
 * 웹 시즌 저장의 명단은 내 팀 하나뿐이다 — 명전 선수는 영입(내 팀)으로만 들어가고 트레이드가 막혀(StrMODE[166])
 * 다른 팀에 있을 수 없으니 열 팀을 도는 것과 결과가 같다. 없으면 같은 객체.
 */
export function removeHallOfFamerFromRoster(roster: SeasonTeamRoster, id: number, isPitcher: boolean): SeasonTeamRoster {
  const players = isPitcher ? roster.pitchers : roster.batters
  const found = players.findIndex((player) => isHallOfFameRecord(player) && player.id === id)
  if (found < 0) return roster
  const next = players.slice(0, -1)
  const last = players[players.length - 1]
  if (found < next.length) {
    next[found] = isPitcher
      ? last
      : withSlot({ ...last, fieldPosition: players[found].fieldPosition & 0xf }, found)
  }
  return isPitcher ? { ...roster, pitchers: next } : { ...roster, batters: next }
}

/**
 * 나만의리그 초기화가 시즌 명단에서 그 편 나리 선수를 빼기 — `0x223a8(mgr, 투수?)` (모드 저장 지우기 0x224ec 칸 3 → 1 · 칸 4 → 0,
 * 직접 떴다):
 * ```
 * 0x213c0(앱, 2, 1) ; [mgr+0xb4] == 0 || 전역기록+0x42 == 0 → 끝      ; 시즌 저장이 없으면 아무것도 안 한다
 * T = 0x1f571(저장, SR[1])                                             ; **내 팀 하나**만 본다 (열 팀을 돌지 않는다)
 * 투수: j = 첫 0xb6388(P) (= +0xa bit7, 나리 선수) → memcpy(T[j], T[끝]) · memset(T[끝]) · 수 −1 · 0x211fc(mgr, 2) 저장
 * 타자: j = 첫 0xb6388(P) → pos = T[j][0x1c] & 0xf · memcpy · memset · 0xb8e85(T[j], pos, 0) · 0xb6605(T[j], j) · 수 −1 · 저장
 * 못 찾으면 0x1f24c(mgr, 2)
 * ```
 * 명전 삭제 `0x221dc` 와 같은 꼴이다(투수는 칸 번호 정리가 없다). 첫 하나만 뺀다. 없으면 같은 객체.
 */
export function removeCareerPlayerFromRoster(roster: SeasonTeamRoster, isPitcher: boolean): SeasonTeamRoster {
  const players = isPitcher ? roster.pitchers : roster.batters
  const found = players.findIndex((player) => (player.kindByte & PLAYER_OWN_BIT) !== 0)
  if (found < 0) return roster
  const next = players.slice(0, -1)
  const last = players[players.length - 1]
  if (found < next.length) {
    next[found] = isPitcher
      ? last
      : withSlot({ ...last, fieldPosition: players[found].fieldPosition & 0xf }, found)
  }
  return isPitcher ? { ...roster, pitchers: next } : { ...roster, batters: next }
}

/**
 * 모드 초기화 나리 칸의 막기 조건 앞쪽 — `0xb5054(내 시즌 팀, 쪽)`: 타자편이면 타자 쪽, 투수편이면 투수 쪽에 나리 선수(+0xa bit7)가
 * 있는가. 시즌 저장이 없으면(`roster` null) 거짓.
 */
export function hasCareerPlayerInSeasonTeam(roster: SeasonTeamRoster | null, isPitcher: boolean): boolean {
  if (roster === null) return false
  return hasRecruitedCareerPlayer(isPitcher ? roster.pitchers : roster.batters)
}

/**
 * 명전 칸 삭제·선물 막기 (스페셜 하위 27 의 0x2ac00 하위 1, R11 3-1):
 * `0xb50ad(내 팀, 타자?1:0, 칸)` — 그 명전 기록 번호가 내 팀 명단에 있고 — && 전역기록 `+0x4e`(시즌모드 경기 진행 중) ≠ 0.
 * 시즌 저장이 없으면(`roster` null) 명단에 있을 수 없다.
 */
export function isHallOfFameDeleteBlocked(
  roster: SeasonTeamRoster | null,
  id: number,
  isPitcher: boolean,
  isSeasonGameInProgress: boolean,
): boolean {
  if (roster === null || !isSeasonGameInProgress) return false
  return hasRecruitedHallOfFamePlayer(isPitcher ? roster.pitchers : roster.batters, id)
}
