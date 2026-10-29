import { useCallback } from 'react'
import { isInfiniteGamePointOn } from '@/shared/lib/dev/devOptions'
import { GAME_POINT_LIMIT } from '@/entities/season-mode/model/seasonRewards'
import { GAME_POINT_USAGE } from '@/entities/collection/model/annalsStats'
import type { SeasonScope } from '@/app/model/seasonSession/atoms/seasonScope'
import { ownGamePointsAtom } from '@/app/model/seasonSession/atoms/saveAtoms'

/**
 * 지금 들고 있는 G — **화면도 판정도 이 값 하나만 본다.**
 *
 * 지갑을 넘기면 `?무한G` 는 지갑 안에서 처리된다(`balance` 가 늘 99999 이고 쓰기는 안 먹는다).
 * 안 넘겼을 때만 예전처럼 여기서 보여 주는 값을 올린다 — 판정도 같은 값을 보므로
 * "99999 인데 G포인트 부족" 같은 어긋남은 어느 쪽에서도 나지 않는다.
 */
export function gamePointsOf(wallet: SeasonScope['wallet'], ownGamePoints: number): number {
  if (wallet !== null) return wallet.balance
  return isInfiniteGamePointOn() ? GAME_POINT_LIMIT : ownGamePoints
}

/** G 주머니 — 지갑을 넘겼으면 지갑, 아니면 세션 주머니(`ownGamePointsAtom`) */
export function useGamePointPurse({ atoms, wallet, recordStat }: SeasonScope) {
  /** G 보상을 쌓는다 (상한 99999 — 0xa3e4) */
  const gainGamePoint = useCallback(
    (amount: number) => {
      if (wallet !== null) return wallet.gain(amount)
      atoms.set(ownGamePointsAtom, (points) => Math.min(GAME_POINT_LIMIT, points + amount))
    },
    [atoms, wallet],
  )
  /**
   * G 를 치른다 (`spendGamePoint` 액션이자 안에서도 쓴다).
   * ⚠️ 지갑을 쓰면 **모자랄 때 한 푼도 안 깎인다**(0xa46e) — 세션 주머니 때의 0 으로 자르기와
   *    다르지만, 화면이 값을 먼저 막으니 닿지 않는 갈래다.
   */
  const spendGamePoint = useCallback(
    (cost: number) => {
      // 시즌이 G 를 쓰는 자리 셋 — 트레이드 0xd152 · 지옥훈련 0xa2fee(500) · 자동진행 0x3c862(모드 2 → k 3, |값|) —
      // 모두 G 를 뺀 뒤 `0x22c29(mgr, 3, 액수)` 로 시즌 소모 GP 에 적는다. 시즌 GP 아이템(0x8058)·십전대보탕(0x7cd8)도 여기로 온다
      recordStat?.({ kind: 'G사용', usage: GAME_POINT_USAGE.season, amount: Math.abs(cost) })
      if (wallet !== null) return wallet.spend(cost)
      atoms.set(ownGamePointsAtom, (points) => Math.max(0, points - cost))
    },
    [atoms, recordStat, wallet],
  )
  return { gainGamePoint, spendGamePoint }
}
