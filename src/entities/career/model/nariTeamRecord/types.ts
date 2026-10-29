/**
 * **나만의리그 팀 레코드** — 나리 저장 블록 `[저장+0xb8]`(투수편 모드 3) · `[저장+0xbc]`(타자편 모드 4) 의
 * `+4 + 0x1c·팀` 열 칸 (`0x1f989(저장, 팀)` → 모드 3 `0x1f940` · 모드 4 `0x1f8f8`). 직접 떴다:
 * ```
 * 0xb8680(팀객체)   모드 3·4 → 0xb86c6 → 0x1f989(저장, 팀객체+0x25)        ; 경기용 팀 객체가 선수를 꺼내는 곳
 * 0xb891c(팀객체…)  team[i] = i (투수) · team[0xe + i] = i (타자) · +0x33 = 투수 수 − 1 · +0x28c = 타자 수 − 9
 *                   → **타순 = 레코드 타자 배열 차례**, 앞 아홉이 타순 · 그 뒤가 벤치 (CPU 대타 rand(0, 벤치 수))
 * 0xb8768(팀객체)   0xb603c — 마선수가 아닌 선수의 칸 번호(+0xa 아랫 5비트)를 배열 첨자로 다시 매긴다
 *                   (142 진입 0x1c54a · 경기 장면 0x3a2fa/0x3a302 가 두 팀 모두 — 143 안에서 말고는 늘 칸 번호 = 첨자)
 * ```
 * 레코드는 저장에 남아 경기 사이·시즌 사이로 이어진다(새 시즌 `0x204e0(저장, 편, 0)` 은 성적 칸만 지운다).
 *
 * ## 웹 꼴
 * 타자 배열은 줄마다 **붙박이 표 칸**(그 팀 `XlsBATTER_DATA` 행 0~11) · **내 선수**(`MY_RECORD_SLOT`) · **마타자**
 * (`ACE_BATTER_ROSTER_SLOT` + `ace` 번호)와 수비 위치 니블(`+0x1c & 0xf`, 0 = 벤치)만 든다. 이름·능력치는 그 행에서 빌린다.
 * 투수 배열의 0~7 차례는 예전대로 리그 칸(`League.pitcherOrders` · 포스트시즌 `baseOrders` — 로테이션 `0xb5ca8` 이 섞는
 * 그 차례)이 들고, 여기에는 8번 칸 마투수(`0xb521c` 의 0x60 갈래)만 둔다.
 *
 * 투수편 **내 팀** 은 투수 배열 전체(`pitchers` — 내 투수 줄 포함)를 레코드가 든다. 등록 0x10fb4 가 보직대로 칸을 정해
 * (`0xb6605` — 선발 0 · 구원 7) `0xb521d(내 팀, 내 투수, 1)` 로 넣고, 142 진입 0x1c46c 가 날마다 그 배열을 제자리에서
 * 돌리거나 맞바꾼다 (`entities/pitcher-career/model/myPitcherRecord`).
 */

/** 내 선수 줄의 붙박이 표 칸 표지 — 원본 레코드 +0 = 0xfe (등록 0x10ff8 · 0x110e2) */
export const MY_RECORD_SLOT = -1

/** 마선수가 없다 — 표 0xd7638[0] = −1 */
export const NO_RECORD_ACE = -1

/** 마타자를 넣는 칸 — `0xb53f0` 의 0x40 갈래 9번 (첫 벤치) */
export const ACE_BATTER_INDEX = 9

/**
 * 새 선수의 타자 칸 — 생성 0x17360 의 모드 4 갈래가 내 선수 레코드 +0xa 에 **0xa7** 을 쓴다(0x17646~0x1764c, 0xa0 을 덮어씀)
 * → 등록 0x10fb4 의 `0xb53f1(내 팀, 내 선수, 1)` 이 그 아랫 5비트 **7** 칸(8번 타자)에 넣는다. 타순 판정 0xa4c2c 도
 * `0xb6395(내 선수) + 1` = 8 을 사다리 0xd7e80 에서 찾는다(4번 경로 칸 1).
 */
export const ROOKIE_BATTER_SLOT = 7

