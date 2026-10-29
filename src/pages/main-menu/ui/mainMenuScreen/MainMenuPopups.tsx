import { GENERAL_MODE_PROMPT, NARI_EDITION_PROMPT, NEW_GAME_CONFIRM } from '@/shared/config/original/mainMenu'
import { MessageBox } from '@/shared/ui/MessageBox/MessageBox'
import { FOOTER_BACK_PRESS_RECT } from '@/shared/ui/PressArea/pressRect'
import type { MainMenuState } from '@/pages/main-menu/model/mainMenu'

/**
 * 일반모드 [13] 버튼 — 띄운 쪽이 `0x74ea9(창, 고른 그림, 보통 그림, 0)` 로 하나씩 넣는다 (0x29782~0x297d8).
 * 고른 그림 = popup 이미지 표 +0x24/+0x20/+0x28 → 프레임 9·8·10 (67×23), 보통 = +0x10/+0xc/+0x14 → 4·3·5 (59×15).
 */
const GENERAL_MODE_BUTTONS = ['이어하기', '새로하기', '빠른실행'] as const
const GENERAL_MODE_BUTTON_FRAMES = [
  { normal: 4, selected: 9 },
  { normal: 3, selected: 8 },
  { normal: 5, selected: 10 },
] as const
/** 격자 1열×3행(종류 0x10 인자 1, 3 — 0x297a0 · 0x753f4) · 간격 0x74805(창, 0, 5) */
const GENERAL_MODE_GRID = { columns: 1, gapX: 0, gapY: 5 } as const
/** CLR(−16) → 답 −1 (0x29760~0x2977c 가 창 키 표에 넣는다) → 상태 5 */
const GENERAL_MODE_CANCEL = -1
/** [15] 의 처음 커서 — 0x749d5(창, 1) = [아니오] (0x298f2 · 0x2998c) */
const NEW_GAME_CONFIRM_CURSOR = 1

/**
 * 나만의리그 [14] 버튼 (진입 0x25d78): 0 타자편 고른 13 / 보통 11 (이미지 표 +0x34/+0x2c) · 1 투수편 14 / 12 (+0x38/+0x30).
 * 격자 2열×1행(종류 0x10 인자 2, 1) · 간격 0x74805(창, 0x3c, 0) · CLR → −1. 처음 커서는 0(0x749d5 를 안 부른다).
 */
const NARI_EDITION_BUTTONS = ['타자편', '투수편'] as const
const NARI_EDITION_BUTTON_FRAMES = [
  { normal: 11, selected: 13 },
  { normal: 12, selected: 14 },
] as const
const NARI_EDITION_GRID = { columns: 2, gapX: 0x3c, gapY: 0 } as const
/** CLR(−16) → −1 (0x25dc2~0x25df2 가 창 키 표에 넣는다) → 상태 5 */
const NARI_EDITION_CANCEL = -1

/** 메뉴 위 창 — 잠긴 칸 안내 · 나만의리그 편 고르기 [14] · 일반모드 진입 [13] · 새로하기 확인 [15] */
export function MainMenuPopups({
  state,
  onCloseNotice,
  onAnswer,
}: {
  readonly state: MainMenuState
  /** 안내의 OK — 원본은 아무 키나 받아 닫는다 */
  readonly onCloseNotice: () => void
  readonly onAnswer: (answer: number) => void
}) {
  return (
    <>
      {/* 잠긴 칸 안내 — 원본 확인 팝업 0x74ef5 종류 1(OK 하나). 바닥 판 글칸에 웹 단추를 얹던 근사를 걷고 공용 상자로 띄운다 */}
      {state.lockedNotice !== null && <MessageBox text={state.lockedNotice} buttons={['OK']} onAnswer={onCloseNotice} />}

      {/* 나만의리그 편 고르기 창 [14] — 하위 13 */}
      {state.isPickingNariEdition && (
        <MessageBox
          text={NARI_EDITION_PROMPT}
          buttons={NARI_EDITION_BUTTONS}
          buttonFrames={NARI_EDITION_BUTTON_FRAMES}
          grid={NARI_EDITION_GRID}
          cancelAnswer={NARI_EDITION_CANCEL}
          cancelPressRect={FOOTER_BACK_PRESS_RECT}
          onAnswer={onAnswer}
        />
      )}

      {/* 일반모드 진입 창 — 하위 12 그리기도 게임시작 목록 위에 상자를 얹는다 */}
      {state.generalModeWindow?.kind === '진입' && (
        <MessageBox
          text={GENERAL_MODE_PROMPT}
          buttons={GENERAL_MODE_BUTTONS}
          buttonFrames={GENERAL_MODE_BUTTON_FRAMES}
          grid={GENERAL_MODE_GRID}
          cancelAnswer={GENERAL_MODE_CANCEL}
          // CLR(−1)을 내는 단추가 창에 없다 — 창 뒤 바닥띠 되돌아가기 표시(아랫단 바닥 5) 자리 투명 칸이 CLR 을 낸다 (r192 터치 점검)
          cancelPressRect={FOOTER_BACK_PRESS_RECT}
          initialSelected={state.generalModeWindow.initialSelected}
          onAnswer={onAnswer}
        />
      )}
      {state.generalModeWindow?.kind === '새로하기확인' && (
        // 종류 0x82 = 예/아니오 (0x82 & 0x1f = 2). CLR 은 1(아니오) 로 넣는다 (0x298e0~0x298ea) — 상자 기본값과 같다
        <MessageBox text={NEW_GAME_CONFIRM} buttons={['예', '아니오']} initialSelected={NEW_GAME_CONFIRM_CURSOR} onAnswer={onAnswer} />
      )}
    </>
  )
}
