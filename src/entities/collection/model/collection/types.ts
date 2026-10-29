import { EMPTY_ANNALS_STATS } from '@/entities/collection/model/annalsStats'
import type { AnnalsStats } from '@/entities/collection/model/annalsStats'
import type { BatterAbility, PitcherAbility, PitcherRole } from '@/entities/collection/model/collection/otherSlices'

/** 선수 생김새 — 레코드 +0xb (타입·손·피부) 와 팀. 명예의 전당 그림(캐릭터·팀 로고)이 쓸 칸이다 */
export interface HallOfFameLook {
  readonly typeIndex: number
  readonly handIndex: number
  readonly skinIndex: number
  readonly teamId: number
}

/**
 * 등록 `0x1f654`(투수) / `0x1f680`(타자) 은 선수 기록 0x30 바이트를 **통째로** 칸에 복사한다
 * (`memcpy(전역기록 + 0x880|0x940 + 칸·0x30, 선수, 0x30)` — 그 앞에 +0xa 를 0(투수)/0x20(타자),
 * +0 을 칸 − 0x4c / 칸 − 0x38 로 바꿔 명예 선수 번호를 단다). 그래서 명전 선수는 미션·홈런더비(0x1fbd0 · 0x1fc20)에서
 * 나리 선수와 같은 칸을 읽힌다 — 능력치 +0xc · 장착 비트 +0x14 · 고른 마구/필살 번호 +0x18 · 구질 마스크 +0x1c(투수) ·
 * 장비 니블 · 생김새 +0xb. 웹 기록은 0x30 바이트가 아니라 그중 경기가 읽는 칸만 이름으로 든다.
 * 이 칸들은 2026-10-06 에 더했다 — 그 전에 등록한 옛 저장에는 없어 `undefined` 다(읽는 쪽이 대체를 정한다).
 */
interface HallOfFameRecordFields<Ability> {
  /** 장비 니블 (0 = 미장착, 1~11 = 레벨+1) — 0xb6414 가 능력치에 얹는다 */
  readonly equipmentLevels?: Ability
  /** 장착 스킬 — 기록 +0x14 비트 (`career.equippedSkillIds` 그대로, 경기 스킬 0xb62b4 가 본다) */
  readonly equippedSkillIds?: readonly number[]
  /**
   * 기록 +0x20~+0x2b 시즌 줄 s16 여섯 칸 — 등록이 통째 베낀 그때 선수 레코드의 줄(타자 `batterRecordLineOf` · 투수 `pitcherRecordLineOf`).
   * 미션(모드 5 · 6)의 소개 판 0x44944 가 이 칸에 이 경기 줄을 더해 읽는다. 2026-10-15 에 더했다 — 그 전 옛 저장에는 없다
   */
  readonly recordLine?: readonly number[]
  /**
   * 기록 +0x1b — 나리 연봉 쓰기 0xa4fd8 가 둔 min(연봉 / 10, 255) (`nariRecordSalaryGradeOf`). 시즌 영입 선수의 상세 창 연봉이
   * 이 칸 × 1000 이다. 2026-10-16 에 더했다 — 그 전 옛 저장에는 없다(읽는 쪽은 칸을 비운다)
   */
  readonly salaryGrade?: number
  /**
   * 기록 **+0xa 아랫 5비트** — 등록이 0(투수 +0xa = 0 · 타자 +0xa = 0x20)으로 적고, 시즌 영입 0xc554 의 c578 `0xb6605(원본, j)` 가
   * 이 전역 기록(0x1f62d · 0x1f641 = [전역+0xac] + 0x880 | 0x940 + 칸 × 0x30)에 **고른 자리 j** 를 적는다. 영입 끝 0xc5dc
   * `0x22755(앱, 1)` 이 지금 모드 파일 저장에 이어 22bee `0x1f1b8` 로 전역 블록(크기 [+0xcc] = 0xe44, game_o.sav)을 통째로 써서
   * 파일에 남는다. 홈런더비 · 타자 미션의 0x1fc20 이 이 기록 자체를 주므로 0xb53f0 0x20 갈래의 k 가 이 값이다.
   * 2026-10-16 에 더했다 — 없으면(옛 저장 · 영입한 적 없음) 0
   */
  readonly recordSlot?: number
}

/** 명예의 전당 타자 (+0x940 칸) */
export interface HallOfFamer extends HallOfFameRecordFields<BatterAbility> {
  readonly name: string
  readonly ability: BatterAbility
  readonly endingIndex: number
  readonly season: number
  readonly titleIds: readonly string[]
  /** 칸 번호 0~7 — 옛 저장에는 없어 목록 순서로 본다 */
  readonly slot?: number
  /** 장비·장착 스킬을 얹은 능력치 `0xb6415(기록, k, 1)` — 능력치 도형이 쓴다. 옛 저장에는 없다 */
  readonly equippedAbility?: BatterAbility
  readonly look?: HallOfFameLook
  /** 고른 필살타법 번호 — 기록 +0x18 (`career.specialSwingNumber`, 0 이면 안 고름) */
  readonly specialSwingNumber?: number
  /** 내야 0 · 외야 1 — 기록 `+0xb & 3` (등록이 0x30 바이트를 그대로 옮긴다). 옛 저장에는 없다 */
  readonly positionIndex?: number
}

