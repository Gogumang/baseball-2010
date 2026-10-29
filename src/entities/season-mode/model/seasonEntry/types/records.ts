import type { SeasonPlayer } from '@/entities/season-mode/model/playerRecruit'
import type { PitcherRole } from '@/entities/season-mode/model/seasonEntry/otherSlices'

/**
 * **시즌 팀 레코드에 남은 마선수** (U-105 r154 — 직접 떴다). 0xdd 진입 0x6548(66da · 66e6 내 팀 · 66f8 · 670a 상대)과 CPU 끼리 경기 준비
 * 0xc239c(c24aa~c24ee)의 `0xb88c8` · `0xb8870` 은 모드 2 에서 `0xb8680`(점프표 0xd8a30[1] = 0xb869e → b8724 `0x1f571(저장, 팀+0x25)`)
 * 으로 **시즌 저장의 팀 레코드 자체**에 넣는다 — 마투수 `0xb521c` 0x60 갈래(b5244~b529c: 수 > 8 이고 8번이 마선수면 덮기, 아니면
 * 0xb4e34(T, 1) 로 한 칸 늘려 8번을 맨 끝으로 베끼고 8번에) · 마타자 `0xb53f0` 0x40 갈래(b5418~b5470: 9번 같은 규칙). 빼는 곳은
 * `0xb512c`(b512c~b51e6: 수 > 8 · 9 이고 8 · 9번이 0xb633d 마선수면 맨 끝 줄을 그 칸에 베끼고 끝 줄 memset 0 · 수 −1) 하나이고,
 * 그것을 부르는 곳은 0xdf 진입 0x5980(5988~599e) · 0xe5 진입 0x5cd0(5cd8~5cee) 둘뿐이다 — 둘 다 열 팀 모두(i = 0..9 `0x1f571`).
 * 그래서 경기 뒤 그 둘을 지나기 전까지 레코드에 마선수 줄이 남는다(경기 끝 0x4ea0c 의 0x22755 로 파일에도 든다).
 * 웹 명단 배열(`roster` · `cpuRosters`)에는 넣지 않고 팀마다 무엇이 남았는지만 든다(`SeasonSave.recordAces`).
 */
export interface SeasonRecordAces {
  /** 8번 칸 마투수 0..4 (`ACE_PITCHERS`) — 없으면 −1 */
  readonly pitcher: number
  /** 9번 칸 마타자 0..4 (`ACE_BATTERS`) — 없으면 −1 */
  readonly batter: number
  /** 마투수 레코드 +0x2c — 경기 끝 값에 하루 끝 4f2bc `0xb617c`(+20%)를 먹인 것. 없으면 10000 */
  readonly pitcherStamina?: number
}

/**
 * **팀 경기에 넘길 내 팀 명단 순서** — 팀 경기 옵션 `ourEntryOrder`(`teamGameRoster.TeamEntryOrder`)로 받는다.
 *
 * 받는 쪽은 타자 명단을 이 순서(로스터 칸 + 수비 위치)로, 투수 명단도 이 순서로 세우고 **선발 칸은
 * `rotationSlotOf(dayCounter)`** 를 쓴다 — 원본의 "g 번 돈 배열의 0번" 과 같다.
 *
 * 영입 선수(id ≥ 0xb4 · 0xfe)는 붙박이 표에 없다. 원본 경기용 팀 0xb891c 는 팀 레코드의 0x30 바이트를 id 로 거르지 않고
 * 그대로 쓰고(0xb8680), 이름은 0xaa458 표 밖이라 rec + 1, 능력치는 그 기록의 0xb6414 다 (7da5044) — 그래서
 * 선수가 영입 때 옮긴 기록 사본(`SeasonPlayer.record` — 나리 선수)을 들고 있으면 그것을, 아니면 `recordOf` 가 주는
 * 기록(명전 칸)을 그 칸에 싣는다. 둘 다 없으면 `rosterSlot` −1 (받는 쪽이 안 쓴 표 칸으로 채운다 — 근사).
 */
export interface SeasonEntryBatterRecord {
  readonly name: string
  /** 히트 · 파워 · 수비 · 주루 — 0xb6414(기록, k, 1) */
  readonly ability: readonly [number, number, number, number]
  /** 원본 id(+0) — 명단 차례에 실을 때 붙인다. 팀 경기가 그 선수의 시즌 기록을 표 밖 줄로 쌓는다 */
  readonly recordId?: number
  /** +0xb — 타입(비트5~7) · 손(비트4) · 피부(비트2~3) · 내외야(비트0~1) (`seasonRecordProfileOf`). 옛 사본엔 없다 */
  readonly profile?: number
  /** +0x18 — 고른 필살타법 번호 (0 안 고름). 옛 사본엔 없다 */
  readonly specialNumber?: number
  /** +0xc 네 칸 — `0xb6415(기록, k, 0)` 밑값 (장비·스킬 전). 옛 사본엔 없다 (`SeasonEntryRecordParts`) */
  readonly baseAbility?: readonly [number, number, number, number]
  /** +0x14 장착 스킬 비트. 옛 사본엔 없다 */
  readonly skillBits?: number
  /** +0x19 · +0x1a 장비 니블 네 칸 — 영입 0xc554 가 옮긴 기록의 니블. 옛 사본엔 없다 */
  readonly equipment?: readonly number[]
  /** +0x1b — 나리 연봉 쓰기 0xa4fd8 가 둔 min(연봉 / 10, 255) (`nariRecordSalaryGradeOf`). 옛 사본엔 없다 */
  readonly salaryGrade?: number
}

