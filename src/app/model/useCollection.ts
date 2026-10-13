import { useCallback, useEffect, useRef, useState } from 'react'
import {
  mergeCareerIntoCollection,
  mergeEndingIntoCollection,
  mergeSeasonEndingIntoCollection,
  mergeTitlesIntoCollection,
  normalizeCollection,
  registerHallOfFame,
  registerHallOfFamePitcher,
  deleteHallOfFame,
  syncHallOfFameEquipment,
  HALL_OF_FAME_COST,
  countSeasonRegularWin,
} from '@/entities/collection/model/collection'
import type { Collection, EndingViewer, HallOfFameResult, HallOfFameSide } from '@/entities/collection/model/collection'
import {
  applyAnnalsStat, earnedGamePointHiddenIdOf, GAME_POINT_USAGE, playTimeHiddenIdOf,
} from '@/entities/collection/model/annalsStats'
import { hiddenOpenStoredIdOf } from '@/entities/collection/model/hiddenOpenNotice'
import type { AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { equippedPitcherAbilityOf } from '@/entities/pitcher-career/model/pitcherCareer'
import { equippedAbilityOf } from '@/entities/career/model/condition'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import {
  collectionRewardGamePointOf, collectionRewardStatModeOf, collectionRewardTextOf, judgeCollectionReward,
  normalizeCollectionRewardRecord, withAwardedBit,
} from '@/entities/collection/model/collectionRewards'

const NO_IDS: readonly number[] = []
const NO_ANNOUNCE = () => {}

/** 등록 비용을 치르는 전역 G 지갑 `mgr[+0x64]` 의 두 칸 */
export interface HallOfFameWallet {
  readonly balance: number
  readonly spend: (price: number) => void
}
const NO_EVENTS: readonly string[] = []
const NO_TITLES: readonly string[] = []

/** 전부 수집 보상이 G 를 넣는 전역 지갑 `mgr[+0x64]` — `gain` 이 0~99999 로 자른다(0x293a2~0x293b6 과 같다) */
export interface CollectionRewardWallet {
  readonly gain: (amount: number) => void
}

/**
 * 히든 오픈 id 를 전역 표에 더한다 — 이미 다 있으면 같은 객체를 돌려줘 저장·렌더를 되풀이하지 않는다.
 * 원본 해금표는 모드와 상관없는 전역 `app+0xc0`(0x9f69c / 0x62368) 하나다.
 */
export function mergeOpenedHiddenIds(collection: Collection, openedHiddenIds: readonly number[]): Collection {
  const missing = openedHiddenIds.filter(
    (id, index) => !collection.openedHiddenIds.includes(id) && openedHiddenIds.indexOf(id) === index,
  )
  return missing.length === 0 ? collection : { ...collection, openedHiddenIds: [...collection.openedHiddenIds, ...missing] }
}

/**
 * 기록연감·명예의 전당. 선수가 얻는 닉네임·스킬·엔딩을 계속 모은다.
 *
 * `pitcherOpenedHiddenIds` — 나리 **투수편** 커리어가 연 히든 id. 투수 장비 컬렉터(0xa5020 → 0x62368,
 * id 20·24·28·32)는 원본에서 타자편과 같은 전역 표 `app+0xc0` 에 켜진다(d15c14d). 웹 투수 커리어는 제
 * `openedHiddenIds` 에만 남겨 왔으니 여기서 기록연감으로 모은다. 투수편 칭호·스킬은 타자편과 번호가 달라
 * 여기에 섞지 않는다.
 *
 * `pitcherEnding` — 투수편 커리어의 엔딩. 엔딩 적재 0x87c7c 는 두 편 공용이라 투수편 엔딩(연애 엔딩 포함)도
 * 기록연감 엔딩 칸에 켠다.
 */
export function useCollection(
  store: JsonStorePort,
  career: PlayerCareer | null,
  pitcherOpenedHiddenIds: readonly number[] = NO_IDS,
  pitcherEnding: EndingViewer | null = null,
  pitcherTitleIds: readonly string[] = NO_TITLES,
  seasonEndingIndex: number | null = null,
  /**
   * 공용 창에 히든 오픈 알림을 띄운다 (0x62368 → 0x74ef5) — 새로 연 k 만 온다. `then` 은 그 창을 닫은 뒤 할 일
   * (원본 장면이 창 꼬리표로 다음 상태를 고르는 자리)
   */
  announceHiddenOpen: (ids: readonly number[], then?: (() => void) | null) => void = NO_ANNOUNCE,
) {
  const [collection, setCollection] = useState<Collection>(() => normalizeCollection(store.load()))
  /** 판정이 읽는 지금 값 — 팝업을 닫고 곧바로 다시 판정할 때 렌더를 기다리지 않는다 */
  const collectionRef = useRef(collection)
  collectionRef.current = collection
  /** 통계의 지금 값 — 한 틀에 사건이 여럿 와도 문턱을 더한 뒤 값으로 본다 */
  const statsRef = useRef(collection.stats)
  statsRef.current = collection.stats
  const announceRef = useRef(announceHiddenOpen)
  announceRef.current = announceHiddenOpen
  /** 이번 렌더 전에 이미 연 k — 같은 틀에 두 번 불려도 창을 한 번만 띄운다 */
  const openingRef = useRef<Set<number>>(new Set())

  // 투수편 칭호 — 0xa40e0 이 투수편 기록연감 비트(+0xec)에 켠다
  useEffect(() => {
    setCollection((previous) => mergeTitlesIntoCollection(previous, pitcherTitleIds))
  }, [pitcherTitleIds])

  // 시즌 엔딩 — 새 해 0x6e0c 가 엔딩으로 갈 때 전역기록 +0xa0+e = 1
  useEffect(() => {
    setCollection((previous) => mergeSeasonEndingIntoCollection(previous, seasonEndingIndex))
  }, [seasonEndingIndex])

  useEffect(() => {
    if (career === null) return
    setCollection((previous) => mergeCareerIntoCollection(previous, career))
  }, [career])

  useEffect(() => {
    setCollection((previous) => mergeOpenedHiddenIds(previous, pitcherOpenedHiddenIds))
  }, [pitcherOpenedHiddenIds])

  const pitcherEndingIndex = pitcherEnding?.endingIndex ?? null
  const pitcherSeenEventIds = pitcherEnding?.seenEventIds ?? NO_EVENTS
  useEffect(() => {
    setCollection((previous) =>
      mergeEndingIntoCollection(previous, { endingIndex: pitcherEndingIndex, seenEventIds: pitcherSeenEventIds }))
  }, [pitcherEndingIndex, pitcherSeenEventIds])

  useEffect(() => {
    store.save(collection)
  }, [collection, store])

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
  const deleteHallOfFamer = useCallback((side: HallOfFameSide, slot: number) => {
    setCollection((previous) => deleteHallOfFame(previous, side, slot))
  }, [])

  /** 시즌 장비 창 0x7d90 → 0x2328c — 명예 선수가 산 장비 니블을 명전 기록에도 (`syncHallOfFameEquipment`) */
  const syncSeasonHallOfFameEquipment = useCallback((side: HallOfFameSide, recordId: number, nibbles: readonly number[]) => {
    setCollection((previous) => syncHallOfFameEquipment(previous, side, recordId, nibbles))
  }, [])

  /**
   * **`0x62368(ui, k, 0)` — 히든 k 를 열고 알림 창** (직접 떴다). 셋째 인자 0 이라 이미 열린 k(0x61f5c)면 아무것도 안 한다.
   * 새로 열면 전역 해금표(`app+0xc0`, 웹 `openedHiddenIds`)에 켜고 공용 창에 글을 띄운다(`hiddenOpenNoticeTextOf`).
   * 새로 열었으면 참 — 원본도 새로 열었을 때만 0 이 아닌 값을 돌려준다.
   * 히든 팀 k 8~12 는 웹 표의 팀 번호 10~14 로 적는다(`hiddenOpenStoredIdOf`). `then` 은 알림 창을 닫은 뒤 부른다 —
   * 새로 열지 않았으면 부르지 않으니(창이 없다) 부르는 쪽이 곧바로 잇는다.
   */
  const openHiddenQuietly = useCallback((id: number): boolean => {
    const stored = hiddenOpenStoredIdOf(id)
    if (collectionRef.current.openedHiddenIds.includes(stored) || openingRef.current.has(stored)) return false
    openingRef.current.add(stored)
    setCollection((previous) =>
      previous.openedHiddenIds.includes(stored)
        ? previous
        : { ...previous, openedHiddenIds: [...previous.openedHiddenIds, stored] })
    return true
  }, [])
  const openHidden = useCallback((id: number, then: (() => void) | null = null): boolean => {
    if (!openHiddenQuietly(id)) return false
    announceRef.current([id], then)
    return true
  }, [openHiddenQuietly])

  /**
   * 시즌모드 정규시즌 경기 승리 (0x4ea0c 4f1e8~4f212) — 전역기록 +0xbf 를 올리고(100 상한) 100 이면 히든 45
   * (`countSeasonRegularWin`). 부르는 쪽(시즌 정산)이 모드 2 · 정규시즌 · 사람 팀 승리를 가린다.
   */
  const recordSeasonRegularWin = useCallback(() => {
    const counted = countSeasonRegularWin(collectionRef.current)
    collectionRef.current = counted.collection
    setCollection((previous) => countSeasonRegularWin(previous).collection)
    if (counted.hiddenId !== null) openHidden(counted.hiddenId)
  }, [openHidden])

  const readStats = useCallback(() => statsRef.current, [])

  /** 통계 기록 `[mgr+0xc8]` 에 한 건 쌓는다 (0x22e35 · 0x22c29 · 0xb663c) — 원본도 곧바로 저장(0x1f1e1)한다 */
  const recordStat = useCallback((event: AnnalsStatEvent) => {
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
  }, [openHidden])

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
        stats: applyAnnalsStat(
          applyAnnalsStat(previous.stats, { kind: '달성표시', index: kind }),
          { kind: 'G획득', mode: collectionRewardStatModeOf(kind), amount },
        ),
      }))
      rewardStore.save(withAwardedBit(record, kind))
      wallet.gain(amount)
      return collectionRewardTextOf(kind)
    },
    [],
  )

  return {
    collection, register, registerPitcher, deleteHallOfFamer, syncSeasonHallOfFameEquipment, recordStat, claimCollectionReward,
    openHidden, openHiddenQuietly, recordSeasonRegularWin,
    /** 기록달성 누계 해금 0x62234 가 문턱에 견주는 지금 통계 (렌더를 기다리지 않는다) */
    readStats,
  }
}

