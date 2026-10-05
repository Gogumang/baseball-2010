import type { BatterAbility } from '@/entities/batting/model/batter'

/**
 * **마선수 레벨 능력치 배율** — 표 `u8 0xd88aa` = [60, 70, 80, 90, 100] (%), 레벨 0~4 = Lv1~5.
 *
 * 실효 능력치 0xb6414 의 첫 단계다 (마선수 레코드만):
 * ```
 * b6426  v = s16 rec[+0xc + 2·칸]
 * b6438  i = 0xb63a0(rec)              ; +0xa 비트 6(0xb633c) 이면 +0xa & 0x1f, 아니면 −1
 * b643e  if i < 0 → b646c              ; 육성·로스터 선수는 배율 없음
 * b6442  if !0xb6278(rec): i += 5      ; 타자면 +5
 * b6458  lv = s8 mgr[0x138 + 2 + i]    ; mgr = 0x1f1d9([0x1400054])
 * b645e  v = v · s8 0xd88aa[lv] / 100  ; 0xca7b5 = 0 쪽 버림 나눗셈. 여기선 999 로 안 자른다
 * b648c  플래그가 0 이면 여기서 끝 — 장비·스킬은 플래그 1 일 때만
 * ```
 * 모드도 플래그도 보지 않고 **네 칸 모두**에 붙는다. 그래서 0xb570c/0xb570d(경기용 값)를 거치는
 * 마선수 능력치는 모두 이 배율을 먼저 먹고, 0..999 자르기는 그 뒤 0xb570c 끝에서 한다.
 */
export const ACE_LEVEL_ABILITY_PERCENT = [60, 70, 80, 90, 100] as const

/**
 * 새 저장의 마선수 레벨 — 기본값 함수 0x9f26c 가 `mgr[0x13a..0x143]` 열 칸을 0 으로 채운다
 * (0x9f2e2~0x9f2fa: `r2 = mgr + 0x13a; r1 = 9; do { strb 0; r2++ } while (--r1 ≥ 0)`).
 * 올리는 곳은 마선수 레벨업 0x5fb24(`mgr[0x13a+idx] = lv + 1`) 하나뿐이다. 그 창은 스페셜 마선수 선택
 * (상태 28, 0x2af20)·일반모드 마선수(상태 21 `0` 키, 0x29df8)가 연다 (시즌 마선수 0xa248·0xaa24 도 키·그리기를 부르지만 여는 자리는 안 읽었다).
 */
export const INITIAL_ACE_LEVEL = 0

/** 마선수 열 칸 중 마타자가 시작하는 자리 (0xb644c `adds r4,#5`) */
const ACE_BATTER_SLOT_OFFSET = 5

/**
 * 마선수 레벨 칸 번호 `idx` (0~9) — `mgr[0x13a + idx]`. 마투수 순번 n → n, 마타자 순번 n → n + 5.
 * 마선수 고르기 격자(윗줄 마투수 0~4 · 아랫줄 마타자 5~9)와 같은 번호다.
 *
 * `order` 는 미션 레코드의 마선수 순번(1부터, `missionOpponentOf` 와 같은 눈금)이다.
 */
export function aceLevelSlotOf(role: '타자' | '투수', order: number): number {
  return (role === '타자' ? ACE_BATTER_SLOT_OFFSET : 0) + (order - 1)
}

/**
 * 저장된 마선수 레벨들(칸 번호 → 0~4)에서 한 칸을 읽는다. 저장이 없거나 그 칸이 비면
 * 새 저장 값 `INITIAL_ACE_LEVEL` 이다.
 */
export function aceLevelOf(levels: Readonly<Record<number, number>> | undefined, slot: number): number {
  return levels?.[slot] ?? INITIAL_ACE_LEVEL
}

/** 한 칸에 레벨 배율을 곱한다 — `v · 0xd88aa[lv] / 100`, 0 쪽 버림. 자르지 않는다 */
export function applyAceLevelRate(value: number, level: number): number {
  const percent = ACE_LEVEL_ABILITY_PERCENT[level]
  if (percent === undefined) {
    // 레벨업 0x5fb24 가 4 를 넘기지 않아 저장 값은 0~4 뿐이다. 표 밖은 원본도 다루지 않는다
    throw new RangeError(`마선수 레벨은 0~4 다: ${level}`)
  }
  return Math.trunc((value * percent) / 100)
}

