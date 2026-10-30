import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { setAppTickInterval } from '@/shared/lib/frameClock/frameClock'
import { PressArea } from '@/shared/ui'
import { IN_GAME_MENU_LABELS, IN_GAME_MENU_SLIDE_END, inGameMenuLayoutOf, inGameMenuSlideAt } from '@/features/play-team-game/model/inGameMenu'
import type { InGameMenuAction } from '@/features/play-team-game/model/inGameMenu'
import type { InGameMenuOpening } from '@/features/play-team-game/model/useInGameMenuState'
import { usePopupWindowMotion } from '@/shared/lib/commonWindow/popupWindow'
import { POPUP_DIM_OPACITY } from '@/shared/ui/MessageBox/popupDim'
import * as styles from '@/features/play-team-game/ui/InGameMenu.css'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'
import { MenuPanel } from '@/features/play-team-game/ui/inGameMenu/MenuPanel'
import { handlePauseWindowKey } from '@/features/play-team-game/ui/inGameMenu/pauseWindowKeys'

/**
 * **일시정지 창 한 벌** — 0x741a0(창, 목표 높이 0, 그리기 0x3cdd1, 키 0x3c159, 장면). 목표 높이 0 이라 판 0x744c4 는 안 긋고
 * (0x7478a) 그리기 콜백 0x3cdd0 이 메뉴 판을 그린다. 펼치는 동안([+0x214])은 그리기 콜백을 안 부르고(0x7479c) 뒤 어둡게만 남는다.
 * 닫힘은 키 콜백이 [창+0x215] = 1 을 쓰는 것뿐이고(0x3c1a8 CLR · '*' · 0x3c1fe 계속 · 질문 갈래들 — 0x742a9 는 안 부른다),
 * 그동안 그리기 콜백은 돌아 메뉴가 그대로 남고 키는 안 본다(0x7558a). '별표' 창은 [+0x290] = 0 이라 다음 갱신에, 그 밖은 폭
 * 240 → 120 → 닫힘 두 갱신 뒤에 내려간다(`InGameMenuOpening`).
 */
export function PauseWindow({
  opening,
  slidesIn,
  actions,
  cursor,
  canAutoProgress,
  isEnabled,
  onMoveCursor,
  onChoose,
  onRequestClose,
  windowCloseRef,
}: {
  readonly opening: InGameMenuOpening
  readonly slidesIn: boolean
  readonly actions: readonly InGameMenuAction[]
  readonly cursor: number
  readonly canAutoProgress: boolean
  readonly isEnabled: (action: InGameMenuAction) => boolean
  readonly onMoveCursor: (cursor: number) => void
  readonly onChoose: (action: InGameMenuAction) => void
  /** CLR · '*' (0x3c1a8) — 여는 곳의 닫기(계속과 같다) */
  readonly onRequestClose: () => void
  readonly windowCloseRef: { current: ((onClosed: () => void) => boolean) | null }
}) {
  // 레이아웃이 없는 환경(시험)에서는 `MessageBox` 처럼 펼침 · 닫힘을 건너뛴다
  const dimRef = useRef<HTMLDivElement>(null)
  const [hasNoLayout, setHasNoLayout] = useState(false)
  useLayoutEffect(() => {
    if ((dimRef.current?.offsetHeight ?? 0) <= 0) setHasNoLayout(true)
  }, [])
  const motion = usePopupWindowMotion({
    targetHeight: 0,
    expands: opening !== '별표',
    opensAtOnce: opening === '복귀',
    skipsMotion: hasNoLayout,
  })
  const motionRef = useRef(motion)
  useMirrorRef(motionRef, motion)
  // 창이 키를 받을 때만 닫는다 — 펼침 · 줄임 중이면 그 키는 버려지지만(0x75556 · 0x7558a) 닫기 요청은 받은 셈이다
  useLayoutEffect(() => {
    windowCloseRef.current = (onClosed) => {
      const current = motionRef.current
      if (!current.acceptsKeys()) return true
      return current.close('줄임', onClosed)
    }
    return () => {
      windowCloseRef.current = null
    }
  }, [windowCloseRef])

  /** 그린 횟수 — 밀려 들기 [장면+0x1954] 를 정한다. 그리기 콜백은 펼치는 동안 안 돈다(0x7479c) */
  const isShown = motion.openingHeight === null
  const [slideFrame, setSlideFrame] = useState(() => (slidesIn ? 0 : Number.POSITIVE_INFINITY))
  const slide = Number.isFinite(slideFrame) ? inGameMenuSlideAt(slideFrame) : IN_GAME_MENU_SLIDE_END
  useEffect(() => {
    if (!isShown || slide >= IN_GAME_MENU_SLIDE_END) return
    const timer = setAppTickInterval(() => setSlideFrame((frame) => frame + 1))
    return () => timer()
  }, [isShown, slide])

  const cursorRef = useRef(cursor)
  useMirrorRef(cursorRef, cursor)
  const latest = useRef({ actions, onMoveCursor, onChoose, onRequestClose })
  useMirrorRef(latest, { actions, onMoveCursor, onChoose, onRequestClose })
  useEffect(() => {
    // 펼치는 동안('별표' 창 말고) · 줄이는 동안은 키 콜백 0x3c158 을 안 부른다
    const onKeyDown = (event: KeyboardEvent) => handlePauseWindowKey(event, latest.current, cursorRef, () => motionRef.current.acceptsKeys())
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const layout = inGameMenuLayoutOf(actions.length, slide)
  return (
    <>
      {/*
        창 뒤 어둡게 — 경기 장면 생성자 0x3301c 가 [창+0x24f] = 1 · [창+0x24c] = 1 을 세운다. 일시정지 창 0x741a0 이 띄울 때
        (0x74228) [창+0x24f] 를 [창+0x24e] 로 옮기므로 0x746cc 는 **한 번** — 연 그림에 검정 단계 5 = 6/16 — 덮는다.
        메뉴 동안 경기를 다시 안 그려 그 한 겹이 멈춘 그림 위에 남는다 (`popupDim`).
      */}
      <div ref={dimRef} className={styles.dim} data-testid="경기-메뉴-어둡게" style={{ background: `rgba(0, 0, 0, ${POPUP_DIM_OPACITY})` }} />
      {isShown && !motion.isClosed && (
        <>
          <MenuPanel layout={layout} actions={actions} cursor={cursor} canAutoProgress={canAutoProgress} />
          <div role="listbox" aria-label="경기 중 메뉴">
            {actions.map((action, index) => {
              const row = layout.rows[index]
              if (row === undefined) return null
              return (
                <PressArea
                  key={action}
                  label={IN_GAME_MENU_LABELS[action]}
                  rect={{ x: row.pill.x, y: row.pill.y, width: row.pill.width + 1, height: row.pill.height + 1 }}
                  option={{ isSelected: index === cursor }}
                  isDisabled={!isEnabled(action)}
                  onPress={() => {
                    if (!motionRef.current.acceptsKeys()) return
                    cursorRef.current = index
                    onMoveCursor(index)
                    onChoose(action)
                  }}
                />
              )
            })}
          </div>
        </>
      )}
    </>
  )
}
