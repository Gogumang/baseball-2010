import { useNariMainCursor } from '@/app/model/useNariMainCursor'
import { usePreviousDistinct } from '@/shared/lib/renderMachine/usePreviousDistinct'
import { useEventEndFrame } from '@/app/model/useEventEndFrame'
import type { PitcherLeagueSession } from '@/app/model/usePitcherLeagueSession'

/** 142 경기 준비가 지금 보이는 판 — 엔트리 보기가 서 있으면 143 */
function matchViewOf(session: PitcherLeagueSession): '142' | '143' | null {
  if (session.scene !== '경기준비') return null
  return session.entryView === null ? '142' : '143'
}

/** 105 진입 열쇠 — 관리 장면, 또는 105 진입 곁가지로 바로 뜬 '관리' 이벤트(이벤트마다 새 진입). 커리어가 없으면 없다 */
function mainCursorEntryKeyOf(session: PitcherLeagueSession): string | null {
  if (session.career === null) return null
  if (session.scene === '관리') return '관리'
  if (session.scene === '이벤트' && session.story?.context === '관리') return `이벤트:${session.story.eventId}`
  return null
}

/** 투수편 화면들이 같이 보는 칸 — 이전 장면 · 142/143 · 관리 메뉴 커서 · 114 끝 한 틀 (훅 차례 그대로) */
export function usePitcherScreenState(session: PitcherLeagueSession) {
  const { career, scene, actions } = session
  /** 이전 장면 — 105 진입 0x11910 이 이전 상태 1 · 114 · 100 이면 가운데 판을 미끄러뜨린다 (0x8a2d8) */
  const previousScene = usePreviousDistinct<string>(scene)
  /**
   * 관리 메뉴 [this+0x8c] 의 커서 — 타자편 `CareerRoutes` 와 같다(`NariMainMenuCursor`). 105 에 들어올 때마다(관리 장면, 또는
   * 105 진입 곁가지로 바로 뜬 '관리' 이벤트) 0x11910 규칙: 행동함이고 이전이 109 · 110 이 아니면 첫 칸. 상점(111 · 121)에서
   * 돌아오면 105 가 아니라 하위 메뉴(110 · 106)로 선다(`nariReturnSubMenuOf`) — 이 규칙을 안 친다.
   */
  /**
   * 142 경기 준비 그림 0x15d98 의 0x63b15 넷째 인자 = `[장면+0x28] ≠ 0x8f` — 이전 상태가 143(엔트리 보기)이 아니면
   * 머리띠 미끄러짐 · 배너 연출을 켠다 (`pages/management/lib/matchInfoEntry`).
   */
  const matchView = matchViewOf(session)
  const isMatchInfoEntryAnimated = usePreviousDistinct(matchView) !== '143'
  const entryKey = mainCursorEntryKeyOf(session)
  // 열쇠가 있으면 커리어가 있다(커리어가 없으면 열쇠는 null)
  const mainCursor = useNariMainCursor({
    entryKey,
    isEventScreen: scene === '이벤트',
    previous: previousScene,
    subMenuScreen: '상점',
    hasActedThisCycle: career?.hasActedThisCycle ?? false,
  })
  /** 114 재생이 끝난 한 틀 — 대화창 없이 0x19da4 를 그린 뒤 넘긴다 (`useEventEndFrame`) */
  const eventEnd = useEventEndFrame(actions.completeStory)
  return { previousScene, isMatchInfoEntryAnimated, mainCursor, eventEnd }
}

export type PitcherScreenState = ReturnType<typeof usePitcherScreenState>