/** 마선수 레코드 네 칸 모두에 레벨 배율을 곱한다 (0xb6414 가 칸을 가리지 않는다) */
export function aceAbilityAtLevel(ability: BatterAbility, level: number): BatterAbility {
  return {
    hit: applyAceLevelRate(ability.hit, level),
    power: applyAceLevelRate(ability.power, level),
    defense: applyAceLevelRate(ability.defense, level),
    run: applyAceLevelRate(ability.run, level),
  }
}

/** 마선수 레벨 칸 수 — `mgr[0x13a..0x143]` (0~4 마투수 · 5~9 마타자, 마선수 고르기 격자 칸 번호와 같다) */
export const ACE_LEVEL_SLOT_COUNT = 10

/** 마지막 레벨 값 (Lv5). 저장 값은 0~4 뿐이다 */
export const ACE_MAX_LEVEL = ACE_LEVEL_ABILITY_PERCENT.length - 1

/**
 * **마선수 레벨업 비용 표** `u32 0xd1724` = [3, 6, 9, 12] — 곱하기 1000 G (0x5fbb6~0x5fbcc
 * `ldr r3,[0xd1724 + 4·lv]; movs r3,#0xfa; lsls #2; muls` = ×1000).
 * 색인은 **지금 레벨(0기준)** 이다 → Lv1→2 3000 · Lv2→3 6000 · Lv3→4 9000 · Lv4→5 12000 G.
 * 표 다섯째 칸(0xd1734)은 이미 다른 표(배율 사본)라 Lv5 에서 레벨업을 부르면 쓰레기 값을 읽는다 —
 * 원본은 그 전에 "최고 레벨" 팝업으로 막는다 (`isAceMaxLevel`).
 */
export const ACE_LEVEL_UP_COST_THOUSANDS = [3, 6, 9, 12] as const

/** 0xd1724 값에 곱하는 수 (0x5fbc6 `movs r3,#0xfa; lsls r3,#2` = 1000) */
const ACE_LEVEL_UP_COST_UNIT = 1000

/**
 * 레벨업 창 다섯째 줄의 횟수 표 — 창 그리기 0x5f394 가 지금 레벨·다음 레벨 값을 나란히 보인다
 * (0x5f6ba~0x5f6de: 마선수 칸 ≤ 4 면 0xd173e, 아니면 0xd1739 를 `[lv]`·`[lv+1]` 로 읽는다).
 *   - 마타자 = img_text 115 "필살타법" + `s8 0xd1739` = [2, 2, 3, 4, 5]
 *   - 마투수 = img_text 308 "마구"     + `s8 0xd173e` = [3, 4, 5, 6, 7] (경기 쪽 0xd8509 와 같은 값)
 */
export const ACE_BURST_COUNT_BY_LEVEL = [2, 2, 3, 4, 5] as const
export const ACE_MAGIC_COUNT_BY_LEVEL = [3, 4, 5, 6, 7] as const

/**
 * 마선수 레벨 저장 — 원본 전역 기록 `u8 mgr[0x13a + idx]` 열 칸 (idx = 격자 칸 0~9).
 * 웹판은 오픈 플래그(`mgr[0x30..0x39]`)·G(`mgr[+0x64]`)처럼 모드와 상관없는 **전역** 저장소 하나에 둔다.
 */
export interface AceLevelSave {
  /** 칸 0~9 의 레벨 0~4 */
  readonly levels: readonly number[]
}

/**
 * 저장에서 읽은 값을 열 칸으로 맞춘다. 저장이 없거나(옛 세이브) 칸이 0~4 정수가 아니면
 * **새 저장 값 0** 이다 — 기본값 함수 0x9f26c 가 0x9f2e2~0x9f2fa 에서 열 칸을 0 으로 채운다.
 */
