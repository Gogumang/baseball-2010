import { useState } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import { ITEM_COUNT, SPECIAL_ITEMS } from '@/pages/special/lib/specialLayout'
import { DescriptionBand } from '@/shared/ui/DescriptionBand/DescriptionBand'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { useCursorShake } from '@/shared/lib/cursorShake/useCursorShake'
import { noteSkinShakeKey, skinShakeDirection } from '@/shared/lib/cursorShake/skinShakeDirection'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { MENU_REEL_SCROLL_STEPS, MenuBand, MenuWheel, useMenuBand, useMenuTurn } from '@/pages/special/ui/specialScreen/otherSlices'
import { IMG_TEXT_FRAMES } from '@/pages/special/ui/specialScreen/specialAssets'
import { SpecialWheelLabels } from '@/pages/special/ui/specialScreen/SpecialWheelLabels'
import { SpecialReel } from '@/pages/special/ui/specialScreen/SpecialReel'
import { SpecialDescriptionPanel } from '@/pages/special/ui/specialScreen/SpecialDescriptionPanel'
import { SpecialListFrame, SpecialOpenArea } from '@/pages/special/ui/specialScreen/SpecialListParts'
import { useSpecialListKeys } from '@/pages/special/ui/specialScreen/useSpecialListKeys'
import { specialViewOf } from '@/pages/special/ui/specialScreen/specialScreenTypes'
import type { SpecialScreenProps, SpecialView } from '@/pages/special/ui/specialScreen/specialScreenTypes'
import { specialSubScreenOf } from '@/pages/special/ui/specialScreen/specialSubScreens'

export { HallOfFameScreen } from '@/pages/special/ui/hallOfFameScreen/HallOfFameScreen'
export type { HallOfFameDeletion, HallOfFameMode, HallOfFameNariPlayer } from '@/pages/special/ui/hallOfFameScreen/hallOfFameTypes'

/** 릴이 도는 동안은 돌기 전 커서를 그린다 */
const shownCursorOf = (turn: ReturnType<typeof useMenuTurn>, cursor: number) => (turn.direction === null ? cursor : turn.fromCursor)

/**
 * 원작 메인 메뉴 [스페셜] = 하위 상태 6 (그리기 0x2860c — P6 2d).
 *
 * 반원 바퀴(0x24b1c) 위에 **하위 목록 0x2524c** 여덟 칸이 오른쪽 세로로 서고, 머리띠 0x54d95(제목 0
 * "2010프로야구", 바닥 5 = 되돌아가기)가 위아래를 덮는다. 칸 그림은 main_ui 프레임
 * **15 G포인트충전 · 16 G포인트선물 · 17 친구추천 · 18 명예의전당 · 19 마선수선택 · 20 에디트 ·
 * 21 기록연감 · 28 선물받기** (표 0xceb2f 확정).
 *
 * 오프라인 웹판에서 실제로 도는 칸은 **명예의전당·마선수선택·에디트·기록연감** 넷뿐이지만, 원본에 있는 칸을 지우지 않고
 * 여덟 칸을 다 그린다. 나머지(통신 기능 = 충전·선물·친구추천·선물받기)는 흐리게 그리고 누르면 안내를 띄운다.
 * 마선수선택(상태 28)은 앱이 `renderAceSelect` 로, 에디트(상태 29)는 `renderEdit` 로 꽂는다.
 *
 * 바퀴는 메인 메뉴의 `MenuWheel`(도는 공 + 호)에 칸 글자(0x24f9e~0x24fe2 — 메인 메뉴 `wheelLabels` 와 같은 꼴)를 얹는다.
 * 하위 6 에서는 바퀴가 돌지 않고 배열 `[0x1552d4c]` 는 윗단에서 [스페셜] 을 고른 그대로라 [스페셜] 이 0°(안 그림)에 있다
 * — 나머지 다섯 칸이 45·90·180·270·315° 에 선다(`menuWheelRestingLabelsOf`).
 *
 * 목록은 메인 메뉴 아랫단과 **같은 세로 릴 0x2524c(this, 6, 틱)** 이다(`specialLayout` 의 `SPECIAL_REEL_STATE` 머리말, 직접 떴다):
 * 그리기 0x2860c 가 0x24b1c(바퀴) → 0x2524c → 머리띠 차례로, 게임시작 목록 0x2863c 와 목록 종류만 다르다. 그래서 바탕은 메인 메뉴
 * 아랫단과 같다 — 배너 · 바퀴 · 바퀴 칸 글자 · **바탕 띠**(처음 메뉴 OK 0x294b8 이 칸이 무엇이든 [0xe2] · [0xe4] = 1 을 넣어
 * 1 → 4 → 16 → 64 → 160 으로 자란다, 자라는 동안은 줄 · 설명 띠를 안 그리고 키도 버린다 0x28ba0~0x28bb4).
 * 줄은 슬롯 1·2·3 (y 213 · 233 · 253) 에 커서 −3 · −2 · −1 칸, 고른 칸은 슬롯 4 라 안 그리고 설명 판(96, 289)이 대신 보인다.
 * 슬롯 5·6·7 은 화면 밖이다(원본 그대로). ↑ · ↓ 는 릴을 돌린다(스크롤 ±1 · ±4 · ±16 뒤 회전).
 * 바탕은 판 0x24b1c 가 맨 먼저 찍는 메뉴 바탕 0x58371(skin, [메뉴+0x90] main_title, 0)(0x24c9c)이다 — 예전 웹의 mode_back/000 배너는
 * 원본에 없다(mode_back 은 0x7b8ec 만 싣고, 그리기 0x7b9ac 를 부르는 곳은 0x7d34c · 0x84928 · 0x88572 · 0x88d76 뿐, 2026-10-15 r97 직접 뜸).
 */
