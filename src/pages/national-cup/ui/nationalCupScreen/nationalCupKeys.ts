import type { NationalCupMode } from '@/entities/national-cup/model/nationalCupFlow'

/** 키가 하는 일 — 대진 확인 · 경기 시작(142 · 0xdd) · 대진으로(시즌 0xf4 의 CLR) */
export type NationalCupKeyAction = '대진확인' | '경기시작' | '대진으로'

const isOkKey = (key: string) => key === 'Enter' || key === '5'

/**
 * **키 길** (직접 떴다) — 대진 키 0xf3 `0xe6f8` · 134 `0x19fdc` 와 순위 키 135 `0x10680` 은 [this+0x40] 이 OK(−5) 또는 '5'(0x35)
 * 일 때만 움직이고, 시즌 순위 0xf4 `0x4a18` 만 그 밖에 CLR(−16) → 0xf3(대진)이 있다. 그 밖의 키는 아무 일이 없다.
 * 팝업(히든 팀 · 칭호 · 결과 · 보상)이 떠 있는 동안은 창이 키를 먹는다(0x754f9) — 대진판 확인도 팝업이 다 닫힌 뒤다.
 */
export function nationalCupKeyActionOf(
  key: string,
  step: string,
  hasEntryPopup: boolean,
  hasMatchup: boolean,
  mode: NationalCupMode,
): NationalCupKeyAction | null {
  if (step === '대진' && !hasEntryPopup) return isOkKey(key) ? '대진확인' : null
  if (step !== '순위' || !hasMatchup) return null
  return standingsKeyActionOf(key, mode)
}

/** 순위(135 · 0xf4) 키 — OK 는 경기 시작, 시즌모드만 CLR 이 대진으로 */
function standingsKeyActionOf(key: string, mode: NationalCupMode): NationalCupKeyAction | null {
  if (isOkKey(key)) return '경기시작'
  return key === 'Escape' && mode === '시즌모드' ? '대진으로' : null
}

/** 대진판이 그릴 대회 — 대진 · 순위 단계는 받은 대회, 확인 뒤(결과 · 보상 · 끝)는 동전 던지기를 거친 대회 */
export function shownCupOf<T>(step: string, cup: T, resolved: T): T {
  return step === '대진' || step === '순위' ? cup : resolved
}