/** 레코드 타자 한 줄 */
export interface NariRecordBatter {
  /** 붙박이 표 칸(그 팀 타자 0~11) · 내 선수 `MY_RECORD_SLOT` · 마타자 `ACE_BATTER_ROSTER_SLOT` */
  readonly slot: number
  /** 수비 위치 니블 `+0x1c & 0xf` — 0 은 벤치 */
  readonly position: number
  /** 마타자 번호 0~4 (`slot` 이 `ACE_BATTER_ROSTER_SLOT` 일 때만) */
  readonly ace?: number
  /**
   * 레코드 +0x19 · +0x1a 장비 니블 네 칸 — 나리 새 시즌 CPU 장비 굴림 `0x665e8`(1b86c)이 쓴 값(`nariCpuEquipment`).
   * 없으면 Xls 행 그대로(리그 열 팀은 0 — 굴리지 않은 첫 시즌 값). 줄째 옮겨 다닌다(0xb53f0 · 0xb5d09 는 레코드 포인터를 옮긴다)
   */
  readonly equipment?: readonly number[]
}

/** 팀 하나의 레코드 */
export interface NariTeamRecord {
  /** 타자 배열 `[팀+0x18]` 차례 그대로 — 앞 아홉이 타순, 그 뒤가 벤치 */
  readonly batters: readonly NariRecordBatter[]
  /** 투수 배열 8번 칸의 마투수 번호 0~4 — 없으면 `NO_RECORD_ACE` */
  readonly acePitcher: number
  /**
   * 투수편 내 팀만 — 투수 배열 차례(마투수 8번 칸은 빼고): 붙박이 표 칸 0~7 · 내 투수 `MY_RECORD_SLOT`. 앞이 선발, 뒤가 벤치 차례.
   * 마투수는 `acePitcher` 가 들고 8번 칸에 끼운다(옛 8번은 맨 끝 — 0xb521c 0x60 갈래). 없으면(옛 저장) 보직·날짜로 세운다.
   */
  readonly pitchers?: readonly number[]
  /**
   * 투수 레코드 장비 니블 네 칸 — **붙박이 표 칸(0~7) → 니블**. 나리 새 시즌 CPU 장비 굴림 `0x665e8` 이 레코드 칸에 쓴 것을
   * 리그 투수 차례(`League.pitcherOrders`)로 표 칸에 옮겨 둔다(`nariCpuEquipment`). 없는 칸은 Xls 행 그대로
   */
  readonly pitcherEquipment?: Readonly<Record<number, readonly number[]>>
}

/** 열 팀 레코드 (첨자 = 팀 번호 0~9) */
export type NariTeamRecords = readonly NariTeamRecord[]

/** 레코드를 든 커리어 칸 — 없으면(옛 저장·아직 안 고친 새 선수) 붙박이 표와 타순에서 세운다 */
export interface NariTeamRecordFields {
  readonly teamId: number
  readonly nariTeams?: NariTeamRecords
}

/** 142 진입이 두 팀에 넣은 마선수 번호 넷 */
export interface NariRecordAces {
  readonly myBatter: number
  readonly myPitcher: number
  readonly opponentPitcher: number
  readonly opponentBatter: number
}

/** 레코드 타자 한 줄을 경기 장면이 읽는 꼴로 — 이름(0xb62c0) · 자리 니블 · 마타자 번호 */
export interface NariRecordFielder {
  readonly name: string
  readonly position: number
  /** 마타자면 0~4, 아니면 null (레코드 +0xa & 0x40 — 0xb633c) */
  readonly ace: number | null
  /** 경기용 명단 칸 값(`nariLineupSlotsOf` — `QuickLineup.rosterSlots` 가 드는 값). 대타 니블을 따라가는 데 쓴다 */
  readonly lineupSlot?: number
}

/** 타순 칸을 든 타자편 커리어 칸 */
export interface NariBattingOrderFields extends NariTeamRecordFields {
  readonly battingOrder: number
}

/** 한 팀에 실린 마선수 번호 (`features/play-game` 의 `GameTeamAces` 와 같은 꼴) */
export interface NariRecordTeamAces {
  readonly batter: number
  readonly pitcher: number
}
