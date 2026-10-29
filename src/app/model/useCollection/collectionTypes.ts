import type { Collection } from '@/entities/collection/model/collection'

/** 등록 비용을 치르는 전역 G 지갑 `mgr[+0x64]` 의 두 칸 */
export interface HallOfFameWallet {
  readonly balance: number
  readonly spend: (price: number) => void
}

/** 전부 수집 보상이 G 를 넣는 전역 지갑 `mgr[+0x64]` — `gain` 이 0~99999 로 자른다(0x293a2~0x293b6 과 같다) */
export interface CollectionRewardWallet {
  readonly gain: (amount: number) => void
}

/**
 * 히든 오픈 id 를 전역 표에 더한다 — 이미 다 있으면 같은 객체를 돌려줘 저장·렌더를 되풀이하지 않는다.
 * 원본 해금표는 모드와 상관없는 전역 `app+0xc0`(0x9f69c / 0x62368) 하나다.
 */
export function mergeOpenedHiddenIds(collection: Collection, openedHiddenIds: readonly number[]): Collection {
  const missing = openedHiddenIds.filter((id, index) => !collection.openedHiddenIds.includes(id) && openedHiddenIds.indexOf(id) === index)
  return missing.length === 0 ? collection : { ...collection, openedHiddenIds: [...collection.openedHiddenIds, ...missing] }
}
