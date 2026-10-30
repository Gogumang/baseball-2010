import { useLayoutEffect, useState } from 'react'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { entriesOf, selectedIdOf } from '@/pages/main-menu/model/mainMenu'
import { useMainMenu } from '@/pages/main-menu/model/useMainMenu'
import { useMenuTurn } from '@/pages/main-menu/model/useMenuTurn'
import { useMenuBand } from '@/pages/main-menu/model/useMenuBand'
import { MenuBand } from '@/pages/main-menu/ui/MenuBand'
import { MenuWheel } from '@/pages/main-menu/ui/MenuWheel'
import { IMG_TEXT, MAIN_UI } from '@/pages/main-menu/ui/mainMenuScreen/menuAssets'
import { MainMenuPopups } from '@/pages/main-menu/ui/mainMenuScreen/MainMenuPopups'
import { MenuDescriptionPanel } from '@/pages/main-menu/ui/mainMenuScreen/MenuDescriptionPanel'
import { MenuReelLabels } from '@/pages/main-menu/ui/mainMenuScreen/MenuReelLabels'
import { MenuWheelLabels } from '@/pages/main-menu/ui/mainMenuScreen/MenuWheelLabels'
import { routeMainMenuEffect } from '@/pages/main-menu/ui/mainMenuScreen/mainMenuEffects'
import type { MainMenuScreenProps } from '@/pages/main-menu/ui/mainMenuScreen/mainMenuScreenProps'
import { useTopMenuTenthTick } from '@/pages/main-menu/ui/mainMenuScreen/useTopMenuTenthTick'
import { useStepToward } from '@/pages/main-menu/ui/mainMenuScreen/useStepToward'
import { SkinBackdrop } from '@/pages/main-menu/ui/mainMenuScreen/otherSlices'
import {
  menuBackButtonOf,
  menuGlobalRecordOf,
  menuScreenFrameOf,
  menuTurnTicksOf,
  selectedPressAreaOf,
  wheelCursorOf,
} from '@/pages/main-menu/ui/mainMenuScreen/menuScreenParts'

/**
 * 메인 메뉴 — 원작대로 **두 단**이다. 윗단(하위 상태 4, 처음 메뉴)에서 [게임시작] 을 고르면
 * 아랫단(하위 상태 5, 게임시작 목록)으로 내려가고, 취소(Esc/CLR)하면 윗단으로 돌아온다.
 * 스페셜 6 · 도움말 7 · 환경설정 8 · 랭킹 9 · 게임문의 10 도 윗단에서 갈라진다
 * (표 0xcebdc = [5,6,7,8,9,10], 0x294a2 확정).
 *
 * **두 단 다 원본처럼 "배열이 도는" 릴이다** — 커서가 칸을 옮겨 다니는 것이 아니다.
 * 자세한 근거·좌표는 `lib/mainMenuLayout.ts` 머리말에 적어 뒀다.
 *   윗단 = 반원 바퀴. 여섯 칸이 각도 표 [0,45,90,180,270,315]° 자리에 놓이고 배열이 한 칸씩 돈다.
 *          **고른 칸은 0° 자리라 아예 안 그려진다**(0x24ef0) — 설명 판이 대신 보여 준다.
 *   아랫단 = 세로 릴. 화면 슬롯은 7개 고정이고 9칸짜리 배열이 돈다. **슬롯 4(= 고른 칸)는 안 그린다**.
 *
 * ⚠️ 원본은 아랫단에서도 바퀴 판(0x24b1c)을 **먼저 깔고** 그 위에 목록(0x2524c)을 그린다
 * (부르는 곳 0x2857c 등이 둘을 잇달아 부른다). 그래서 게임시작 목록 뒤로 처음 메뉴 칸 글자가
 * 그대로 비친다 — 보기에 이상해도 원본이 그렇다.
 *
 * ⚠️ 아랫단에는 **바탕 띠**(오른쪽 80px, 바닥에서 160px 올라오는 #192E74 그라데이션)가 바퀴 위·
 *    릴 글자 아래에 깔린다. 자라는 동안(넉 틱)은 릴 줄을 안 그린다 — 원본 0x254d8 그대로다.
 *    장면이 게임시작 목록으로 바로 설 때(`openTier` 5)만 켜진다 (`model/useMenuBand.ts` 주석 참고).
 *
 * ⚠️ 원본 좌표대로 놓으면 아랫단 슬롯 5·6·7(y 360·380·400)과 **설명 판 아래 절반이 화면 밖**이다.
 *    보이는 것은 위 세 줄 + 판 윗동강뿐이다. 값을 비틀지 않았다 — `mainMenuLayout.ts` 주석 참고.
 */