export function SpecialScreen(props: SpecialScreenProps) {
  const { gamePoint, onBack } = props
  const [view, setView] = useState<SpecialView>('목록')
  const [cursor, setCursor] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  /** 설명 판 까딱임 — 표 0xce8bc · 0xce88c (`specialLayout` 의 까딱임 주석) */
  const panelShake = useCursorShake(useUpdateCounter())
  /** 바탕 띠 [메뉴+0xe4] — 처음 메뉴 OK(0x294b8)가 1 로 두고 이 화면에서 자란다. 하위 화면을 다녀와도 되돌리지 않는다 */
  const band = useMenuBand(true, props.isBandGrown ?? false)
  /** 릴 돌기 — 스크롤 석 장 뒤 회전 (0x25386) */
  const turn = useMenuTurn(cursor, ITEM_COUNT, MENU_REEL_SCROLL_STEPS.length)
  const shownCursor = shownCursorOf(turn, cursor)
  const textOrigins = useFrameOrigins(IMG_TEXT_FRAMES)

  const openItem = (index: number) => {
    const item = SPECIAL_ITEMS[index]
    setCursor(index)
    if (item.availability !== '됨') return setNotice(item.blockedText ?? '')
    const next = specialViewOf(item.id, props)
    if (next !== null) setView(next)
  }

  useSpecialListKeys({
    isActive: view === '목록' && notice === null,
    isIgnoring: band.isGrowing || turn.direction !== null,
    onStep: (step, key) => {
      // 갱신 0x28b9c: 앞 칸 · 뒤 칸 키가 [메뉴+0xf4] = 1 을 세우고 0x5550d 에 **날 키**를 넘긴다 → 그리기 머리 0x252c6 가 까딱임을 건다.
      // 0x5550d 는 화살표(−1~−4)만 방향 칸 [skin+0x8c] 에 적어, 숫자키는 앞서 적힌 방향 그대로 까딱인다 (`cursorShakeDirectionOfKey`)
      // 방향 칸은 skin 공용이라(`skinShakeDirection` — 앱을 켤 때 0x5390c 가 0 = ←) 앞 화면에서 적힌 방향이 남는다 (Q-10)
      noteSkinShakeKey(key)
      panelShake.start(skinShakeDirection())
      setCursor((previous) => (previous + step + ITEM_COUNT) % ITEM_COUNT)
    },
    onOpen: () => openItem(cursor),
    onBack,
  })

  const sub = specialSubScreenOf(view, props, () => setView('목록'))
  if (sub !== null) return sub

  const selected = SPECIAL_ITEMS[cursor]
  return (
    <RawScreen>
      {/* 메뉴 바탕 0x58371(skin, main_title, 0) — 판 0x24b1c 의 첫 그림(0x24c9c), 메인 메뉴와 같다 */}
      <SkinBackdrop kind="메뉴바탕" />
      {/* 반원 바퀴 0x24b1c 의 바닥 — 가운데에서 도는 main_ball 애니 0 + 테두리 원 3겹 (120, 320) 반지름 93·95·97. 메인 메뉴와 같은 그림 */}
      <MenuWheel />
      <SpecialWheelLabels />
      {/* 바탕 띠 — 바퀴 위, 릴 글자 아래 (0x253e8~0x2548e) */}
      <MenuBand spread={band.spread} />
      <SpecialReel
        isGrowing={band.isGrowing}
        direction={turn.direction}
        counter={turn.counter}
        shownCursor={shownCursor}
        textOrigins={textOrigins}
        onPick={setCursor}
      />
      <SpecialDescriptionPanel selected={selected} textOrigins={textOrigins} shake={panelShake.offset} />
      {/* 설명 띠 0x55545(StrMAINMENU[0x10 + 커서]) — 0x2524c 맨 끝. 띠가 자라는 동안은 안 그린다 */}
      {!band.isGrowing && <DescriptionBand text={selected.description} seed={cursor} />}
      {/* 설명 판 = 고른 칸 — 투명 누름 칸으로 OK (바닥띠 되돌아가기 x 206~ 는 비워 둔다) */}
      {notice === null && <SpecialOpenArea label={`${selected.id} 열기`} onPress={() => (band.isGrowing ? undefined : openItem(cursor))} />}
      <SpecialListFrame gamePoint={gamePoint} onBack={onBack} />

      {notice !== null && <MessageBox text={notice} buttons={['확인']} onAnswer={() => setNotice(null)} />}
    </RawScreen>
  )
}
