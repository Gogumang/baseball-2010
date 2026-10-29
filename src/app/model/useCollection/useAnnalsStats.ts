import type { Collection } from '@/entities/collection/model/collection'
import { useCallback } from 'react'
import { applyAnnalsStat, earnedGamePointHiddenIdOf, playTimeHiddenIdOf } from '@/entities/collection/model/annalsStats'
import type { AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import {
  collectionRewardGamePointOf,
  collectionRewardStatModeOf,
  collectionRewardTextOf,
  judgeCollectionReward,
  normalizeCollectionRewardRecord,
  withAwardedBit,
} from '@/entities/collection/model/collectionRewards'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { CollectionRewardWallet } from '@/app/model/useCollection/collectionTypes'

type SetCollection = Dispatch<SetStateAction<Collection>>

interface AnnalsStatsInput {
  /** 통계의 지금 값 — 한 틀에 사건이 여럿 와도 문턱을 더한 뒤 값으로 본다 */
  readonly statsRef: MutableRefObject<Collection['stats']>
  readonly collectionRef: MutableRefObject<Collection>
  readonly setCollection: SetCollection
  readonly openHidden: (id: number, then?: (() => void) | null) => boolean
}

/** 기록연감 통계 `[mgr+0xc8]` 쌓기 · 읽기 · 전부 수집 보상 */
export function useAnnalsStats({ statsRef, collectionRef, setCollection, openHidden }: AnnalsStatsInput) {
  const readStats = useCallback(() => statsRef.current, [statsRef])

  /** 통계 기록 `[mgr+0xc8]` 에 한 건 쌓는다 (0x22e35 · 0x22c29 · 0xb663c) — 원본도 곧바로 저장(0x1f1e1)한다 */
  const recordStat = useCallback(
    (event: AnnalsStatEvent) => {
      setCollection((previous) => ({ ...previous, stats: applyAnnalsStat(previous.stats, event) }))
      statsRef.current = applyAnnalsStat(statsRef.current, event)
      if (event.kind === '기록달성') {
        // 정산 0x4ea0c 4eca0~4ecda — 0x22c7d · 0x22e10(이 사건) · 0x1f1e1 바로 뒤 획득 GP 일곱 칸 합 > 99998 이면 히든 33.
        // 이 사건은 정산(모드 5 · 6 제외) 자리에서만 난다
        const earnedId = earnedGamePointHiddenIdOf(statsRef.current)
        if (earnedId !== null) openHidden(earnedId)
        return
      }
      if (event.kind !== '플레이시간') return
      // 0x4e8b0 끝 — 모드 3 · 4 의 그 칸이 10시간을 넘으면 0x62368(ui, 31 · 47, 0) — 열기 + 알림 창. 문턱은 더한 뒤 값으로 본다
      const hiddenId = playTimeHiddenIdOf(statsRef.current, event.mode)
      if (hiddenId !== null) openHidden(hiddenId)
    },
    [openHidden, setCollection, statsRef],
  )

  /**
   * **전부 수집 보상** — 메인 메뉴 하위 4 갱신 0x29454 가 그 상태 열 번째 갱신([this+0x2c] == 10)에서 부른다:
   * ```
   * k = 0x28e98(this)            ; 판정 — 맞으면 그 자리에서 0x22dd5(mgr, k) 달성 표시 · 통계 저장 0x1f1e1
   * k ≥ 0: 0x292f8(this, k)      ; 팝업 [180+k]+[188] · 비트 k 0x9f709 · G += 0xcebd4[k]×1000 (0~99999) · 저장 0x1f1b9
   *                               ;   · 0x22c7d(mgr, 보상, 모드) · 통계 저장
   *        [this+0x2c] = 9       ; 다음 갱신이 다시 10 이라 또 판정한다 — 받을 것이 여럿이면 하나씩 이어 뜬다
   * ```
   * 지급 비트는 시즌 세션과 같이 쓰는 저장 칸(`rewardStore`)에서 바로 읽고 바로 쓴다. 줄 것이 없으면 null, 있으면 팝업 글.
   */
  const claimCollectionReward = useCallback(
    (rewardStore: JsonStorePort, isEveryMissionCleared: boolean, wallet: CollectionRewardWallet): string | null => {
      const current = collectionRef.current
      const record = normalizeCollectionRewardRecord(rewardStore.load())
      const kind = judgeCollectionReward({
        record,
        isEveryMissionCleared,
        stats: current.stats,
        titles: current.titles,
        endings: current.endings,
        seasonEndings: current.seasonEndings,
      })
      if (kind < 0) return null
      const amount = collectionRewardGamePointOf(kind)
      // 판정 쪽 0x22dd5 → 팝업 쪽 0x22c7d 차례 그대로 쌓는다 (다음 판정은 이 두 칸을 안 본다)
      setCollection((previous) => ({
        ...previous,
        stats: applyAnnalsStat(applyAnnalsStat(previous.stats, { kind: '달성표시', index: kind }), {
          kind: 'G획득',
          mode: collectionRewardStatModeOf(kind),
          amount,
        }),
      }))
      rewardStore.save(withAwardedBit(record, kind))
      wallet.gain(amount)
      return collectionRewardTextOf(kind)
    },
    [collectionRef, setCollection],
  )

  return { readStats, recordStat, claimCollectionReward }
}