/**
 * 기록 사본의 0x30 바이트 중 `0xb6414` 를 다시 셈하는 칸 — 밑값 +0xc · 장착 스킬 +0x14 · 장비 니블 +0x19/+0x1a.
 *
 * 영입 0xc554 는 기록 0x30 바이트를 통째로 팀 레코드에 옮기고, 시즌 장비 창(0xdc → 적용 0x7d90)은 그 팀 레코드의 +0x19 · +0x1a 에
 * 니블을 쓴다. 경기용 팀 0xb891c → 0xb8680 은 그 레코드를 읽어 `0xb6414(기록, k, 1)` = 밑값 + 니블 보너스 + 장착 스킬을 **경기마다**
 * 셈한다 — 그래서 시즌에 산 장비가 영입 선수에게도 얹힌다. 세 칸이 있으면 `seasonRecordAbilityOf` 가 그렇게 셈하고, 없는 옛 사본은
 * 영입 때 남긴 `ability`(그때의 0xb6414)를 그대로 쓴다.
 */
export type SeasonEntryRecordParts = Pick<SeasonEntryBatterRecord, 'ability' | 'baseAbility' | 'skillBits' | 'equipment'>

export interface SeasonEntryPitcherRecord {
  readonly name: string
  /** 제구 · 구속 · 변화 · 체력 — 0xb6414(기록, k, 1) */
  readonly ability: readonly [number, number, number, number]
  /** 이름 · 폼 0xb6e24 · 고른 마구 +0x18(`magicId` — 경기가 마구 번호로 쓴다) · 구질 마스크 +0x1c */
  readonly repertoire: { readonly name: string; readonly form: number; readonly magicId: number; readonly pitchMask: number }
  /** 보직 `+0xb & 3` (0xb6dec) — 없으면 받는 쪽(CPU 투수 교체)이 선발로 본다 */
  readonly role?: PitcherRole
  /** 원본 id(+0) — `SeasonEntryBatterRecord.recordId` 와 같다 */
  readonly recordId?: number
  /** +0xb 한 바이트 (`seasonRecordProfileOf`, 아랫 2비트 = `role`). 옛 사본엔 없다 */
  readonly profile?: number
  /** +0xc 네 칸 밑값 · +0x14 · +0x19/+0x1a — `SeasonEntryBatterRecord` 의 같은 칸 (`SeasonEntryRecordParts`) */
  readonly baseAbility?: readonly [number, number, number, number]
  readonly skillBits?: number
  readonly equipment?: readonly number[]
  /** +0x1b — `SeasonEntryBatterRecord.salaryGrade` 와 같다 */
  readonly salaryGrade?: number
}

/** 표 밖 선수의 기록을 찾아 준다 — 없으면 undefined */
export interface SeasonEntryRecordSource {
  readonly batter: (player: SeasonPlayer) => SeasonEntryBatterRecord | undefined
  readonly pitcher: (player: SeasonPlayer) => SeasonEntryPitcherRecord | undefined
}

export interface SeasonEntryOrder {
  readonly batters: readonly {
    readonly rosterSlot: number
    readonly position: number
    readonly record?: SeasonEntryBatterRecord
    /** `rosterSlot` 의 붙박이 표 팀 — 트레이드로 옮겨 온 선수만 (`SeasonPlayer.tableTeamId`) */
    readonly tableTeamId?: number
    /** 레코드 장비 니블 네 칸 — 저장 명단에 있을 때만 (`SeasonPlayer.equipment`, 경기가 0xb6414 보너스로 먹는다) */
    readonly equipment?: readonly number[]
  }[]
  /** 로스터 칸, 표 밖 선수의 기록, 또는 다른 팀 표 자리(트레이드로 옮겨 온 투수) */
  readonly pitchers: readonly (number | SeasonEntryPitcherRecord | SeasonEntryTablePitcher)[]
}

/** 붙박이 표 자리의 투수 — 트레이드로 옮겨 온 투수, 또는 장비 니블을 든 제 팀 투수(`tableTeamId` 없음 = 그 팀) */
export interface SeasonEntryTablePitcher {
  readonly tableTeamId?: number
  readonly tableSlot: number
  /** 레코드 장비 니블 네 칸 (`SeasonPlayer.equipment`) */
  readonly equipment?: readonly number[]
}
