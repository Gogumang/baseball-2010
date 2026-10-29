import { isBugFixed } from '@/shared/config/bugfixes'
import { ORIGINAL_SKILLS } from '@/shared/config/original/skills'
import { BATTER_MODE, type RewardNoticeMode } from '@/entities/story/model/rewardNotice/types'

/** 연봉 변동 (0x8c304~0x8c374) — 값 → 새 연봉. 값 0 은 ×30 ÷ 100, 그 밖은 몫(버림)을 더하거나 뺀다. 표에 없는 값은 그대로 */
const SALARY_CHANGES: Readonly<Record<number, (base: number) => number>> = {
  0: (base) => base + Math.trunc((base * 30) / 100),
  1: (base) => base + Math.trunc(base / 5),
  4: (base) => base + Math.trunc(base / 5),
  2: (base) => base + Math.trunc(base / 10),
  5: (base) => base + Math.trunc(base / 10),
  3: (base) => base - Math.trunc(base / 5),
  6: (base) => base + Math.trunc(base / 20),
  7: (base) => base - Math.trunc(base / 10),
}

export function salaryAfter(base: number, code: number): number {
  return SALARY_CHANGES[code]?.(base) ?? base
}

/** 1억 = 10000 (만원 단위) */
const HUNDRED_MILLION = 10_000

/** 0x55cf4 — 9999 이하 "%d", 1억 이상 "%d억" · "%d억%03d" (만원 단위, "만" 없음 — `features/shop` 의 `formatOriginalMoney` 와 같은 식) */
export function originalMoneyText(amount: number): string {
  if (amount < HUNDRED_MILLION) return String(amount)
  const head = Math.trunc(amount / HUNDRED_MILLION)
  const rest = amount % HUNDRED_MILLION
  if (rest === 0) return `${head}억`
  // B-99 고친 길 — 나머지는 만 단위 네 자리라 "%04d" 로 채운다(1억 50만 → "1억0050", 원본 "1억050"). 굴림 없음
  return `${head}억${String(rest).padStart(isBugFixed('B-99') ? 4 : 3, '0')}`
}

/** 0x8457c 의 투수편 스킬 이름 칸 밀기 — 71 + s (= 55 + s + 16) */
const PITCHER_SKILL_NAME_OFFSET = 16
/** 0x8457c — 스킬 s ≤ 7 이면 이 칸까지는 두 편이 같은 이름 */
const SHARED_SKILL_LAST = 7

/** 0x8457c — 스킬 s ≤ 7 이면 StrCOMMON[55 + s], 그 밖 모드 4 면 55 + s · 아니면 71 + s */
export function skillNameOf(skill: number, mode: RewardNoticeMode): string {
  const index = skill <= SHARED_SKILL_LAST || mode === BATTER_MODE ? skill : skill + PITCHER_SKILL_NAME_OFFSET
  return ORIGINAL_SKILLS[index]?.name ?? ''
}

export const sprintf = (format: string, value: string | number) => format.replace(/%[ds]/, String(value))
