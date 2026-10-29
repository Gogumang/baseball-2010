import type { ReactElement } from 'react'
import { PressArea } from '@/shared/ui'
import { pushSceneKey } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import { inputTimeOf } from '@/shared/lib/sceneKeyLatch/shownSceneTicks'
import { MENU_PRESS_RECT, TIME_PRESS_RECT, stealPressRectOf } from '@/features/play-game/model/stagePressAreas'
import { SceneCloudCountingSpan } from '@/widgets/batting-stage/model/useSceneCloudCountingSpan'
import { playerDetailOf, substitutionRowsOf } from '@/pages/team-game/lib/substitutionWindow'
import { SubstitutionWindow } from '@/pages/team-game/ui/SubstitutionWindow'
import { PressLayer } from './otherSlices'
import type { TeamGameSceneModel } from './useTeamGameSceneModel'

/** 0xe — OK 하나만 받는다 (0x532b0). 원본 화면에 글자는 없다 — 마우스 길로 판 전체를 누름 칸으로 */
export function renderConfirmPress(model: TeamGameSceneModel, isPopupOpen: boolean): ReactElement | false {
  const { sceneConfirm, isAwaitingConfirm } = model.confirmFlow
  return (
    isAwaitingConfirm &&
    !isPopupOpen &&
    model.change.changeWindow === null && (
      <PressLayer testId="확인 누름 칸">
        <PressArea label="확인" onPress={sceneConfirm.confirm} isDisabled={!sceneConfirm.acceptsConfirm} />
      </PressLayer>
    )
  )
}

/** 도루 누름 칸이 서는가 — 사람 타석 · 0xe 대기 · 팝업 · 교체 창 밖, 출발시킬 주자가 있을 때 */
const isStealPressShown = (model: TeamGameSceneModel, isPopupOpen: boolean) =>
  model.props.session.canBat &&
  !model.confirmFlow.isAwaitingConfirm &&
  !isPopupOpen &&
  model.change.changeWindow === null &&
  model.props.session.stealableBases.length > 0

/** 도루 '3'·'2'·'1' — 원본은 키뿐이라 점수판 루 그림 자리를 빌린다 (공이 나는 0x11 에만 먹는다) */
export function renderStealPress(model: TeamGameSceneModel, isPopupOpen: boolean): ReactElement | false {
  const { session } = model.props
  const { flightProbeRef } = model.scoped
  return (
    isStealPressShown(model, isPopupOpen) && (
      <PressLayer testId="도루 누름 칸">
        {session.stealableBases.map((base) => (
          <PressArea
            key={base}
            label={`도루 ${base}루`}
            rect={stealPressRectOf(base)}
            onPress={(event) => {
              // 키와 같은 길 — 칸에 받은 틱은 손가락 · 마우스가 닿은 시각에 본 그림의 틱(`PressArea`, r222)
              pushSceneKey(
                () => {
                  if (flightProbeRef.current?.() === true) session.actions.steal(base)
                },
                'press',
                inputTimeOf(event),
              )
            }}
          />
        ))}
      </PressLayer>
    )
  )
}

/** `#` 교체 창(상태 0xb) — 수비 중이면 투수 교체, 공격 중이면 대타 */
export function renderSubstitutionWindow(model: TeamGameSceneModel): ReactElement | false {
  const { options, matchupRecords, session } = model.props
  const { changeWindow, setChangeWindow, closeChangeWindow } = model.change
  if (changeWindow === null) return false
  const { progress, actions } = session
  const rows = substitutionRowsOf(progress, changeWindow, changeWindow === '투수' ? session.benchPitchers : session.benchBatters, matchupRecords)
  return (
    <SubstitutionWindow
      kind={changeWindow}
      ourTeamId={options.ourTeamId}
      current={rows.current}
      bench={rows.bench}
      detailOf={(index) => playerDetailOf(progress, changeWindow, index)}
      onConfirm={(benchIndex) => {
        // 0x16 진입 0x3d458 의 0x668cc(스킨, 공격 팀, 0)는 진행기가 연출(`substitutionScene.cheerRestore`)에 싣는다
        if (changeWindow === '투수') actions.changePitcher(benchIndex)
        else actions.pinchHit(benchIndex)
        setChangeWindow(null)
      }}
      onCancel={closeChangeWindow}
    />
  )
}

/** 교체 창 0xb 도 원본이 구름을 센다 (Q-08) */
export function renderChangeWindowClouds(model: TeamGameSceneModel): ReactElement | false {
  return model.change.changeWindow !== null && <SceneCloudCountingSpan />
}

/**
 * 소프트키 — 장면이 그리는 "*MENU" · "#TIME" 글자 자리(0x4c8e0 · `softKeyLabels`)의 누름 칸. '*' 는 0x498d4 가 경기 중 메뉴로
 * (소프트키1 도 '*' 로 읽는다, 498e8 — 교체 창 0xb 에서는 안 먹는다), '#' 는 0xe · 0xf 에서 교체 창(수비 중 투수 · 공격 중 대타)
 */
export function renderSoftKeys(model: TeamGameSceneModel): ReactElement | false {
  const { menu, isMenuOpen, overlay } = model.sceneMenu
  const { session } = model.props
  const { changeWindow, setChangeWindow } = model.change
  if (overlay === '조작방법') return false
  return (
    <PressLayer testId="소프트키 누름 칸" isOnTop>
      <PressArea
        rect={MENU_PRESS_RECT}
        label={isMenuOpen ? '닫기' : '메뉴'}
        onPress={menu.pressStar}
        isDisabled={changeWindow !== null && !isMenuOpen}
      />
      {model.acceptsChangeKey && (
        <PressArea
          rect={TIME_PRESS_RECT}
          label={session.canChangePitcher ? '# 교체' : '# 대타'}
          onPress={() => setChangeWindow(session.canChangePitcher ? '투수' : '대타')}
        />
      )}
    </PressLayer>
  )
}
