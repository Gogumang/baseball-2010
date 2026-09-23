import { useCallback, useEffect, useState } from 'react'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import {
  GAME_POINT_LIMIT,
  addGamePoint,
  canAffordGamePoint,
  clampGamePoint,
  migrateWallet,
  spendGamePoint,
} from '@/entities/wallet/model/gamePointWallet'
import type { GamePointWallet } from '@/entities/wallet/model/gamePointWallet'
import { isInfiniteGamePointOn } from '@/shared/lib/dev/devOptions'

export interface GamePointWalletSession {
  /** 지금 들고 있는 G — **화면도 판정도 이 값 하나만 본다** */
  readonly balance: number
  /** 보상을 쌓는다 (상한 99999). 음수를 주면 깎인다 */
  readonly gain: (amount: number) => void
  /** 값을 치른다. 모자라면 한 푼도 안 깎인다 (0xa46e) */
  readonly spend: (price: number) => void
  /** 값을 통째로 맞춘다 — 커리어 쪽에서 넘어온 값을 받을 때 쓴다 */
  readonly setBalance: (value: number) => void
  /** 살 수 있나 (가격과 같으면 산다) */
  readonly canAfford: (price: number) => boolean
}

/**
 * 전역 G 지갑 고리 — 원본 `mgr[+0x64]` 한 칸을 저장소 하나에 담는다.
 *
 * ⚠️ **옛 세이브 이사**: 지갑 칸이 아직 없으면 `legacyGamePoint`(옛 `career.gamePoint`)를 그대로
 *    옮겨 온 뒤 곧바로 저장한다 — 다음부터는 지갑 칸이 있으니 두 번 옮기지 않는다.
 *
 * ⚠️ **`?무한G` 스위치**: 켜져 있으면 `balance` 가 늘 99999 이고 **쓰기는 아무 일도 안 한다.**
 *    화면(`ScreenFrame`·`StatusBar`)도 판정(상점·마선수 오픈)도 같은 `balance` 를 보니
 *    "99999 인데 G포인트 부족" 같은 어긋남이 나올 자리가 없다. 저장에 손대지 않으므로 스위치를
 *    끄면 원래 값이 그대로 돌아온다.
 */
export function useGamePointWallet(store: JsonStorePort, legacyGamePoint: number | null = null): GamePointWalletSession {
  const [wallet, setWallet] = useState<GamePointWallet>(() => migrateWallet(store.load(), legacyGamePoint))

  useEffect(() => {
    store.save(wallet)
  }, [wallet, store])

  const isInfinite = isInfiniteGamePointOn()
  const balance = isInfinite ? GAME_POINT_LIMIT : wallet.gamePoint

  const gain = useCallback(
    (amount: number) => {
      if (isInfinite) return
      setWallet((current) => addGamePoint(current, amount))
    },
    [isInfinite],
  )

  const spend = useCallback(
    (price: number) => {
      if (isInfinite) return
      setWallet((current) => spendGamePoint(current, price))
    },
    [isInfinite],
  )

  const setBalance = useCallback(
    (value: number) => {
      if (isInfinite) return
      setWallet((current) => (current.gamePoint === clampGamePoint(value) ? current : { gamePoint: clampGamePoint(value) }))
    },
    [isInfinite],
  )

  const canAfford = useCallback((price: number) => canAffordGamePoint({ gamePoint: balance }, price), [balance])

  return { balance, gain, spend, setBalance, canAfford }
}
