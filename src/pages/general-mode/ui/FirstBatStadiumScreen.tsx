import { RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import type { PlayerSide } from '@/entities/game/model/gameState'
import { isPrepareBobOn } from '@/pages/general-mode/lib/prepareLayout'
import { FIRST_BAT_PHASE } from '@/pages/general-mode/lib/generalModeSetup'
import type { FirstBatPhase } from '@/pages/general-mode/lib/generalModeSetup'
import { GAME_UI_FRAME, IMG_TEXT_FRAME } from './firstBatStadiumScreen/firstBatFigure'
import { FirstBatTeams } from './firstBatStadiumScreen/FirstBatTeams'
import { SkinBackdrop } from './firstBatStadiumScreen/otherSlices'
import { StadiumPanel } from './firstBatStadiumScreen/StadiumPanel'
import { useFirstBatStadiumKeys } from './firstBatStadiumScreen/useFirstBatStadiumKeys'

export interface FirstBatStadiumScreenProps {
  readonly userTeamId: number
  readonly aiTeamId: number
  /** 상태 20 의 하위 단계 `skin+0xcc` — 선공을 먼저 고른다 */
  readonly phase: FirstBatPhase
  readonly playerSide: PlayerSide
  readonly stadiumId: number
  /** 머리띠 G포인트 — 들고 있는 곳에서만 넘긴다 (팀 고르기 화면과 같은 규칙) */
  readonly gamePoint?: number
  /** 선공 커서 `skin+0x74` 만 뒤집을 때 */
  readonly onMoveFirstBat: (side: PlayerSide) => void
  readonly onChooseFirstBat: (side: PlayerSide) => void
  readonly onChooseStadium: (stadiumId: number) => void
  /** 구장 단계에서 커서만 옮길 때 (원본은 커서가 곧 `rec+0xc` 다) */
  readonly onMoveStadium: (stadiumId: number) => void
  readonly onCancel: () => void
}

/**
 * **선공/구장** — 메인 메뉴 하위 상태 **20**, 공용 목록 `0x63b15` 의 **k = 3**
 * (진입 0x23ed0 · 갱신 0x2896c · 그리기 0x640e2. P6 2a-4 좌표 확정 · R4 3a 키 확정).
 *
 * 한 화면에서 두 단계를 돈다:
 *   - 단계 0 **선공**: 좌·우로 뒤집고 OK 면 `rec+8` 에 적는다 (0 유저 선공 · 1 유저 후공)
 *   - 단계 1 **구장**: 구장 0~9 를 좌·우로 넘기고 OK 면 `rec+0xc` 에 적고 마선수 단계로
 *
 * ⚠️ 구장 목록은 **0~9 열 칸뿐**이다(히든 구장 없음). 빠른실행이 구장을 "유저 팀 번호" 로 넣기
 *    때문에 유저 팀이 히든(10~14)이면 여기 없는 번호가 들어올 수 있다 — 원본이 자르지 않으므로
 *    그림은 빈칸, 좌석 줄은 스택 옆 칸(연고지 포인터 값)을 숫자로 찍는다 (`stadiumInfoOf`).
 */
export function FirstBatStadiumScreen(props: FirstBatStadiumScreenProps) {
  const { userTeamId, aiTeamId, phase, playerSide, stadiumId, onChooseFirstBat, onMoveStadium, onChooseStadium, onCancel } = props
  const gameUiOrigins = useFrameOrigins(GAME_UI_FRAME)
  const imgTextOrigins = useFrameOrigins(IMG_TEXT_FRAME)
  const isStadiumPhase = phase === FIRST_BAT_PHASE.구장
  useFirstBatStadiumKeys({ ...props, isStadiumPhase })
  // 공용 목록 깜빡 [sp+0xd4] — 꼬리표 2px · 고른 쪽 원 · 구장 막대 칠 · 화살 (0x63b4a)
  const isBob = isPrepareBobOn(useUpdateCounter())

  return (
    <RawScreen>
      {/* 그림 0x2dd30 은 맨 앞에서 공 무늬 바탕 0x5fd61(skin, 0, 0, W, H) 을 깐다 (0x2dd62) */}
      <SkinBackdrop kind="공무늬" />
      <FirstBatTeams
        userTeamId={userTeamId}
        aiTeamId={aiTeamId}
        playerSide={playerSide}
        isStadiumPhase={isStadiumPhase}
        isBob={isBob}
        imgTextOrigins={imgTextOrigins}
        onChooseFirstBat={onChooseFirstBat}
      />
      <StadiumPanel
        stadiumId={stadiumId}
        isStadiumPhase={isStadiumPhase}
        isBob={isBob}
        gameUiOrigins={gameUiOrigins}
        imgTextOrigins={imgTextOrigins}
        onMoveStadium={onMoveStadium}
        onChooseStadium={onChooseStadium}
      />
      {/* 머리띠(제목 4 "선공/구장")·바닥띠 — 원본 공용 목록 k 3 도 이 둘을 얹는다 (P6 1-1 · 2a-4) */}
      {/* 바닥띠의 "되돌아가기" 가 원본 소프트키다 — 따로 두었던 버튼은 없앴다 (스테이지 (0,0) 에 떨어져 있었다) */}
      <ScreenFrame title="선공/구장" gamePoint={props.gamePoint ?? 0} onBack={onCancel} />
    </RawScreen>
  )
}
