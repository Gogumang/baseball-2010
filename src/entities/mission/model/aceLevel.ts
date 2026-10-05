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
 * 올리는 곳은 마선수 레벨업 0x5fb24(`mgr[0x13a+idx] = lv + 1`, 스페셜 마선수 화면) 하나뿐이다.
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
