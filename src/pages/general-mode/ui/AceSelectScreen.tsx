import { useState } from 'react'
import { useListPageEntry } from '@/widgets/screen-frame/model/useListPageEntry'
import { RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { FOOTER_BITS } from '@/widgets/screen-frame/lib/screenFrameLayout'
import { aceLevelOf, isAceMaxLevel } from '@/entities/mission/model/aceLevel'
import { ACE_GRID_OPEN, isAceGridCursorOn } from '@/pages/general-mode/lib/prepareLayout'
import { ACE_PER_ROLE, ACE_PHASE } from '@/pages/general-mode/lib/generalModeSetup'
import { useGridCursorBounce } from '@/shared/lib/gridCursorBounce/gridCursorBounce'
import { IMG_TEXT_FRAME, isAceCellOpen, isAceCellReachable, isEveryAceOpen as isEveryAceOpenOf } from './aceSelect/aceSelectRules'
import type { AceSelectScreenProps } from './aceSelect/aceSelectProps'
import { AceCursorInfo } from './aceSelect/AceCursorInfo'
import { AceGrid } from './aceSelect/AceGrid'
import { AceSelectPopups } from './aceSelect/AceSelectPopups'
import { useAceGridKeys, useAllAcesOpenNotice, useCursorFollowsPhase } from './aceSelect/useAceSelectEffects'

export type { AceSelectScreenProps } from './aceSelect/aceSelectProps'

/**
 * **마선수 고르기** — 메인 메뉴 하위 상태 **21**, 공용 목록 `0x63b15` 의 **k = 2**
 * (진입 0x263f4 · 갱신 0x29df8 · 본문 0x647b4. P6 2a-5 좌표 확정).
 *
 * 격자는 10칸(윗줄 마투수 0~4 · 아랫줄 마타자 5~9)이고 **마투수를 먼저** 고른 뒤 커서가
 * 아랫줄로 내려간다. 마투수 OK 는 `rec+0xe`, 마타자 OK 는 `rec+0xd` 에 적힌다.
 *
 * **잠긴 칸을 누르면 오픈 힌트 팝업**이 뜬다 (0xa248 안 0xa68e~0xa6dc). 문자열표 `[0x1552cf8]` 은
 * StrCOMMON 이고 [0x2a]·[0x2b] = StrCOMMON[42]·[43] 이며, 힌트 글 자체는 `XlsACE_LEVEL_UP` 의
 * +0xc 칸이다 — `shared/config/original/aceOpen.ts` 에 다 있다.
 * (예전 주석은 "그 표가 웹판 데이터에 없다" 고 적고 있었다 — **틀렸다.** 표는 `base/extracted/` 에
 *  있었고 생성기가 안 뽑고 있던 것뿐이다.)
 *
 * **실제 오픈**도 이제 여기서 한다 (0xa390~0xa46e): [43] 에서 "예" 를 고르면 `onOpenAce(칸)` 로
 * 나가고, 들고 있는 G가 가격보다 **적으면** 대신 부족 팝업(0xcc214)이 뜬다 — 자세한 것은
 * `lib/aceOpenState.ts` 의 머리글을 볼 것.
 *
 * **레벨업**: 상태 21 은 `0` 키, 상태 28(`mode="레벨업"`, 스페셜 마선수 선택)은 OK·`0` 키로
 * 레벨업 창 `widgets/ace-level-up` 을 연다 (`requestLevelUp` 머리글). 바닥띠 517 = "0레벨업" + 되돌아가기.
 *
 * ⚠️ 여기 없는 것:
 *   - 바닥띠의 "0레벨업" 그림(프레임 9) — `ScreenFrame` 이 되돌아가기만 그린다.
 *   - 상태 28 의 위/아래 키(−1·−2·'2'·'8')가 뒤집는 `skin+0xd0` — A 딱지를 안 그리는 k 11 에선 보이는 것이 없다.
 *   - 열린 마선수 자리의 애니메이션 `[skin+0x138]` — 여기서는 정지 그림을 쓴다.
 */
export function AceSelectScreen({
  phase,
  openedAcePitcherIds = [],
  openedAceBatterIds = [],
  levels,
  mode = '고르기',
  gamePoint = 0,
  chosenPitcherCell = null,
  onOpenAce,
  onLevelUp,
  onSelect,
  onCancel,
  underlay,
  overlay,
  onAllAcesOpen,
  panel,
}: AceSelectScreenProps) {
  const imgTextOrigins = useFrameOrigins(IMG_TEXT_FRAME)
  // 마투수 단계는 윗줄에서, 마타자 단계는 아랫줄에서 커서가 시작한다 (원본이 OK 뒤 커서를 내린다)
  const [cursor, setCursor] = useState(phase === ACE_PHASE.마투수 ? 0 : ACE_PER_ROLE)
  /** 오픈 힌트 팝업이 뜬 칸 (0xa68e~0xa6dc). null 이면 안 뜬 것 */
  const [hintCell, setHintCell] = useState<number | null>(null)
  /** G가 모자라 뜬 부족 팝업 (0xa46e → 0xaa00, 팝업 id 0x20) */
  const [isShortageOpen, setIsShortageOpen] = useState(false)
  /** 레벨업 창이 열린 칸 — `skin+0x31c`(열림)·`+0x31d`(칸). null 이면 닫힘 */
  const [levelUpCell, setLevelUpCell] = useState<number | null>(null)
  /** StrCOMMON[40] "최고 레벨입니다" 알림 */
  const [isMaxLevelOpen, setIsMaxLevelOpen] = useState(false)
  const isLevelUpMode = mode === '레벨업'
  const isCoachMode = mode === '코치'

  useCursorFollowsPhase(phase, chosenPitcherCell, setCursor)

  const isEveryAceOpen = isEveryAceOpenOf(openedAcePitcherIds, openedAceBatterIds)
  // 머리띠가 미끄러지는 동안은 본문이 없고, 본문 첫 그림에 지은 격자가 열림 애니(0x79fa8)를 다 돌 때까지 키 함수가
  // [skin+0xe4] == 0 을 보고 아무것도 안 한다 (`useListPageEntry`). 마선수 격자는 시작 0x7a005(격자, 1, 1, 1)이라 애니가 늘 돈다(0x64834)
  const { keyLock, grid: gridOpen } = useListPageEntry({ grid: { shape: ACE_GRID_OPEN, isAnimated: true } })
  // 커서 튕김 — 시작 0x7a005(격자, 1, 1, 1) 의 셋째 인자 [격자+6] = 1 (`useGridCursorBounce`)
  const bounce = useGridCursorBounce()
  // 격자 커서 깜빡임 [격자+0x18] — 시작 0x7a005 가 0 으로 두고(0x7a01e) 그릴 때마다 끝에서 +1(0x7b490) → 본문 몇째 그림인가와 같다.
  // 커서 칸 그리기 0x7b3a0 은 열림 애니가 끝났고([격자+9]) 깜빡임이 켜졌을 때만 돈다(0x7b3a2 · 0x7b3c6)
  const isGridCursorOn = gridOpen !== null && gridOpen.state.isDone && isAceGridCursorOn(gridOpen.blink)

  // 0x7b408 은 커서 칸 그리기(종류 7) 안이라 커서가 그려지는 그림에서만 돈다
  useAllAcesOpenNotice(isEveryAceOpen && isGridCursorOn, onAllAcesOpen)

  const isCellOpen = (cell: number) => isAceCellOpen(cell, openedAcePitcherIds, openedAceBatterIds)
  const isCellReachable = (cell: number) => isAceCellReachable(cell, mode, phase)
  // 팝업 · 창이 떠 있으면 격자는 키를 받지 않는다 — MessageBox 가 답을 가져간다
  const isGridBlocked =
    hintCell !== null || isShortageOpen || isMaxLevelOpen || levelUpCell !== null || (overlay !== undefined && overlay !== null && overlay !== false)

  /**
   * **레벨업 요청** — 상태 21 의 `0` 키(0x29efc `cmp r5,#0x30`) · 상태 28 의 OK·`0` 키(0x2b00a·0x2affc).
   * 두 갱신 함수가 같은 순서로 판정한다 (0x29f02~0x29fbc · 0x2b02c~0x2b124):
   *   1. 잠긴 칸(`mgr[0x30+칸] == 0`) → 오픈 힌트 팝업 (칸 4·9 는 [42], 그 밖 [43]) — 오픈과 같은 길
   *   2. 레벨 > 3 → StrCOMMON[40] "최고 레벨입니다" 알림
   *   3. 그 밖 → 레벨업 창 열기 (+0x31c = 1, +0x31d = 칸)
   * 상태 21 의 잠긴 칸 팝업은 원본도 단계와 상관없이 뜬다 (0x29f34 가 줄을 안 본다).
   */
  const requestLevelUp = (cell: number) => {
    if (onLevelUp === undefined) return
    if (!isCellOpen(cell)) return setHintCell(cell)
    if (isAceMaxLevel(aceLevelOf(levels, cell))) return setIsMaxLevelOpen(true)
    setLevelUpCell(cell)
  }

  /**
   * OK 한 번 — 열린 칸이면 고르고, **잠긴 칸이면 오픈 힌트 팝업**을 띄운다 (0xa248 → 0xa68e).
   * 지금 단계의 줄만 고를 수 있고 팝업도 그 줄에서만 띄운다(OK 를 받는 줄이 거기뿐이다). 상태 28 은 고르기가 없고 OK 가 레벨업 쪽이다.
   * 코치채용(0xa79c → 0xa880)은 두 줄 모두 열린 칸이면 고르고 잠긴 칸이면 힌트다.
   */
  const pressCell = (cell: number) => {
    if (isLevelUpMode) return requestLevelUp(cell)
    if (isCellReachable(cell) && isCellOpen(cell)) return onSelect(cell)
    if (isCellReachable(cell)) setHintCell(cell)
  }

  /**
   * **칸 탭** (웹 터치 길 — 원본은 키패드뿐): 커서가 아닌 칸이면 커서만 그 칸으로 옮기고(이름 막대 · ABILITY 판 · '0레벨업' 이
   * 그 칸을 본다), 커서 칸을 다시 누르면 OK 한 번이다 — 열린 칸은 고르고, 잠긴 칸은 오픈 힌트 · G 구매 팝업이 뜬다.
   */
  const tapCell = (cell: number) => {
    if (keyLock.current || !isCellReachable(cell) || isGridBlocked) return
    if (cell !== cursor) return setCursor(cell)
    pressCell(cell)
  }

  useAceGridKeys(keyLock, isGridBlocked, mode, cursor, bounce.start, setCursor, pressCell, requestLevelUp, onCancel)

  return (
    <RawScreen>
      {underlay}
      {gridOpen !== null && (
        <>
          <AceCursorInfo
            cursor={cursor}
            cursorLevel={aceLevelOf(levels, cursor)}
            isCursorOpen={isCellOpen(cursor)}
            isCoachMode={isCoachMode}
            imgTextOrigins={imgTextOrigins}
          />
          <AceGrid
            mode={mode}
            phase={phase}
            cursor={cursor}
            chosenPitcherCell={chosenPitcherCell}
            openState={gridOpen.state}
            bounceOffset={bounce.offset}
            isGridCursorOn={isGridCursorOn}
            isCellOpen={isCellOpen}
            isCellReachable={isCellReachable}
            onTapCell={tapCell}
          />
        </>
      )}

      {panel?.(cursor)}

      {/* 원본에 없던 웹 키 안내 글("…를 고르세요 — 방향키 이동 · Enter 결정")은 걷었다 */}

      {/* 머리띠(제목 8 "마선수선택")·바닥띠 — 원본 공용 목록 k 2 도 이 둘을 얹는다 (P6 1-1 · 2a-5) */}
      {/* 바닥띠의 "되돌아가기" 가 원본 소프트키다 — 따로 두었던 버튼은 없앴다 (스테이지 (0,0) 에 떨어져 있었다) */}
      {/* 바닥 0x205 = 가운데 "0레벨업" + 되돌아가기 — 일반모드 0x2df78 · 0x2dfe0, 시즌 0xaa24(선수단 [+0x11c] ≠ 2) 모두 */}
      {/* 코치채용(this+0x11c == 2)은 0x54d95(skin, 4, 5) — 되돌아가기만 (0xad94~0xada0) */}
      {/* 바닥띠 "0레벨업" 표시 = '0' 키 — 그 표시 위 투명 누름 칸(키 처리가 팝업 · 잠금을 그대로 본다) */}
      <ScreenFrame
        title="마선수선택"
        gamePoint={gamePoint}
        onBack={onCancel}
        footer={isCoachMode ? 5 : 0x205}
        footerPresses={{
          [FOOTER_BITS.levelUp]: { label: '0 레벨업', onPress: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: '0' })) },
        }}
      />

      <AceSelectPopups
        hintCell={hintCell}
        isShortageOpen={isShortageOpen}
        isMaxLevelOpen={isMaxLevelOpen}
        levelUpCell={levelUpCell}
        levels={levels}
        gamePoint={gamePoint}
        onLevelUp={onLevelUp}
        onOpenAce={onOpenAce}
        setHintCell={setHintCell}
        setIsShortageOpen={setIsShortageOpen}
        setIsMaxLevelOpen={setIsMaxLevelOpen}
        setLevelUpCell={setLevelUpCell}
      />
      {overlay}
    </RawScreen>
  )
}
