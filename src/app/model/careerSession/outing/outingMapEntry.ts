import type { Screen } from '@/app/model/screen'

/**
 * 웹 화면 바뀜이 원본 112 진입(0x118e4)인가 — `useOutingSlots` 머리말. 장소 이벤트에서 돌아온 '외출' 은 113 이라 아니다.
 */
export function isOutingMapEntry(previous: Screen | null, next: Screen): boolean {
  if (next.kind === '이벤트') return next.context === '외출진입' || next.context === '대결결과'
  if (next.kind !== '외출') return false
  if (previous === null) return true
  if (previous.kind === '외출') return false
  return !(previous.kind === '이벤트' && previous.context === '장소')
}

/** 112 진입(0x118e4) 셈 — 화면이 바뀐 그림마다 그 길이 112 진입이면 하나 오른다(첫 그림도 본다, `isOutingMapEntry`) */
export function advanceOutingMapEntries(previous: { readonly screen: Screen; readonly count: number } | null, screen: Screen) {
  if (previous === null) return { screen, count: isOutingMapEntry(null, screen) ? 1 : 0 }
  if (previous.screen === screen) return previous
  return { screen, count: previous.count + (isOutingMapEntry(previous.screen, screen) ? 1 : 0) }
}