/** 등록 목록 칸 0·5 에 그리는 나리 선수 — 이름과 능력치 도형 값 `0xb6415(기록, k, 1)` */
export interface NariHallOfFamePlayer {
  readonly name: string
  readonly equippedAbility: readonly number[]
  /**
   * A 자리 몸 그림 — 폼 rec[0xb]>>4(2 × 타입 + 손) · 피부 · 장비 니블 넷 · **나리 저장의 팀**
   * (목록 +0x4c4 · +0x4c0 = `0x1f8d5(저장, 3|4)+1`, 0x5ec0a · 0x5ec60). `pages/special` HallOfFameNariPlayer.figure
   */
  readonly figure: {
    readonly form: number
    readonly skin: number
    readonly team: number
    readonly equipment: readonly [number, number, number, number]
  }
}

/** 칸 0 나리 투수 (0x5eb8c — 투수편 저장 g+0x43 · 0x1fbd0). k = 0 제구 · 1 구속 · 2 변화 · 3 체력 */
export function nariPitcherOf(career: PitcherCareer | null | undefined): NariHallOfFamePlayer | null {
  if (career === null || career === undefined) return null
  const ability = equippedPitcherAbilityOf(career)
  const nibbles = career.equipmentLevels
  return {
    name: career.name,
    equippedAbility: [ability.control, ability.velocity, ability.breaking, ability.stamina],
    figure: {
      form: career.typeIndex * 2 + career.handIndex,
      skin: career.skinIndex,
      team: career.teamId,
      equipment: [nibbles.control, nibbles.velocity, nibbles.breaking, nibbles.stamina],
    },
  }
}

/** 칸 5 나리 타자 (0x5eb8c — 타자편 저장 g+0x44 · 0x1fc20). k = 0 히트 · 1 파워 · 2 수비 · 3 주루 */
export function nariBatterOf(career: PlayerCareer | null | undefined): NariHallOfFamePlayer | null {
  if (career === null || career === undefined) return null
  const ability = equippedAbilityOf(career)
  const nibbles = career.equipmentLevels
  return {
    name: career.name,
    equippedAbility: [ability.hit, ability.power, ability.defense, ability.run],
    figure: {
      form: career.battingTypeIndex * 2 + career.battingSide,
      skin: career.skinIndex,
      team: career.teamId,
      equipment: [nibbles.hit, nibbles.power, nibbles.defense, nibbles.run],
    },
  }
}
