import type { BatterAbility } from '@/entities/batting/model/batter'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { isSkillEquipped, MAXIMUM_ABILITY } from '@/entities/career/model/playerCareer'
import { equipmentBonusOf } from '@/entities/career/model/equipment'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 선수 상태 — 부상·질병 (StrHOWTO[14]).
 *   "사기가 낮으면 부상이나 질병에 걸릴 확률이 높아집니다 … 추가 능력치 페널티를 받습니다"
 *   부상: StrMODE[212] "부상으로 선수 능력치가 60% 감소하였습니다"
 *   질병: r_event_txt[537] "질병으로 선수 능력치가 30% 감소하였습니다"
 *   질병 이름: StrMODE[186]~[189]
 * 질병은 원본에서 이벤트 490(조건 22 — 사기 구간 확률)로만 걸린다 → storyScene.
 * 부상은 훈련 결과 창을 닫을 때 굴린다 (rollTrainingInjury, 0x1b4c4).
 * 둘 다면 질병 −30% → 부상 −60% 를 차례로 곱한다 — 더 큰 감소 하나만 적용하는 게 아니다 (0xb570c, G-1 확정).
 */
export const ILLNESS_NAMES: readonly string[] = ['감기', '몸살', '식중독', '배탈']

/** 부상 남은 기간 (0x1b4c4 가 +0x1b5 = 3) */
const INJURY_DURATION = 3
/** 부상·질병 감소율 (0xb570c) — 둘 다면 질병 먼저, 부상 다음으로 **차례로** 곱한다 */
const ILLNESS_ABILITY_CUT = 30
const INJURY_ABILITY_CUT = 60

/** 실효 능력치 스킬 보정 (0xb6414, 누락 탐색 5차) — 스킬 20 은 수비(칸 2)만 (0xb652c `cmp #2`) */
const POWERLESS_SKILL = 5
const LEGEND_SKILL = 7
const DEFENSE_PENALTY_SKILL = 20
const SKILL_PENALTY = 100
const LEGEND_BONUS = 50

const clampAbility = (value: number) => Math.min(MAXIMUM_ABILITY, Math.max(0, value))

/**
 * 사기가 낮을 때의 능력치 감소 (0xb570c 뒷부분) — 나눗셈은 0 쪽 버림이다.
 * 안내문은 StrMODE[213] "사기가 낮아 선수 능력치가 %d 감소하였습니다".
 */
const MORALE_ABILITY_CUTS: readonly (readonly [number, number])[] = [
  // [사기 상한, 감소율 %] — 사기 > 50 이면 그대로
  [10, 50],
  [30, 20],
  [50, 10],
]

/** `v += (−p·v)/100` 을 0 쪽 버림으로 (원본 나눗셈 0xca738) */
const reduceByPercent = (value: number, percent: number) =>
  value - Math.trunc((value * percent) / 100)

