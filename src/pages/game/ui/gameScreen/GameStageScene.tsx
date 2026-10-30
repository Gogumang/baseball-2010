import type { RefObject } from 'react'
import { RawScreen } from '@/shared/ui'
import * as stageScreen from '@/features/play-game/ui/stageScreen.css'
import type { StageWarmCast } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { InGameMenuState } from '@/features/play-team-game/model/useInGameMenuState'
import type { SubstitutionScenePlayback } from '@/features/play-game/model/useSubstitutionScene'
import type { SceneConfirm } from '@/features/play-game/model/useSceneConfirm'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import { GameBattingStage } from './GameBattingStage'
import { GameMenuLayer } from './GameMenuLayer'
import type { GameScreenProps, MenuOverlay } from './gameScreenProps'
import { GameStageOverlays } from './GameStageOverlays'
import { GameStagePressAreas } from './GameStagePressAreas'
import { HelpScreen, SettingsScreen } from './otherSlices'

interface GameStageSceneProps {
  /** 경기 화면이 받은 값 */
  readonly props: GameScreenProps
  readonly menu: InGameMenuState
  readonly overlay: MenuOverlay | null
  readonly setOverlay: (overlay: MenuOverlay | null) => void
  /** 경기 중 메뉴 · 그 하위(조작방법 · 설정)가 떠 있다 — 팝업 관리자 [0x140005c]+9 */
  readonly isPopupShown: boolean
  readonly sceneConfirm: SceneConfirm
  readonly substitution: SubstitutionScenePlayback
  readonly stealableBases: readonly StealBase[]
  readonly stealIfFlying: (base: StealBase, event?: Event) => void
  readonly warmCast: StageWarmCast
  readonly flightProbeRef: RefObject<(() => boolean) | null>
}

/** 타석 장면 — 타석 캔버스와 그 위 덧그림 · 누름 칸 · 경기 중 메뉴, 메뉴 하위 화면(조작방법은 얹고 설정은 바꿔 띄운다) */
export function GameStageScene(sceneProps: GameStageSceneProps) {
  const { props, menu, overlay, setOverlay, isPopupShown, sceneConfirm, substitution, stealableBases, stealIfFlying, warmCast, flightProbeRef } =
    sceneProps
  const { settings, onSettingsChange } = props
  const canChangeSettings = settings !== undefined && onSettingsChange !== undefined
  const reopenMenu = () => {
    // 하위 화면을 닫으면(조작방법 0x3ca36: 0x637d0 ≠ 0 · 설정 CLR 0x3cb0e) 하위 0 으로 돌아가 일시정지 팝업 0x741a0 을 다시 띄운다 —
    // 경기 중 메뉴로, 메뉴 객체는 안 건드려 커서가 그대로다
    setOverlay(null)
    menu.reopen()
  }
  // 경기 중 메뉴의 "설정"(0x3c326). "조작방법"(0x3c212)은 아래에서 경기 장면 위에 얹는다
  if (overlay === '설정' && canChangeSettings) {
    return <SettingsScreen settings={settings} onChange={onSettingsChange} onResetCareer={() => {}} onBack={reopenMenu} />
  }
  return (
    <>
      <RawScreen>
        {/* 타석 캔버스 — RawScreen 판 (0, 0) 에 맞춘다(`stageScreen.css`) */}
        <div className={stageScreen.canvasSlot}>
          <GameBattingStage
            props={props}
            warmCast={warmCast}
            // 조작방법 뷰어 동안도 일시정지 팝업이 떠 있어 경기 갱신이 멈춘다 (0x52cc6 0x754f9)
            // 0xe(OK 대기)에서도 공이 안 나간다 — 타석 장면(0xd 그리기)만 선다
            isPaused={props.isPaused || isPopupShown || sceneConfirm.isAwaiting}
            // 좌우 이동 +0xfe4 는 0xd 진입 48f88 에서만 지운다 — 같은 타석의 다음 공(0xf)과 결과 연출 동안은 남는다(A-02)
            shiftResetSerial={sceneConfirm.sceneDEntryMark}
            flightProbeRef={flightProbeRef}
          />
        </div>
        <GameStageOverlays
          progress={props.progress}
          career={props.career}
          burstRow={props.burstRow}
          sceneConfirm={sceneConfirm}
          substitution={substitution}
          recordAlert={props.recordAlert}
          isMenuOpen={menu.isOpen}
        />
        <GameStagePressAreas
          sceneConfirm={sceneConfirm}
          isMenuOpen={menu.isOpen}
          stealableBases={stealableBases}
          stealIfFlying={stealIfFlying}
          onMenu={menu.pressStar}
        />
        <GameMenuLayer menu={menu} onQuit={props.onQuit} canChangeSettings={canChangeSettings} setOverlay={setOverlay} />
      </RawScreen>
      {overlay === '조작방법' && <HelpScreen onBack={reopenMenu} />}
    </>
  )
}