export function normalizeAceLevelSave(raw: unknown): AceLevelSave {
  const saved = (raw as Partial<AceLevelSave> | null | undefined)?.levels
  const levels = Array.from({ length: ACE_LEVEL_SLOT_COUNT }, (_unused, slot) => {
    const value: unknown = Array.isArray(saved) ? saved[slot] : undefined
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= ACE_MAX_LEVEL
      ? value
      : INITIAL_ACE_LEVEL
  })
  return { levels }
}

/** 새 저장 — 열 칸 모두 0 (Lv1) */
export const INITIAL_ACE_LEVEL_SAVE: AceLevelSave = normalizeAceLevelSave(null)

/** 칸 번호 → 레벨 꼴로 바꾼다 (`aceLevelOf`·`useMissionSession({ aceLevels })`·마선수 고르기 화면이 받는 꼴) */
export function aceLevelRecordOf(save: AceLevelSave): Readonly<Record<number, number>> {
  return Object.fromEntries(save.levels.map((level, slot) => [slot, level]))
}

/**
 * **최고 레벨인가** — 마선수 화면이 레벨업 창을 열기 전에 본다:
 * 0x2b0dc(스페셜 상태 28) · 0x29f82(일반모드 상태 21) `lv = s8 mgr[0x13a+idx]; cmp lv,#3; ble 창 열기`
 * → 3 보다 크면 StrCOMMON[40] "선택한 마선수는 최고 레벨입니다" 알림만 띄운다.
 * (레벨업 0x5fb24 안에는 이 검사가 없다 — 원본 그대로 바깥에서만 막는다.)
 */
export function isAceMaxLevel(level: number): boolean {
  return level > 3
}

/** 지금 레벨에서 한 단계 올리는 G — `1000 · 0xd1724[lv]` */
export function aceLevelUpCostOf(level: number): number {
  const thousands = ACE_LEVEL_UP_COST_THOUSANDS[level]
  if (thousands === undefined) {
    // 원본은 표 밖(Lv5)을 읽지만, 거기 닿기 전에 `isAceMaxLevel` 이 막는다
    throw new RangeError(`레벨업 비용은 레벨 0~3 에만 있다: ${level}`)
  }
  return thousands * ACE_LEVEL_UP_COST_UNIT
}

/** 레벨업 창 한 줄 — 지금 값과 다음 레벨 값 (0x5f79e~0x5f7cc · 0x5f6c4~0x5f6de) */
export interface AceLevelUpRow {
  /** 줄 딱지 (img_text 336~343 · 115 · 308 의 글) */
  readonly label: string
  readonly current: number
  readonly next: number
}

/** 마타자 줄 딱지 — img_text 336 히트 · 337 파워 · 338 수비 · 339 주루 · 115 필살타법 (0x5f5c2~0x5f5d8) */
const ACE_BATTER_ROW_LABELS = ['히트', '파워', '수비', '주루', '필살타법'] as const
/** 마투수 줄 딱지 — 표 0xd1c48 = img_text 340 제구 · 341 구속 · 342 변화 · 343 체력 · 308 마구 */
const ACE_PITCHER_ROW_LABELS = ['제구', '구속', '변화', '체력', '마구'] as const

/**
 * 레벨업 창 다섯 줄 (0x5f394 의 줄 고리 `[sp+0x58]` 0~4).
 *
 * 줄 0~3 은 XlsACE_LEVEL_UP 행의 기본 능력치 네 칸(표 차례 = 히트·파워·수비·주루, 마투수는 같은 칸을
 * 제구·구속·변화·체력으로 읽는다)에 배율 사본 `s8 0xd1734[lv]`·`[lv+1]` 을 곱해 100 으로 나눈다
 * (0xca7b5 = 0 쪽 버림). 줄 4 는 횟수 표 `[lv]`·`[lv+1]` 이다.
 * `level` 은 최고 레벨 검사를 지난 0~3 이어야 한다 (원본도 Lv5 창은 열지 않는다).
 */
