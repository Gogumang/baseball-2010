import { useState } from 'react'
import { usePreviousDistinct } from '@/shared/lib/renderMachine/usePreviousDistinct'
import type { SeasonRankingSide } from '@/entities/season-mode/model/seasonRecordRanking'
import type { PlayerPickPurpose } from '@/entities/season-mode/model/playerPick'
import type { EntryTab } from '@/entities/season-mode/model/entryEditor'
import { useEventEndFrame } from '@/app/model/useEventEndFrame'
import type { SeasonSession } from '@/app/model/useSeasonSession'
import { useSceneLifeCells } from '@/app/ui/seasonRoute/useSceneLifeCells'

/** 시즌 라우트가 장면 사이에 들고 있는 화면 칸 — 창 종류 · 커서 · 고른 선수 · 이전 장면 */
export function useSeasonRouteState(session: SeasonSession) {
  const { scene, actions } = session

  /** 아이템 상점 0xdc 의 창 종류 1 서브아이템 · 2 GP (0x5f3c 가 0xd0 의 칸으로 고른다). null 이면 구장·장비 갈래 */
  const [shopKind, setShopKind] = useState<1 | 2 | null>(null)
  /** 0xe8 에서 돌아오면 GP 창 커서를 칸 3 으로 (0x5f3c 이전 상태 0xe8 갈래) */
  const [shopCursor, setShopCursor] = useState(0)
  /** 기록순위 창 0x80 — this+0x16c (1 타자기록 · 0 투수기록). 0x9008 칸 3 이 1 로 열고, null 이면 창이 없다 */
  const [recordPick, setRecordPick] = useState<SeasonRankingSide | null>(null)
  /** 0xdb 목록 — 창에서 고른 쪽과 ed+0x444(종류표의 쪽). 0x5761c 가 들어올 때마다 쪽 0 으로 만든다 */
  const [recordRank, setRecordRank] = useState<{ readonly side: SeasonRankingSide; readonly page: number }>({ side: '타자', page: 0 })
  const sceneLife = useSceneLifeCells(scene)
  /** 0xdf 목적 1 에서 나리 선수를 고르면 뜨는 StrMODE[220] 알림 (0xbbef9(…, 1, 1, 1) — 상태는 0xdf 그대로) */
  const [pickNotice, setPickNotice] = useState<string | null>(null)
  /**
   * 공용 선수 고르기 0xdf 의 목적 `this+0x110` 과 목록 탭(ed+0x33f)·커서 — 목적 1·2 만 (3 선수영입은 `PlayerRecruitScreen` 이 든다).
   * 원본 목록 객체 [this+0xa8] 는 장면이 사는 동안 남지만 0xdf 에 들어올 때마다 다시 채워 커서는 0 이고, 탭만
   * 0xd9·0xdc 에서 돌아올 때 창+0x24c(타자)를 따른다 (0x5980).
   */
  const [playerPick, setPlayerPick] = useState<{
    readonly purpose: PlayerPickPurpose
    readonly tab: EntryTab
    readonly cursor: number
  } | null>(null)
  /**
   * 이전 장면 — 관리 메뉴 0xc9 진입 0x4efc 가 이전 상태 1 · 0xd3 · 0xcb · 0xf5 · 0xf1 이면 가운데 판을 미끄러뜨린다(0x8a2d8).
   * 처음 서는 관리 메뉴(이전 없음)는 진입 분기 0xcb 를 지난 것이다.
   */
  const previousScene = usePreviousDistinct(scene)
  /** 0xd3 재생이 끝난 한 틀 — 대화창 없이 0xa09c 의 끝 그림을 그린 뒤 넘긴다 (`useEventEndFrame`) */
  const eventEnd = useEventEndFrame(actions.finishSeasonEvent)
  /** 엔딩을 넘긴 틀이 건 효과기 종류 2 — 관리 메뉴 0xc9 위에서 돈다 (`SeasonEndingScreen`) */
  const [isEndingFadeIn, setEndingFadeIn] = useState(false)
  return {
    shopKind,
    setShopKind,
    shopCursor,
    setShopCursor,
    recordPick,
    setRecordPick,
    recordRank,
    setRecordRank,
    ...sceneLife,
    pickNotice,
    setPickNotice,
    playerPick,
    setPlayerPick,
    previousScene,
    eventEnd,
    isEndingFadeIn,
    setEndingFadeIn,
  }
}

export type SeasonRouteState = ReturnType<typeof useSeasonRouteState>
