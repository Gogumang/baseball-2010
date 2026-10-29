import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useImgTextPalette3 } from '@/shared/ui'
import { useTouchKeyOffer, useTouchScrollKeys } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import type { TouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { useSkinBlinkCounter } from '@/shared/lib/skinBlink/skinBlink'
import { stopSkinFrameSlide } from '@/shared/lib/skinFrameSlide/skinFrameSlide'
import { TAB_COUNT, TAB_PAGE_COUNTS } from '@/pages/record/lib/recordAnnalsLayout'
import {
  ANNALS_GRID_SHAPES,
  DIRECTION_CODES,
  NICKNAME_PAGE_TOTALS,
  PANEL_ANIMATION_DRAWS,
  PANEL_FULL_HEIGHT,
  closingPanelHeightOf,
  cursorShakeOf,
  isBlinkOn,
  moveGridCursor,
  nicknameScrollDirectionOf,
  openingPanelHeightOf,
  scrollNicknames,
  scrollTopAfter,
  startNicknameScroll,
} from '@/pages/record/lib/annalsGrid'
import type { AnnalsDirection, NicknameScroll } from '@/pages/record/lib/annalsGrid'
import { INITIAL_SECRET_CODE_STATE, UNLOCKED_STAT_PAGE_COUNT, enterAnnalsSecretCode, typeSecretDigit } from '@/pages/record/lib/statCells'
import { ANNALS_SECRET_PAGES_UNLOCK_ID, isUnlocked } from '@/shared/config/unlocks'
import { IMG_TEXT, SLT_FRAMES } from '@/pages/record/ui/recordAnnals/annalsAssets'
import type { RecordAnnalsProps } from '@/pages/record/ui/recordAnnals/recordAnnalsProps'
import { useAnnalsKeys } from '@/pages/record/ui/recordAnnals/useAnnalsKeys'

/** 탭 막대 → 본문 — OK(Enter) */
const ANNALS_ENTER_BODY_OFFER: TouchKeyOffer = { key: 'Enter', label: '본문 보기' }
/** 탭 3 닉네임 · 탭 4 통계 */
const NICKNAME_TAB = 3
const STAT_TAB = 4

/** 판 높이 — 들어올 때 32 에서 그림마다 커지고(0x2fb94), 닫기 시작하면 줄어든다 */
const panelHeightOf = (closingAt: number | null, tick: number) =>
  closingAt === null ? openingPanelHeightOf(tick) : closingPanelHeightOf(tick - closingAt)

/** 고른 칸 흔들림 — 본문 초점이고 흔들림이 걸렸을 때만 */
function cursorShakeAt(isTabFocused: boolean, shake: { readonly directionCode: number; readonly startedAt: number } | null, tick: number) {
  if (isTabFocused || shake === null) return null
  return cursorShakeOf(shake.directionCode, tick - shake.startedAt)
}

/** 쪽 넘기기 한도 — 통계 탭은 비밀 번호가 열려 있으면 8쪽 */
const pageLimitOf = (tab: number, isSecretOpen: boolean) => (tab === STAT_TAB && isSecretOpen ? UNLOCKED_STAT_PAGE_COUNT : TAB_PAGE_COUNTS[tab])

/** 탭 막대 초점 · 판 열림이면 '본문 보기' 상황 버튼 */
const enterBodyOfferOf = (isPanelOpen: boolean, isTabFocused: boolean) => (isPanelOpen && isTabFocused ? ANNALS_ENTER_BODY_OFFER : null)

/** 기록연감 상태 · 키 · 터치 — 훅 차례는 옛 `RecordAnnals` 몸통 그대로 */
export function useRecordAnnals({ onBack, secretCode: heldSecretCode, onSecretCodeChange }: RecordAnnalsProps) {
  // 들어옴 0x2407c 가 [skin+0x84] = 0 (240b2~240c0) — 앞 화면이 남긴 미끄러짐을 끊어 머리띠가 첫 그림부터 내려온 자리다(r168).
  // 들어옴은 첫 그림보다 앞이라 머리띠(아래 ScreenFrame)가 그리기 전에 지운다
  useState(() => {
    stopSkinFrameSlide()
    return null
  })
  const [tab, setTab] = useState(0)
  const [page, setPage] = useState(0)
  const [cursor, setCursor] = useState(0)
  /** [skin+0xf6] — 들어올 때 1 (0x2407c) */
  const [isTabFocused, setIsTabFocused] = useState(true)
  /** 보이는 줄 창 윗줄 [skin+0x1f4] (아랫줄 [skin+0x1f8] = 윗줄 + 3) */
  const [gridTop, setGridTop] = useState(0)
  const tick = useUpdateCounter()
  /** 탭 막대에서 CLR 을 누른 틱 — 판을 닫는 중 ([skin+0x99] = 0) */
  const [closingAt, setClosingAt] = useState<number | null>(null)
  const panelHeight = panelHeightOf(closingAt, tick)
  /**
   * 깜박임 [sp+0xa8] — 0x2e2f4 가 `% 8 ≤ 3` 으로 세우지만 판 높이가 0xd3(211) 이하인 동안(여닫는 중)은
   * 0x2e42e~0x2e456 이 자르기를 걸면서 0 으로 덮는다. 그 뒤 쓰는 곳(탭 커서 · ▲▼ · 고른 칸 · 스킬 화살)은 모두 이 값을 읽는다
   */
  const blinkCounter = useSkinBlinkCounter(tick)
  const isBlinking = panelHeight >= PANEL_FULL_HEIGHT && isBlinkOn(blinkCounter)
  /** 키를 받는가 — 여는 중이고 끝났고 높이 212 (0x2b87c~0x2b8b6) */
  const isPanelOpen = closingAt === null && tick >= PANEL_ANIMATION_DRAWS
  const hasLeftRef = useRef(false)
  // 닫기가 끝난(넷째 그림) 다음 갱신에 스페셜 목록으로 (0x2bb0a)
  useEffect(() => {
    if (closingAt === null || tick - closingAt < PANEL_ANIMATION_DRAWS || hasLeftRef.current) return
    hasLeftRef.current = true
    onBack()
  }, [closingAt, tick, onBack])
  /** 고른 칸 흔들림 — 방향 [this+0xfc] 과 시작 틱 ([this+0xf8] = 지금 틱 − 시작) */
  const [shake, setShake] = useState<{ readonly directionCode: number; readonly startedAt: number } | null>(null)
  const cursorShake = cursorShakeAt(isTabFocused, shake, tick)
  /** 탭 0·4 목록 격자를 마지막으로 다시 지은 틱 — 깜박임 카운터 +0x18 = 지금 틱 − 이 값 (0x7a005) */
  const [listBuiltAt, setListBuiltAt] = useState(0)
  // 들어올 때 0x2407c — 버퍼 this+0x178 만 비운다. 이 화면이 떠 있는 동안은 여기만 고치므로 바뀔 때마다 위로 알린다
  const [secretCode, setSecretCode] = useState(() => enterAnnalsSecretCode(heldSecretCode ?? INITIAL_SECRET_CODE_STATE))
  const reportSecretCode = useEffectEvent((code: typeof secretCode) => onSecretCodeChange?.(code))
  useEffect(() => reportSecretCode(secretCode), [secretCode])
  const frames = useFrameOrigins(SLT_FRAMES)
  const textFrames = useFrameOrigins(IMG_TEXT)
  /**
   * 고른 탭 이름 img_text 는 **팔레트 3**(#2949A5 · #10246B)으로 찍는다 — 0x2e528~0x2e52e · 0x2e54a~0x2e552 가
   * `0x913e5(img_text, 3)` 를 부른 뒤 재고(0xba815) 그린다(직접 떴다). 기본 팔레트(흰 글자)면 고른 탭의 흰 칸 위에서 안 보였다 (r82)
   */
  const tabNamePalette = useImgTextPalette3()

  // 쪽 넘기기 한도 — 통계 탭은 비밀 번호가 열려 있으면 8쪽 (0x2ba32 · 0x2ba8c). 쪽 번호 "/전체" 는 늘 표 값이다
  // 숨은 쪽 — 비밀 번호(0x2b7a0)로 열거나 해금 표(`unlocks.json`)가 풀면 여덟 쪽을 돈다. 비밀 번호 상태는 그대로다
  const isSecretOpen = isUnlocked(ANNALS_SECRET_PAGES_UNLOCK_ID, () => secretCode.isUnlocked)
  const pageLimit = pageLimitOf(tab, isSecretOpen)
  /** 탭 3 닉네임 스크롤 객체 (skin +0x108~+0x120) — 탭 3 을 새로 시작하거나 탭 3 에서 쪽을 넘길 때만 다시 세운다 */
  const [nicknameScroll, setNicknameScroll] = useState<NicknameScroll>(() => startNicknameScroll(NICKNAME_PAGE_TOTALS[0]))
  /** 0x2b640 — 탭 새로 시작: 쪽 0 · 커서 (0, 0) · 창 0~3 · 탭 3 이면 스크롤 0x61c54(…, 0x20) */
  const restartTab = (next: number) => {
    setTab(next)
    setPage(0)
    setCursor(0)
    setGridTop(0)
    setListBuiltAt(tick)
    if (next === NICKNAME_TAB) setNicknameScroll(startNicknameScroll(NICKNAME_PAGE_TOTALS[0]))
  }
  const changeTab = (next: number) => restartTab((next + TAB_COUNT) % TAB_COUNT)
  /** CLR — 본문이면 탭 막대로(0x2b95c), 탭 막대면 판을 닫기 시작한다(0x2b946) */
  const pressClear = () => {
    if (isTabFocused) return setClosingAt(tick)
    setIsTabFocused(true)
    // 0x2b95c~0x2b964 — [skin+0x80] = 0 이라 다음 그림이 목록 격자를 커서 없이(+6 = 0) 다시 짓는다
    setListBuiltAt(tick)
  }

  /**
   * ← → 는 쪽 넘기기 (0x2ba10 · 0x2ba5a) — 쪽이 없는 탭(진행·스킬)은 보이는 것이 없다.
   * 끝에 [skin+0x80] = 0 (0x2babe) — 탭 0·4 그림이 0 일 때만 목록 객체 [mgr+0xe0] 를 새 쪽으로 다시 짓고(0x79ed5 ·
   * 0x7a005, 0x2e8e0~0x2e996) 1 올리는 "다시 지어라" 깃발이다. 웹은 그릴 때마다 쪽에서 줄을 새로 뽑으므로 따로 둘 것이 없다
   */
  const turnPage = (direction: AnnalsDirection) => {
    const step = direction === 'right' ? 1 : -1
    if (pageLimit === 0) return
    const nextPage = (page + step + pageLimit) % pageLimit
    setPage(nextPage)
    setListBuiltAt(tick)
    // 탭 3 이면 새 쪽의 개수로 스크롤을 다시 세운다 (0x2bac6: 쪽 0 ? 0x20 : 0x10)
    if (tab === NICKNAME_TAB) setNicknameScroll(startNicknameScroll(nextPage === 0 ? 0x20 : 0x10))
  }

  useAnnalsKeys({
    isTabFocused,
    isPanelOpen,
    onDigit: (key) => setSecretCode((previous) => typeSecretDigit(previous, key)),
    onClear: pressClear,
    onTabStep: (step) => changeTab(tab + step),
    onEnterBody: () => {
      restartTab(tab)
      setIsTabFocused(false)
    },
    onBodyKey: (key) => {
      const scrollDirection = nicknameScrollDirectionOf(key)
      if (scrollDirection !== null) setNicknameScroll((previous) => scrollNicknames(previous, scrollDirection))
    },
    onBodyDirection: (direction) => {
      const nextCursor = moveGridCursor(ANNALS_GRID_SHAPES[tab], cursor, direction)
      setCursor(nextCursor)
      // 커서가 옮겨 갔으면(격자 +0x25) 흔들림을 새로 건다 (0x2eaec)
      if (nextCursor !== cursor) setShake({ directionCode: DIRECTION_CODES[direction], startedAt: tick })
      if (direction === 'up' || direction === 'down') return setGridTop(scrollTopAfter(tab, gridTop, nextCursor, direction))
      turnPage(direction)
    },
  })

  // 터치 기기 — 본문에 초점이 있으면 ▲ · ▼ 상황 버튼(↑ · ↓ — 보이는 행 밖 칸 · 닉네임 글 스크롤). ◀ · ▶ 는 아래 쪽 화살 칸이 받는다
  useTouchScrollKeys(isPanelOpen && !isTabFocused)
  // 탭 막대 초점의 OK(본문으로)는 칸 그림이 없는 탭(0 · 3 · 4)에서 누를 자리가 없어 '본문 보기' 상황 버튼으로 낸다(r186 — 늘 있던
  // 확인 버튼을 걷었다). Enter 키 사건이라 위 듣는 곳과 같은 길이다
  useTouchKeyOffer(enterBodyOfferOf(isPanelOpen, isTabFocused))

  /** 웹 덧붙임 — 보이는 칸을 누르면 본문에 들어가 그 칸을 고른다 (창은 그대로) */
  const selectCell = (index: number) => {
    if (!isPanelOpen) return
    setIsTabFocused(false)
    setCursor(index)
  }

  return {
    tab,
    page,
    cursor,
    isTabFocused,
    gridTop,
    tick,
    panelHeight,
    isBlinking,
    isPanelOpen,
    cursorShake,
    listBuiltAt,
    frames,
    textFrames,
    tabNamePalette,
    nicknameScroll,
    changeTab,
    pressClear,
    selectCell,
  }
}

export type RecordAnnalsState = ReturnType<typeof useRecordAnnals>
