import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'

/**
 * 투수편 능력치 칸과 GP 능력 아이템 (binary.mod 0xa4488 아이템 · 0xa4528 능력 가지 ·
 * 0xa44f4 한계 고르기 · 표 0xd80be — R7 3절 확정. 칸 이름은 StrMODE[40~43]).
 *
 * 투수 레코드의 능력치는 **+0xc 부터 s16 네 칸**이고 순서는
 *   0 제구 · 1 구속 · 2 변화 · 3 체력
 * 이다 (P1 4-1 의 `0xb570c(로스터, 칸 0 = 제구)`, R7 V5 검증).
 * 타자편과 **같은 아이템**이 칸 번호로만 갈린다 — 알림 글만 StrMODE[40~43] 로 다르다.
 */

export interface PitcherAbility {
  /** 칸 0 · 레코드 +0xc — 제구 */
  readonly control: number
  /** 칸 1 · 레코드 +0xe — 구속 */
  readonly velocity: number
  /** 칸 2 · 레코드 +0x10 — 변화 */
  readonly breaking: number
  /** 칸 3 · 레코드 +0x12 — 체력 (스태미나 용량의 바탕이 된다) */
  readonly stamina: number
}

/** 칸 번호 순서. 아이템 번호 0~3 이 그대로 이 칸을 가리킨다 */
export const PITCHER_ABILITY_ORDER: readonly (keyof PitcherAbility)[] = [
  'control',
  'velocity',
  'breaking',
  'stamina',
]

/** 칸 이름 (StrMODE[40]~[43]) */
export const PITCHER_ABILITY_NAMES: readonly string[] = ['제구', '구속', '변화', '체력']

/** 능력치 상한 (0xb6414 가 999 로 자른다) */
export const MAXIMUM_PITCHER_ABILITY = 999

/**
 * 보직별 능력 한계 표 `0xd80be` × 10.
 * ⚠️ 타자와 달리 **타입이 아니라 보직**(`rec[+0xb] & 3`)으로 행을 고른다 (0xa44f4~0xa4514).
 *   보직 0(선발) → 네 칸 모두 800
 *   그 밖(구원) → 제구 850 · 구속 850 · 변화 850 · **체력 600**
 */
export function pitcherAbilityLimitOf(role: PitcherRole): PitcherAbility {
  if (role === PITCHER_ROLE.starter) return { control: 800, velocity: 800, breaking: 800, stamina: 800 }
  return { control: 850, velocity: 850, breaking: 850, stamina: 600 }
}

/** GP 능력 아이템이 한 번에 올리는 값 */
export const ABILITY_ITEM_GAIN = 10

/** 네 칸을 한꺼번에 올리는 아이템 번호 (엄마의도시락) */
export const ALL_ABILITY_ITEM_ID = 4

/**
 * 투수편에서 GP 아이템 0~4 가 건드리는 칸.
 * (5~9 또또상품권·영지버섯·종합건강진단·최면요법·이글아이 는 타자편과 같은 코드가 처리한다 —
 *  `entities/career/model/gpItems.ts` 쪽이고 여기서 다시 만들지 않는다.
 *  투수편 전용 아이템 9 십전대보탕은 `pitcherStamina.ts` 에 있다.)
 */
export const PITCHER_ABILITY_ITEM_TARGETS: readonly (keyof PitcherAbility)[] = PITCHER_ABILITY_ORDER

/** 아이템 알림 글 StrMODE 번호 — 칸 k 는 [40 + k], 모든 능력치는 [39] */
export const PITCHER_ABILITY_ITEM_TEXT_INDEX = { firstSlot: 40, allSlots: 39 } as const

/**
 * `0xa4528` — 칸을 10 올려 999 로 자른 뒤, **기본 능력치가** 한계를 넘으면 한계로 내린다.
 * 비교에 쓰는 값이 `0xb6414(rec, k, 0)` = **장비·스킬을 뺀 기본값**이라는 점까지 타자편과 같다.
 */
