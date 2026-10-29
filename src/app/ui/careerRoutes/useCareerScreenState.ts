import { useEventEndFrame } from '@/app/model/useEventEndFrame'
import { useNariMainCursor } from '@/app/model/useNariMainCursor'
import { usePreviousDistinct } from '@/shared/lib/renderMachine/usePreviousDistinct'
import type { Screen } from '@/app/model/screen'
import type { CareerRoutesProps } from '@/app/ui/careerRoutes/careerRoutesProps'

type CareerScreenStateInput = Pick<CareerRoutesProps, 'screen' | 'session' | 'career'>

/** 142 경기 준비가 지금 보이는 판 — 엔트리 보기가 서 있으면 143 */
function matchViewOf(screen: Screen, session: CareerRoutesProps['session']): '142' | '143' | null {
  if (screen.kind !== '경기준비') return null
  return session.entryView === null ? '142' : '143'
}

/** 105 진입 열쇠 — 관리 화면, 또는 105 진입 곁가지로 바로 뜬 '관리' 이벤트(이벤트마다 새 진입) */
function mainCursorEntryKeyOf(screen: Screen): string | null {
  if (screen.kind === '관리') return '관리'
  if (screen.kind === '이벤트' && screen.context === '관리') return `이벤트:${screen.eventId}`
  return null
}

/** 나리 화면들이 같이 보는 칸 — 114 끝 한 틀 · 이전 화면 · 142/143 · 관리 메뉴 커서 (훅 차례 그대로) */
export function useCareerScreenState({ screen, session, career }: CareerScreenStateInput) {
  const { actions } = session
  /** 114 재생이 끝난 한 틀 — 대화창 없이 0x19da4 를 그린 뒤 넘긴다 (`useEventEndFrame`) */
  const eventEnd = useEventEndFrame(actions.completeScene)
  /** 이전 화면 — 105 진입 0x11910 이 이전 상태 1 · 114 · 100 이면 가운데 판을 미끄러뜨린다 (0x8a2d8) */
  const previousKind = usePreviousDistinct(screen.kind)
  /**
   * 관리 메뉴 [this+0x8c] 의 커서 — 장면 0x106 이 서 있는 동안 남는다(`NariMainMenuCursor`). 105 에 들어올 때마다(관리 화면,
   * 또는 105 진입 곁가지로 바로 뜬 '관리' 이벤트) 0x11910 의 규칙을 친다: 행동함이고 이전이 109(다음 경기 순위표) · 110(아이템 하위
   * 메뉴)이 아니면 첫 칸. 105 틀에서 뜬 이벤트(이전 화면이 관리)는 새 진입이 아니다. 상점(111 · 121)에서 돌아오면 105 가 아니라 하위
   * 메뉴(110 · 106)로 서므로(`nariReturnSubMenuOf`) 이 규칙을 안 친다 — 110 취소가 그 105 진입을 친다(`useManagementMenu`).
   */
  /**
   * 142 경기 준비 그림 0x15d98 의 0x63b15 넷째 인자 = `[장면+0x28] ≠ 0x8f` — 이전 상태가 143(엔트리 보기)이 아니면
   * 머리띠 미끄러짐 · 배너 연출을 켠다 (`pages/management/lib/matchInfoEntry`).
   */
  const matchView = matchViewOf(screen, session)
  const isMatchInfoEntryAnimated = usePreviousDistinct(matchView) !== '143'
  const entryKey = mainCursorEntryKeyOf(screen)
  const mainCursor = useNariMainCursor({
    entryKey,
    isEventScreen: screen.kind === '이벤트',
    previous: previousKind,
    subMenuScreen: '아이템',
    hasActedThisCycle: career.hasActedThisCycle,
  })
  return { eventEnd, previousKind, isMatchInfoEntryAnimated, mainCursor }
}

export type CareerScreenState = ReturnType<typeof useCareerScreenState>
