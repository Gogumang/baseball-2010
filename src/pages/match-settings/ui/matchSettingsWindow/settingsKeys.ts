import type { MatchSettingsKey } from '@/pages/match-settings/lib/matchSettingsMenu'

/**
 * 키보드 → 원본 키. 키 함수 0x5ffcc 는 단계마다 숫자키를 화살표와 같은 갈래로 받는다 (r333): 종류 '2' · '8' · '5'(60020~60030) ·
 * 찬스 '4' · '6' · '5'(60094~600a4) · 이닝 '2' · '8' · '5'(600d8~600e8) · 상세 '2' '8' '4' '6' '5'(60180~60198).
 * 단계가 안 보는 방향은 화살표와 같이 버린다(`matchSettingsMenu`).
 */
const KEYS = new Map<string, MatchSettingsKey>([
  ['ArrowUp', '위'],
  ['2', '위'],
  ['ArrowDown', '아래'],
  ['8', '아래'],
  ['ArrowLeft', '왼쪽'],
  ['4', '왼쪽'],
  ['ArrowRight', '오른쪽'],
  ['6', '오른쪽'],
  ['Enter', '확인'],
  [' ', '확인'],
  ['5', '확인'],
  ['Escape', '취소'],
  ['Backspace', '취소'],
])

export function keyOf(key: string): MatchSettingsKey | null {
  return KEYS.get(key) ?? null
}
