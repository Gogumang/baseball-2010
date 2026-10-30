import type { ScreenPushDirection } from '@/pages/management/lib/nariScreenPush'

/**
 * **일반모드 준비의 화면 밀기** — 효과기 종류 8 `0xbdae9([0x140007c], 8, 0, 방향, 1000)` (나리 142 ↔ 143 과 같은 효과기, 직접 떴다):
 * ```
 * 18 키 0x29b38 OK          → 방향 3 (29d2a) → 19
 * 19 키 0x29c98 CLR         → 방향 4 (29c34) → 18
 * 22 키 0x311a8 '4' · ←     → [메뉴+0xec] = 1(유저 팀) · 방향 4 (313e4) → 23
 *              '6' · →     → [메뉴+0xec] = 0(CPU 팀) · 방향 3 (313fe) → 23
 * 23 키 0x2a370 나감         → [메뉴+0xec] ≠ 0 ? 3 : 4 (2a46a~2a476) → 22
 * ```
 * 3 · 4 는 가로 밀기라 굴림이 없다(방향 5 만 0x9d468 을 굴린다). 그 밖의 바뀜(19 → 20 · 22 → 경기 …)은 밀지 않는다.
 * 밀기 동안 키는 메인 메뉴 장면 키 누름 0x246d8 이 버린다(`NariScreenPush` 의 문과 같다).
 */
export type GeneralPrepPushView = '18' | '19' | '22' | '23:유저' | '23:CPU' | '그밖'

/** `바뀌기 전 → 바뀐 뒤` 화면 → 밀기 방향 (위 표 그대로) */
const PUSH_DIRECTIONS: ReadonlyMap<string, ScreenPushDirection> = new Map([
  ['18→19', 3],
  ['19→18', 4],
  ['22→23:유저', 4],
  ['22→23:CPU', 3],
  ['23:유저→22', 3],
  ['23:CPU→22', 4],
])

export function generalPrepPushDirectionOf(from: GeneralPrepPushView, to: GeneralPrepPushView): ScreenPushDirection | null {
  return PUSH_DIRECTIONS.get(`${from}→${to}`) ?? null
}
