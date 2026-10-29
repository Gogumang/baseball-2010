import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'

/**
 * **포구 관문 — 플레이 vt50 = 0xb2ac8** (직접 뜬 것): b2aca +0x12c(쥠) · b2ad8 +0x111(홈런 · 사건 8) · b2ae2 +0x124(바운드 담장 넘김 ·
 * 사건 10) · b2aec +0x129(폴 홈런 · 사건 12) · b2af6 +0x110(파울 · 사건 7) 가 모두 0 일 때만 1. 하나라도 서면 플레이 틱 b4072 가
 * b42ce 로 포구 틱 갈래를 통째로 건너뛴다. 슬롯 2 머리의 필살 포구 연출(0d 절 0xb4c9c)도 같은 관문을 본다 —
 * 그 사이 다섯 칸을 바꾸는 줄이 없어 두 자리의 값이 같다.
 */
export function isCatchGateOpen(s: DefensePlayState): boolean {
  return !s.play.held && !s.homeRunFlag && !s.groundRuleFlag && !s.play.suppressed && !s.foulFlag
}
