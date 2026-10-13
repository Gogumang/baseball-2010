/**
 * 웹판 **테스트용 스위치**. 원본에는 없는 것이다.
 *
 * ⚠️ **무한G 는 기본으로 켜져 있다** (사용자 요청 2026-10-11 "기본적으로 g 포인트는 99999 있게") — 시험(vitest)에서만 기본이 꺼짐.
 * 끄는 법: 주소에 `?원본G` 또는 `?real-gp`, 또는 `localStorage.setItem('compus-baseball/dev', '원본G')`.
 *
 * 켜는 법 (기본값이 꺼진 시험 환경 등에서, 둘 중 아무거나):
 *   1. 주소에 물음표 — `?무한G` 또는 `?infinite-gp`
 *   2. 콘솔에서 `localStorage.setItem('compus-baseball/dev', '무한G')`
 *
 * ⚠️ 이 스위치는 **보여 주는 값만** 바꾼다. 저장에는 손대지 않으므로 끄면 원래 값으로 돌아온다.
 */

const STORAGE_KEY = 'compus-baseball/dev'
/** 주소·저장에서 찾는 이름 (둘 다 받는다) */
const INFINITE_GAME_POINT_KEYS = ['무한G', 'infinite-gp'] as const
/** 무한G 를 끄는 이름 (켜는 이름보다 앞선다) */
const REAL_GAME_POINT_KEYS = ['원본G', 'real-gp'] as const
/** 무한G 기본값 — 앱은 켜고, 시험은 원본대로 끈다 */
const IS_INFINITE_GAME_POINT_DEFAULT = (import.meta as { readonly env?: { readonly MODE?: string } }).env?.MODE !== 'test'

function readFlags(): ReadonlySet<string> {
  const flags = new Set<string>()
  try {
    const query = new URLSearchParams(window.location.search)
    for (const [key] of query) flags.add(key)
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved !== null) for (const name of saved.split(',')) flags.add(name.trim())
  } catch {
    // 주소·저장을 못 읽는 환경(테스트·비공개 창)에서는 스위치가 꺼진 것으로 본다
  }
  return flags
}

/** G포인트를 무한으로 볼 것인가 — 값 검사(훈련·지옥훈련·자동진행·상점)가 전부 통과한다 */
export function isInfiniteGamePointOn(): boolean {
  const flags = readFlags()
  if (REAL_GAME_POINT_KEYS.some((key) => flags.has(key))) return false
  return IS_INFINITE_GAME_POINT_DEFAULT || INFINITE_GAME_POINT_KEYS.some((key) => flags.has(key))
}
