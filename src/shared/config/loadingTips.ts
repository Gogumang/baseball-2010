import { ORIGINAL_TIPS } from '@/shared/config/original/tips'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 원본 StrTIP 은 첫 항목에 팁 개수("73")를 담고 그 뒤에 팁이 온다. */
export const LOADING_TIPS: readonly string[] = ORIGINAL_TIPS.slice(1, 1 + Number(ORIGINAL_TIPS[0]))

export function pickLoadingTip(random: RandomPort): string {
  return random.pick(LOADING_TIPS)
}