/** 명예의 전당 투수 (+0x880 칸) */
export interface HallOfFamePitcher extends HallOfFameRecordFields<PitcherAbility> {
  readonly name: string
  readonly ability: PitcherAbility
  readonly equippedAbility: PitcherAbility
  readonly endingIndex: number
  readonly season: number
  readonly titleIds: readonly string[]
  /** 칸 번호 0~3 */
  readonly slot: number
  readonly look: HallOfFameLook
  /** 보유 구질 마스크 — 기록 +0x1c (비트 t−1 = 구질 t, 경기 구질 칸 0xb6d2c 가 본다) */
  readonly pitchMask?: number
  /** 고른 마구 번호 — 기록 +0x18 (0 없음 · 1~4) */
  readonly selectedMagicNumber?: number
  /**
   * 보직 — 기록 `+0xb & 3` (0xb6dec → 0xb6705). 등록 0x1f654 는 `+0xa`(= 0)·`+0`(칸 − 0x4c)만 덮어쓰고 `+0xb` 는
   * 손대지 않은 채 0x30 바이트를 복사하므로(0x1f656~0x1f674) 투수편 선수의 보직이 그대로 남는다. 시즌 경기가 이 칸을
   * CPU 투수 교체(0xabfcc · 0xac428)·등판 판정(0xa4f60) 등에서 읽는다. 옛 저장에는 없다(받는 쪽이 선발로 본다).
   */
  readonly role?: PitcherRole
  /**
   * 기록 **+0x2c 스태미나** — 등록 0x1f654 가 그때 투수 레코드 0x30 바이트를 통째로 베끼므로 그 순간의 `career.stamina` 다.
   * 미션 투수(0x1fbd0 이 명전 기록을 준다)의 경기 스태미나가 이 칸이다. 시즌 영입 0xc554 가 c584~c588 `strh 0x2710, [기록, #0x2c]` ·
   * 0xb6cc4 로 이 전역 기록 자체를 10000 으로 바꾸고 0x22755 → 0x1f1b8 이 game_o.sav 에 남긴다(`withHallOfFameRecordSlot`).
   * 2026-10-26 에 더했다 — 옛 저장은 `normalizeCollection` 이 10000 으로 채운다(이사 — 등록 때 값이 남아 있지 않다)
   */
  readonly stamina?: number
}

export interface Collection {
  readonly titles: readonly string[]
  /*
   * 스킬 탭 '얻음' 은 `stats` 의 켠 스킬 비트(+0xf4/+0xf8)로 가른다(0x58a3c, `annalsSkillOfCell`). 예전의 `skills`(타자편 보유
   * +0x1b8 합집합)는 원본에 없는 칸이라 뺐다(r138) — 옛 저장에 남은 `skills` 는 읽을 때 버린다.
   */
  readonly endings: readonly number[]
  /**
   * 본 시즌모드 엔딩 e (0~4) — 전역기록 `+0xa0 + e`. 새 해 0x6e0c 가 10년차 엔딩 판정 0xa3084 ≥ 0 이면 1 을 쓴다(P4 1c).
   * 읽는 곳은 "엔딩 모두 수집" 판정 0x28e98(0x292a4~0x292b6) — 엔딩 이름은 StrMAINMENU[204~208] "비인기 … 최강".
   * 옛 저장에는 없어 빈 목록이다.
   */
  readonly seasonEndings: readonly number[]
  readonly hallOfFame: readonly HallOfFamer[]
  readonly hallOfFamePitchers: readonly HallOfFamePitcher[]
  /** 열린 히든 id (0x62368 — 원본 전역 저장) */
  readonly openedHiddenIds: readonly number[]
  /** 통계 기록 `[mgr+0xc8]` 중 웹이 채우는 칸 — GP 아이템 구매 수·G 사용처·켠 스킬 비트 (`annalsStats.ts`) */
  readonly stats: AnnalsStats
  /**
   * 전역기록 **`+0xbf`(s8)** — 시즌모드 정규시즌 경기에서 사람 팀이 이긴 수, 100 에서 멈춘다(0x9f6f0). 정산 0x4ea0c 가
   * 올린 바로 뒤 > 99 면 히든 45 를 연다(`countSeasonRegularWin`). 옛 저장에는 없어 0
   */
  readonly seasonRegularWinCount?: number
}

export const EMPTY_COLLECTION: Collection = {
  titles: [],
  endings: [],
  seasonEndings: [],
  hallOfFame: [],
  hallOfFamePitchers: [],
  openedHiddenIds: [],
  stats: EMPTY_ANNALS_STATS,
}

/** 명예의 전당 편 — 0x62514 의 둘째 인자 (투수 ≠ 0) */
export type HallOfFameSide = '투수' | '타자'

/**
 * 미션·홈런더비 **선수 고르기** 결과 (메인 메뉴 하위 17 미션 0x29a54 · 16 홈런더비 0x29ac8, 목록 0x62568 → 0x5eae0).
 * 칸 코드 1 나리 투수 · 2 나리 타자 · 3 명예 투수 · 4 명예 타자 를 편과 명전 번호로 든다 —
 * 0x5eae0 이 **전역기록 +0xa5(투수)/+0xa6(타자)** 에 쓰는 s8 그대로다: 나리 선수면 −1(`null`), 명예 선수면 명전 번호 0~.
 * 경기 선수 게터 0x1fbd0 · 0x1fc20 이 모드 5·6·7 에서 이 값이 0 이상이면 명전 기록(0x1f62c · 0x1f640)을 준다.
 */
export interface HallOfFamePlayerPick {
  readonly side: HallOfFameSide
  /** 명전 번호 (투수 0~3 · 타자 0~7) — 나리 선수면 null (+0xa5/+0xa6 = −1) */
  readonly hallOfFameIndex: number | null
}

export type HallOfFameResult =
  | { readonly kind: '등록'; readonly collection: Collection; readonly slot: number }
  | { readonly kind: '빈칸없음' }
  | { readonly kind: 'G부족' }
  | { readonly kind: '엔딩전' }
