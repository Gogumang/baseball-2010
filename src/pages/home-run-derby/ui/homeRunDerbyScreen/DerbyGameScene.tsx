import type { Dispatch, SetStateAction } from 'react'
import * as stageScreen from '@/features/play-game/ui/stageScreen.css'
import type { InGameMenuState } from '@/features/play-team-game/model/useInGameMenuState'
import type { HomeRunDerbySession } from '@/pages/home-run-derby/model/useHomeRunDerby'
import { derbyFieldShotsAt } from '@/pages/home-run-derby/lib/derbyField'
import { DerbyResultWindow } from '@/pages/home-run-derby/ui/DerbyResultWindow'
import { gameSceneTickOf } from '@/shared/lib/commonWindow/commonWindow'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { batterSideOfForm } from '@/widgets/batting-stage/lib/stageLayout'
import { DerbyBattingStage } from './DerbyBattingStage'
import { DerbyFieldLayer } from './DerbyFieldLayer'
import { DerbyHudLayer } from './DerbyHudLayer'
import { DerbyMenuLayer } from './DerbyMenuLayer'
import { DerbyPressAreas } from './DerbyPressAreas'
import type { HomeRunDerbyScreenProps, MenuOverlay } from './derbyScreenProps'
import { derbyMatchupBatterOf, derbyStageBatterOf } from './derbyStageBatter'
import { HelpScreen } from './otherSlices'
import type { useDerbySceneKeys } from './useDerbySceneKeys'

/**
 * **경기 장면 판** — 필드 화면(판 0x17) · 타석 캔버스 · 결과 창 또는 HUD · 소개 판 · 누름 칸 · 경기 중 메뉴, 그리고 그 위의 조작방법 뷰어.
 * 결과 창의 "예"(재도전)와 경기 중 메뉴의 다시하기는 경기 장면 0x104 를 새로 세운다 — 타석 캔버스도 새로 띄운다(`onNewStage`)
 */
export function DerbyGameScene({
  props,
  session,
  menu,
  tick,
  overlay,
  setOverlay,
  stageSerial,
  onNewStage,
  sceneKeys,
  onReopenMenu,
}: {
  readonly props: HomeRunDerbyScreenProps
  readonly session: HomeRunDerbySession
  readonly menu: InGameMenuState
  readonly tick: number
  readonly overlay: MenuOverlay | null
  readonly setOverlay: Dispatch<SetStateAction<MenuOverlay | null>>
  readonly stageSerial: number
  readonly onNewStage: () => void
  readonly sceneKeys: ReturnType<typeof useDerbySceneKeys>
  readonly onReopenMenu: () => void
}) {
  const stageBatter = derbyStageBatterOf(session.batter, props)
  const batterSide = batterSideOfForm(stageBatter.form ?? 0)
  const board = session.distanceBoard
  const isResultShown = session.result !== null
  return (
    <>
      <RawScreen>
        <DerbyFieldLayer session={session} />
        <div className={stageScreen.canvasSlot}>
          <DerbyBattingStage
            key={stageSerial}
            session={session}
            batter={stageBatter}
            aceLevels={props.aceLevels}
            settings={props.settings}
            random={props.random}
            isOverlayShown={overlay !== null}
            fieldPlayShotsAt={(sceneTick) =>
              // 필드 화면의 공 그리기 0x36dfc 가 장면 틱 그림에 쏘는 파티클 — 타석 캔버스 루프가 그 틱 프레임에 쏜다
              board === null ? [] : derbyFieldShotsAt(board.field.input, board.field.timeline, sceneTick - gameSceneTickOf(board.startedAt))
            }
          />
        </div>
        {session.result !== null ? (
          <DerbyResultWindow
            result={session.result}
            heldGamePoint={props.gamePoint}
            onRetry={() => {
              onNewStage()
              session.retryFromResult()
            }}
            onExit={props.onExit}
          />
        ) : (
          <DerbyHudLayer
            session={session}
            bestDistance={props.bestDistance}
            tick={tick}
            batterSide={batterSide}
            matchupBatter={derbyMatchupBatterOf(session.batter, session.modeBatterPosition, props.matchupBatter)}
          />
        )}
        {/* 웹 제목줄("홈런더비")은 걷었다 — 원본 240×320 장면 한 장뿐이고 공 번호는 HUD 0x45a54 가 그린다 */}
        <DerbyPressAreas isMenuOpen={menu.isOpen} isResultShown={isResultShown} sceneKeys={sceneKeys} onToggleMenu={menu.toggle} />
        {menu.isOpen && !isResultShown && (
          <DerbyMenuLayer
            menu={menu}
            canOpenSettings={props.settings !== undefined && props.onSettingsChange !== undefined}
            onQuit={props.onExit}
            onRestart={() => {
              onNewStage()
              session.restart()
            }}
            onOpenOverlay={setOverlay}
          />
        )}
      </RawScreen>
      {overlay === '조작방법' && <HelpScreen onBack={onReopenMenu} />}
    </>
  )
}
