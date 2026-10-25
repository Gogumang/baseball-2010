import * as React from 'react'

/**
 * **마운드 때 한 번만 도는 초기화** (웹 전용 — 원본에 없다). `useState(() => mountOnce('키', () => …))` 꼴로 쓴다.
 *
 * 경기 장면을 세우는 고리(`useTeamGame` · `usePitcherGame` · `useGeneralMode`)는 원본이 장면 진입에서 굴리는 난수(로딩 팁 ·
 * 덱 1275 · 빠른실행 · 0x30f20 …)를 `useState` 초기화 함수 안에서 굴린다. 배포 빌드는 마운트마다 한 번 부르지만, 개발의
 * `StrictMode`(`app/main.tsx`)는 마운트 그림을 두 번 그려 초기화 함수를 **두 번** 부른다 — 난수가 한 차례 더 나가 같은 씨앗의
 * 개발 · 배포 경기가 갈렸다(r231: 일반모드 씨앗 1 · 2 의 선공이 뒤집혔다).
 *
 * 개발에서는 그 두 번째 그림이 **첫 그림이 낸 값을 그대로** 받는다 — 난수 · 소리 끊기 · 플레이 시계 같은 곁일이 한 번만 난다.
 * 두 그림은 같은 파이버(React 내부 `ReactCurrentOwner`)로 그려지므로 파이버 + 키로 묶는다. 새로 마운트하면 새 파이버라 다시 부른다.
 * 배포 빌드는 그림을 두 번 그리지 않으므로 그냥 부른다 — 배포의 난수 차례는 이 도우미가 없을 때와 같다.
 *
 * ⚠️ React 내부 칸을 읽는다(18.x). 못 찾으면 그냥 부른다 — 그러면 개발에서 다시 두 번 굴린다(`strictMount.test.tsx` 가 잡는다).
 */
export function mountOnce<T>(key: string, init: () => T): T {
  if (!import.meta.env.DEV) return init()
  const owner = renderingFiber()
  if (owner === null) return init()
  let slots = heldByFiber.get(owner)
  const held = slots?.get(key)
  if (held !== undefined) {
    // StrictMode 의 두 번째 그림 — 첫 그림의 값을 받고 칸을 비운다
    slots?.delete(key)
    return held.value as T
  }
  const value = init()
  if (slots === undefined) {
    slots = new Map()
    heldByFiber.set(owner, slots)
  }
  slots.set(key, { value })
  return value
}

/** 마운트 첫 그림이 낸 값 — 파이버마다 키별로 (두 번째 그림이 받아 간다) */
const heldByFiber = new WeakMap<object, Map<string, { readonly value: unknown }>>()

interface ReactOwnerInternals {
  readonly ReactCurrentOwner?: { readonly current: unknown }
}

/** 지금 그리는 컴포넌트의 파이버 (개발 빌드 React 18 이 그리는 동안 채운다) — 없으면 null */
function renderingFiber(): object | null {
  const namespace = React as unknown as Record<string, unknown> & { readonly default?: Record<string, unknown> }
  const internals = (namespace.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
    ?? namespace.default?.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED) as ReactOwnerInternals | undefined
  const owner = internals?.ReactCurrentOwner?.current
  return typeof owner === 'object' && owner !== null ? owner : null
}