export function MainMenuScreen(props: MainMenuScreenProps) {
  const { hasSavedGame, onTopMenuTenthTick, overlay, gamePoint, openTier = 4, gameStartCursor, topMenuCursor } = props
  // 아랫단 바탕 띠 — 처음 메뉴 OK 로 내려올 때마다(0x294b8) · 장면이 하위 5 로 바로 설 때(생성자 0x2381c) 1 부터 자란다.
  // 자라는 동안은 릴 줄을 안 그리고(0x254d8) 하위 5·9 갱신이 키를 버린다([0xe2] ≠ 0 — 0x28cc2 · 0x28ae0)
  const [tier, setTier] = useState(openTier)
  const band = useMenuBand(tier !== 4, props.isBandGrown === true)
  const { state, dispatch, turningRef } = useMainMenu(
    hasSavedGame,
    false,
    (effect) => routeMainMenuEffect(effect, props),
    menuGlobalRecordOf(props),
    openTier,
    gameStartCursor,
    topMenuCursor,
    band.isGrowing,
  )
  if (state.tier !== tier) setTier(state.tier)
  const origins = useFrameOrigins(`${MAIN_UI}/frames`)
  const textOrigins = useFrameOrigins(`${IMG_TEXT}/frames`)

  const isWheel = state.tier === 4

  useTopMenuTenthTick(isWheel, turningRef, onTopMenuTenthTick)
  const entries = entriesOf(state.tier)
  const selectedId = selectedIdOf(state)
  const selected = entries.find((entry) => entry.id === selectedId)
  const cursor = Math.max(
    entries.findIndex((entry) => entry.id === selectedId),
    0,
  )

  const turn = useMenuTurn(cursor, entries.length, menuTurnTicksOf(isWheel))
  // 도는 동안은 키를 버린다 — `useMainMenu` 의 `turningRef` (0x29454 · 0x28cb0 · 0x28ad4 맨 앞 [+0xe1])
  const isTurning = turn.direction !== null
  useLayoutEffect(() => {
    turningRef.current = isTurning
  }, [turningRef, isTurning])
  /** 도는 동안은 **돌기 전 배열**을 그린다 (회전은 마지막 틱에 한 번 일어난다) */
  const shownCursor = turn.direction === null ? cursor : turn.fromCursor
  const stepToward = useStepToward(isTurning, band.isGrowing, state.tier, dispatch)

  const wheelCursor = wheelCursorOf(isWheel, shownCursor, state.selectedTopId)

  return (
    <RawScreen>
      {/* 메뉴 바탕 0x58371(skin, main_title [메뉴+0x90], 0) — 판 0x24b1c 의 첫 그림(0x24c9c). 메뉴에 들어올 때 떠 둔 버퍼를 찍는다.
          예전 웹은 여기 mode_back/000 배너(240×84)를 깔았는데, mode_back 은 gfx 시간대 설정자 0x7b934 → 0x7b8ec 만 싣고
          그리는 곳(0x7b9ac)은 상태판 0x7d34c · 훈련 팝업 0x848d0 · 엔딩 0x882b4 · 0x88bb4 뿐이라 메뉴에는 없다 */}
      <SkinBackdrop kind="메뉴바탕" />

      {/* 바퀴 바닥 — 가운데 공 + 테두리 원 3겹 (확정). 두 단 다 깔린다. */}
      <MenuWheel />
      <MenuWheelLabels
        isWheel={isWheel}
        wheelCursor={wheelCursor}
        direction={isWheel ? turn.direction : null}
        counter={turn.counter}
        cursor={cursor}
        hasSavedGame={hasSavedGame}
        textOrigins={textOrigins}
        onStep={stepToward}
      />

      {/* 바탕 띠 — 바퀴 위, 릴 글자 아래. 자라는 동안은 아래 릴 줄이 비어 있다 (원본 0x254d8) */}
      {!isWheel && <MenuBand spread={band.spread} />}

      {/* 잠긴 칸도 목록에 그대로 나오고 커서도 지나간다 (R11 4-1) — 안내조차 없는 칸만 흐리게 (근사) */}
      {!isWheel && !band.isGrowing && (
        <MenuReelLabels
          reelState={state.tier}
          entries={entries}
          shownCursor={shownCursor}
          direction={turn.direction}
          counter={turn.counter}
          hasSavedGame={hasSavedGame}
          textOrigins={textOrigins}
          onStep={stepToward}
        />
      )}

      <MenuDescriptionPanel
        isWheel={isWheel}
        reelState={state.tier}
        selected={selected}
        cursor={cursor}
        isBandGrowing={band.isGrowing}
        origins={origins}
        textOrigins={textOrigins}
      />
      {/* 머리띠·바닥띠는 두 단 다 마지막에 그린다 — 윗단 바닥 1(뒤로 표시 없음) · 아랫단 바닥 5(뒤로 표시).
          미끄러짐은 [skin+0x84] 가 서 있을 때만 [skin+0x86] 을 두 배씩 키운다(0x54df0~0x54e1e) — 그 둘을 세우는 곳은
          다른 하위 상태의 들어옴(3 0x258fc · 0x23f5c · 0x24804 …)과 타이틀 갱신 0x245f8 뿐이고 하위 4 들어옴 0x24a40 · 5 들어옴 0x25b88 은
          안 건드린다. 곧 타이틀에서 왔을 때만 미끄러지고(`headerSlides`), 두 단을 오가도 다시 내려오지 않는다 —
          같은 ScreenFrame 을 그대로 두어 미끄러짐을 이어 간다 */}
      {menuScreenFrameOf(gamePoint, isWheel, props.headerSlides, dispatch)}

      {/*
        설명 판 = 지금 고른 칸(판 안 큰 글자) — 투명 누름 칸으로 OK. 고른 칸 글자는 바퀴·릴 어디서도 화면 안에 안 그려져
        (바퀴 아래 자리 · 릴 자리 4 는 판이 대신 보인다) 마우스로 고른 칸을 시작할 길이 없었다. 바닥띠 되돌아가기(x 206~)는 비워 둔다
      */}
      {selectedPressAreaOf(state, dispatch)}

      <MainMenuPopups state={state} onCloseNotice={() => dispatch({ type: '시작' })} onAnswer={(answer) => dispatch({ type: '창답', answer })} />

      {/* 취소 — 아랫단이면 윗단으로 (원본은 CLR 키다, 버튼은 웹 임시). 머리띠를 그리면 바닥띠 뒤로 표시(바닥 5)가 같은 일을 한다.
          처음 메뉴(하위 4)는 CLR 을 안 보므로(0x29454) 타이틀로 가는 단추는 없다 */}
      {menuBackButtonOf(gamePoint, isWheel, dispatch)}

      {overlay}
    </RawScreen>
  )
}