/**
 * 경기에 쓰는 능력치 `0xb570c(…, k, 기록, 1, 체력인자, …)` — 모드 3·4 이고 내 선수(0xb6389)일 때의 갈래
 * (디스어셈 0xb570c~0xb5b18 을 다시 읽었다, 투수편 b48dde5 와 같은 코드):
 *   1. 0xb6414(기록, k, 1) = `equippedAbilityOf` (아래)
 *   2. 질병 +5 켜짐이면 `v += (−30·v)/100` (0xb5784 `lsls #4; subs; lsls #1` = −30, 나눗셈 0xca7b5 = 0 쪽 버림)
 *   3. 부상 +0x1b5 > 0 이면 `v += (−60·v)/100` (0xb57b4 `lsls #4; subs; lsls #2` = −60) — 질병 다음에 **차례로**
 *   4. 사기(0xa3a25) > 50 그대로 · 31~50 `v += v/−10` · 11~30 `v += v/−5` · ≤ 10 `v −= trunc(v/2)` (0xb57c4~0xb5802)
 *      — `v·p/100` 을 0 쪽 버림한 것과 정수에서 같은 값이라 `reduceByPercent` 로 쓴다
 *   5. 체력% 피로 0xb58e6 — 타자 쪽 부르는 곳(0x7ba44 기본정보: 모드 2 갈래 0x7bf28 = 0x5b · 모드 3·4 갈래 0x7c036/0x7c048 = 0x5a, 0xb5b50 = 0x5a)은 인자가 54 를 넘어 그대로다
 *   6. 팀 능력치(0xb592c, 모드 1·2·8·9 만)·코치 스킬 14(0xb5a16, 투수만)·모드 2 갈래 — 타자 육성(모드 4)엔 없다
 *   7. **맨 끝 한 번만** 0..999 로 자른다 (0xb5b06) — 중간 단계에는 자르기가 없다
 * 1 의 결과가 이미 0..999 이고 2~4 는 0 이상인 값을 줄이기만 하니, 끝 자르기는 타자편에선 값을 바꾸지 않는다.
 *
 * 앞서 웹은 ① 부상·질병 중 하나만 ② 장비 보정 **전에** 곱하고 ③ 사기 감소가 없었다 — 셋 다 고쳤다.
 */
/**
 * **0xb6414(기록, k, 1)** — 장착 레벨 보너스와 스킬 보정까지, 부상·질병·사기는 빼고.
 * 0xb570c 를 거치지 않고 0xb6415 를 바로 읽는 곳이 이 값을 본다:
 *   이벤트 조건 20(스킬 획득, 0xa4488 · A-4) · 칭호 44·45(0x1ad1a·0x1ad9a) ·
 *   훈련/휴식/GP 결과 상세 창의 현재값(0x18cf6 · 0x18f7c · 0x14f42).
 * (`0xb6415(기록, k, 0)` 은 기본 능력치 — 훈련 "능력치 최대" 0x12ec0 · GP 상점 0x13874 가 본다.)
 *
 * 디스어셈 차례 (0xb6414~0xb653e):
 *   0. 마선수 배율 0xb63a0 — 육성 선수는 0xb633c 거짓이라 −1 → 건너뛴다.
 *      (타자일 때 레벨 칸 +5 를 더하는 0xb644c 도 이 갈래 안이라 육성 선수와 상관없다)
 *   1. 장비 니블 n ≥ 1 이면 0xd8890[n−1] 을 더하고 999 로 자른다 (0xb6494~0xb64a8, 바닥 없음)
 *   2. 스킬 5 장착 → −100, 0 아래면 0 (0xb64b0~0xb64c8) — 네 칸 모두
 *   3. 스킬 7 장착 → +50, 999 로 자른다 (0xb64ca~0xb64e4) — 네 칸 모두
 *   4. 냉정 22(제구 +10%) 는 `0xb6278`(투수인가) 참일 때만 → 타자 레코드엔 없다
 *   5. 스킬 20 장착 ∧ 칸 2(수비) → −100, 0 아래면 0 (0xb6512~0xb653c, `0xb6278` 거짓일 때만)
 * 장착 여부는 모두 0xb62b4 = 선수기록 +0x14 **장착** 비트 (H-modes 6절 "장착 칸").
 * 기본 능력치·장비 보너스가 0 이상이라 1 의 `clampAbility` 바닥은 값을 바꾸지 않는다.
 */
export function equippedAbilityOf(
  career: Pick<PlayerCareer, 'ability' | 'equipmentLevels' | 'equippedSkillIds'>,
): BatterAbility {
  const adjust = (key: keyof BatterAbility) => {
    let value = clampAbility(career.ability[key] + equipmentBonusOf(career.equipmentLevels[key]))
    if (isSkillEquipped(career, POWERLESS_SKILL)) value = clampAbility(value - SKILL_PENALTY)
    if (isSkillEquipped(career, LEGEND_SKILL)) value = clampAbility(value + LEGEND_BONUS)
    if (key === 'defense' && isSkillEquipped(career, DEFENSE_PENALTY_SKILL)) value = clampAbility(value - SKILL_PENALTY)
    return value
  }
  return { hit: adjust('hit'), power: adjust('power'), run: adjust('run'), defense: adjust('defense') }
}