export function aceLevelUpRowsOf(
  role: '타자' | '투수',
  ability: BatterAbility,
  level: number,
): readonly AceLevelUpRow[] {
  const labels = role === '타자' ? ACE_BATTER_ROW_LABELS : ACE_PITCHER_ROW_LABELS
  const counts = role === '타자' ? ACE_BURST_COUNT_BY_LEVEL : ACE_MAGIC_COUNT_BY_LEVEL
  const values = [ability.hit, ability.power, ability.defense, ability.run]
  const rows = values.map((value, row) => ({
    label: labels[row] ?? '',
    current: applyAceLevelRate(value, level),
    next: applyAceLevelRate(value, level + 1),
  }))
  const current = counts[level]
  const next = counts[level + 1]
  if (current === undefined || next === undefined) throw new RangeError(`레벨업 창은 레벨 0~3 에서만 열린다: ${level}`)
  return [...rows, { label: labels[4] ?? '', current, next }]
}

/**
 * **레벨업 판정** (0x5fb96~0x5fbea, 창에서 "예" 를 고르고 OK). 결과:
 *   - `G부족` — `G < 1000·0xd1724[lv]` (0x5fbd0 `cmp r4,r2; bge`). 팝업 0xcc214 를 띄우고 하위 단계
 *     +0x314 = 1 (0x5fbe8 → 0x5fcb0). **레벨도 G도 그대로**이고 레벨업 창도 안 닫힌다.
 *   - `레벨업` — 가격과 G가 같아도 오른다. 실제 쓰기는 `levelUpAceSave` + G 빼기.
 */
export type AceLevelUpOutcome =
  | { readonly kind: '레벨업'; readonly cost: number }
  | { readonly kind: 'G부족'; readonly cost: number }

export function aceLevelUpOutcomeOf(level: number, gamePoint: number): AceLevelUpOutcome {
  const cost = aceLevelUpCostOf(level)
  return { kind: gamePoint < cost ? 'G부족' : '레벨업', cost }
}

/**
 * **레벨업 쓰기** (0x5fbec~0x5fc24): `mgr[0x13a+idx] = lv + 1` (0x5fbee `strb r1,[r0,#2]`), 그 뒤
 * G = clamp(G − 1000·0xd1724[lv], 0, 99999) (0x5fbf2~0x5fc0a — 부르는 쪽이 지갑에서 뺀다),
 * 저장(0x1f1b9 · 0x22c29 G 사용 기록 · 0x1f1e1), 연출 0xbbc85, 창 닫기 0x5faf4.
 * 원본은 상한을 여기서 안 본다. 웹판은 Lv5 칸이 오면 멈춘다 — 원본에선 닿지 않는 경로다 (`isAceMaxLevel`).
 */
export function levelUpAceSave(save: AceLevelSave, slot: number): AceLevelSave {
  const level = save.levels[slot] ?? INITIAL_ACE_LEVEL
  if (isAceMaxLevel(level)) throw new RangeError(`최고 레벨 마선수는 레벨업 창이 안 열린다: 칸 ${slot}`)
  return { levels: save.levels.map((value, index) => (index === slot ? level + 1 : value)) }
}

/** 레벨업 쪽 글 (StrCOMMON 은 `base/extracted/StrCOMMON.json` 의 원문 그대로) */
export const ACE_LEVEL_UP_TEXT = {
  /** StrCOMMON[40] — 최고 레벨 알림 (0x2b0ea · 0x29f90, 버튼 하나) */
  maxLevel: '!C!cFFFFFF선택한 마선수는!N최고 레벨입니다',
  /** StrCOMMON[49] — 레벨업 창 비용 줄, %d = `1000·0xd1724[lv]` (0x5f89a) */
  confirm: '!C!cFFFF00%d G포인트!cFFFFFF를 사용하여!N레벨 업 하시겠습니까?',
  /** 0xcc214 (코드에 박힌 글) — G 부족 2버튼 팝업 (0x5fbd6). 마선수 오픈 부족 팝업과 같은 글이다 */
  shortage: '!C!cFF0000G포인트가 부족합니다.!cFFFFFF 구매!N페이지로 이동하시겠습니까?',
} as const
