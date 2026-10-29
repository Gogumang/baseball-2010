import type { Collection } from '@/entities/collection/model/collection'
import { useCallback } from 'react'
import {
  registerHallOfFame,
  registerHallOfFamePitcher,
  deleteHallOfFame,
  syncHallOfFameEquipment,
  withHallOfFameRecordSlot,
  HALL_OF_FAME_COST,
} from '@/entities/collection/model/collection'
import type { HallOfFameResult, HallOfFameSide } from '@/entities/collection/model/collection'
import { applyAnnalsStat, GAME_POINT_USAGE } from '@/entities/collection/model/annalsStats'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { Dispatch, SetStateAction } from 'react'
import type { HallOfFameWallet } from '@/app/model/useCollection/collectionTypes'

type SetCollection = Dispatch<SetStateAction<Collection>>

/** 명예의 전당 칸 고치기 — 등록(G 지갑 · 통계) · 삭제 · 시즌 장비 니블 · 시즌 영입 자리 */
export function useHallOfFameEdits(collection: Collection, setCollection: SetCollection) {
  /**
   * 명예의 전당 등록 (0x62cea~0x62e4e) — 칸을 채우고, G 20000 을 지갑에서 빼고, 통계 0x22c29(모드 4 ? 1 : 2, 20000) 을 적는다.
   * `slot` 은 등록 목록에서 고른 빈 칸(없으면 첫 빈 칸, 0x62514).
   */
  const commitRegistration = (result: HallOfFameResult, wallet: HallOfFameWallet, usage: number) => {
    if (result.kind !== '등록') return result.kind
    setCollection({ ...result.collection, stats: applyAnnalsStat(result.collection.stats, { kind: 'G사용', usage, amount: HALL_OF_FAME_COST }) })
    wallet.spend(HALL_OF_FAME_COST)
    return result.kind
  }
  const register = (target: PlayerCareer, wallet: HallOfFameWallet, slot: number | null = null) =>
    commitRegistration(registerHallOfFame(collection, target, wallet.balance, slot), wallet, GAME_POINT_USAGE.batterLeague)
  const registerPitcher = (target: PitcherCareer, wallet: HallOfFameWallet, slot: number | null = null) =>
    commitRegistration(registerHallOfFamePitcher(collection, target, wallet.balance, slot), wallet, GAME_POINT_USAGE.pitcherLeague)

  /**
   * 명전 칸 삭제 (0x62994 → 0x22371 투수 · 0x22339 타자) — 칸을 비운다. 저장(0x1f1b9)은 위 저장 효과가 한다.
   * 시즌 명단 정리(0x221dc)는 시즌 세션 몫이라 부르는 쪽이 같이 부른다.
   */
  const deleteHallOfFamer = useCallback(
    (side: HallOfFameSide, slot: number) => {
      setCollection((previous) => deleteHallOfFame(previous, side, slot))
    },
    [setCollection],
  )

  /** 시즌 장비 창 0x7d90 → 0x2328c — 명예 선수가 산 장비 니블을 명전 기록에도 (`syncHallOfFameEquipment`) */
  const syncSeasonHallOfFameEquipment = useCallback(
    (side: HallOfFameSide, recordId: number, nibbles: readonly number[]) => {
      setCollection((previous) => syncHallOfFameEquipment(previous, side, recordId, nibbles))
    },
    [setCollection],
  )

  /** 시즌 영입 0xc554 c578 `0xb6605(명전 기록, j)` — 영입한 명전 선수 기록의 +0xa 아랫 5비트를 고른 자리로 (`withHallOfFameRecordSlot`) */
  const syncSeasonHallOfFameRecruit = useCallback(
    (side: HallOfFameSide, recordId: number, recordSlot: number) => {
      setCollection((previous) => withHallOfFameRecordSlot(previous, side, recordId, recordSlot))
    },
    [setCollection],
  )

  return { register, registerPitcher, deleteHallOfFamer, syncSeasonHallOfFameEquipment, syncSeasonHallOfFameRecruit }
}