/** 피로 없는 0xb570c — 0xb6414 → 질병 → 부상 → 사기 → 맨 끝 0..999 자르기 (0xb5b06) */
export function effectiveAbilityOf(career: PlayerCareer): BatterAbility {
  const moraleCut = MORALE_ABILITY_CUTS.find(([limit]) => career.morale <= limit)?.[1] ?? 0
  const equipped = equippedAbilityOf(career)
  const adjust = (key: keyof BatterAbility) => {
    let value = equipped[key]
    if (career.isSick) value = reduceByPercent(value, ILLNESS_ABILITY_CUT)
    if (career.isInjured) value = reduceByPercent(value, INJURY_ABILITY_CUT)
    if (moraleCut > 0) value = reduceByPercent(value, moraleCut)
    return clampAbility(value)
  }
  return { hit: adjust('hit'), power: adjust('power'), run: adjust('run'), defense: adjust('defense') }
}

/**
 * 훈련 부상 (0x1b4c4 — 훈련 결과 창을 닫을 때 한 번, 점검 12차).
 * 확률(%) = 훈련 뒤 사기 구간 표 (필살타법이면 오른쪽 열), 유리몸(4) +5 · 행운(6) −20, 0 미만은 0.
 * bfa55(0,10000) < 확률×100 이면 부상 — 기간 3 (+0x1b5·+0x1ce), 알림 문자열 0xcca24.
 * 경기 뒤에는 굴리지 않는다.
 */
const INJURY_CHANCE_BY_MORALE: readonly (readonly [number, number, number])[] = [
  [70, 0, 0],
  [50, 1, 3],
  [30, 3, 5],
  [10, 5, 8],
  [-Infinity, 10, 16],
]
const GLASS_BODY_SKILL = 4
const GLASS_BODY_BONUS = 5
const LUCK_SKILL = 6
const LUCK_REDUCTION = 20
const INJURY_ROLL_RANGE = 10_000

/**
 * 0x1b4c4 가 보는 칸 — 모드 갈림이 없어(상세 창 콜백 0x1d63c 를 두 모드가 같이 건다) 투수편 기록도 같은 칸이다.
 * 스킬 4·6 도 **비트 번호** 그대로 본다.
 */
export type TrainingInjuryCareer = Pick<PlayerCareer, 'morale' | 'isInjured' | 'injuryRemaining' | 'skillIds' | 'equippedSkillIds'>

export function trainingInjuryChanceOf(career: TrainingInjuryCareer, isSpecialSwing: boolean): number {
  const row = INJURY_CHANCE_BY_MORALE.find(([floor]) => career.morale > floor) ?? INJURY_CHANCE_BY_MORALE[4]
  let chance = isSpecialSwing ? row[2] : row[1]
  // 0x1b4c4: 유리몸은 보유(0xa3a74, 0x1b550) · 행운은 장착(0xa4bf8, 0x1b562)
  if (career.skillIds.includes(GLASS_BODY_SKILL)) chance += GLASS_BODY_BONUS
  if (isSkillEquipped(career, LUCK_SKILL)) chance -= LUCK_REDUCTION
  return Math.max(0, chance)
}

export function rollTrainingInjury<T extends TrainingInjuryCareer>(
  career: T,
  isSpecialSwing: boolean,
  random: RandomPort,
): { career: T; notice: string | null } {
  if (career.isInjured) return { career, notice: null }
  const roll = random.rand(0, INJURY_ROLL_RANGE)
  if (roll >= trainingInjuryChanceOf(career, isSpecialSwing) * 100) return { career, notice: null }
  return {
    career: { ...career, isInjured: true, injuryRemaining: INJURY_DURATION },
    notice: '부상을 당했습니다.',
  }
}