export function applyPitcherAbilityItem(
  ability: PitcherAbility,
  itemId: number,
  role: PitcherRole,
): PitcherAbility {
  const isAbilitySlot = itemId >= 0 && itemId < PITCHER_ABILITY_ITEM_TARGETS.length
  const targets: readonly (keyof PitcherAbility)[] =
    itemId === ALL_ABILITY_ITEM_ID
      ? PITCHER_ABILITY_ITEM_TARGETS
      : isAbilitySlot
        ? [PITCHER_ABILITY_ITEM_TARGETS[itemId]]
        : []
  const limits = pitcherAbilityLimitOf(role)
  let next = ability
  for (const key of targets) {
    const raised = Math.min(MAXIMUM_PITCHER_ABILITY, next[key] + ABILITY_ITEM_GAIN)
    const capped = raised > limits[key] ? Math.min(limits[key], MAXIMUM_PITCHER_ABILITY) : raised
    next = { ...next, [key]: capped }
  }
  return next
}

/**
 * 히든 변화구를 여는 이벤트 30~33 의 능력치 조건 (J 4절 3-3).
 * 조건 타입 0·1·2 가 각각 제구·구속·변화 칸을 본다 — **체력(칸 3)을 보는 조건은 없다**.
 */
export const HIDDEN_PITCH_EVENTS: readonly {
  readonly eventId: number
  /**
   * r_event 기간 칸 `[연차, 경기]` — 레코드 +9~+0xc 를 그대로 옮긴 것이다 (`r_event.zt1`).
   * 판정은 날짜 창 `0xad110~0xad140`: `from=(a−1)·45+b`, `to=(c−1)·45+d`,
   * `now=연차(0부터)·45 + 치른 경기 + 1` 로 두고 `from ≤ now ≤ to` (A 1절 8번).
   */
  readonly dateFrom: readonly [number, number]
  readonly dateTo: readonly [number, number]
  readonly control: number
  readonly velocity: number
  readonly breaking: number
  /** 구질 훈련 표 0xcc390 의 행 (열 4 가 히든이다) */
  readonly row: number
  readonly pitchName: string
}[] = [
  { eventId: 30, dateFrom: [5, 9], dateTo: [13, 45], control: 200, velocity: 250, breaking: 300, row: 1, pitchName: 'P.SLIDER' },
  { eventId: 31, dateFrom: [6, 9], dateTo: [13, 45], control: 250, velocity: 350, breaking: 250, row: 2, pitchName: 'KNUCKLE' },
  { eventId: 32, dateFrom: [7, 9], dateTo: [13, 45], control: 300, velocity: 400, breaking: 600, row: 3, pitchName: 'SPECIAL' },
  { eventId: 33, dateFrom: [8, 9], dateTo: [13, 45], control: 400, velocity: 700, breaking: 400, row: 0, pitchName: 'P.SINKER' },
]

/*
 * ⚠️ **`pitchName` 은 표 이름이지 이벤트 대사가 아니다.** 보상이 여는 것은 `row`(= 보상 종류 6 의 값,
 * 0x8c5da → `선수[0x204+행] = 1`)이고, 행별 열4 구질 번호는 구질 훈련 표 `0xcc390` 이 정한다.
 * 그런데 r_event 대사는 30 "파워싱커" · 31 "파워슬라이더" · 32 "너클볼" · 33 "자이로볼" 이라
 * 여기 이름과 **한 칸씩 어긋난다**. 표 0xcc390 의 구질 **번호**(18~21)는 확정이지만 그 번호→이름
 * 대응(`pitchTypes.ts` 를 1부터 센 것)은 J 3-2 가 **유력**이라고 적어 둔 것이라, 어긋남은
 * 이름표 쪽 문제로 보인다. 판정에 쓰이는 값이 아니므로 **원본 데이터(row)를 그대로 두고** 적어만 둔다.
 */

/**
 * **아직 못 채운 것**: 구질 훈련 횟수 표(StrMODE[89] "%d/%d회")는 해독 문서에 값이 없다 (J 3-2 미해결).
 * 값을 지어내지 않고 자리만 비워 둔다.
 *
 * (등록 시작 능력치 표는 **있다** — C-4 의 `0xcc3f2`: 선발 [10,10,10,20]·구원 [12,12,12,10] ×10,
 * 타입 보너스 +30. `pitcherRegistration.ts` 가 쓴다. 예전에 "없다" 고 적혀 있던 것을 바로잡았다.)
 */
