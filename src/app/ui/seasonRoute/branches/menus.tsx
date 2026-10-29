import type { ReactNode } from 'react'
import { SeasonManagementScreen, SeasonOutingScreen, SeasonTeamMenuScreen, SeasonTrainingScreen, SeasonScreenFade } from '@/pages/season'
import { fillModeText } from '@/widgets/season/lib/seasonText'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { TEAMS } from '@/shared/config/original/teams'
import { MessageBox, RawScreen } from '@/shared/ui'
import { SeasonOutingMap } from '@/pages/season/ui/SeasonOutingMap'
import { SeasonOutingPopup } from '@/pages/season/ui/SeasonOutingPopup'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import type { SeasonBranchInput } from '@/app/ui/seasonRoute/branchInput'

/**
 * 관리 메뉴 진입 0x5044~0x505e — 이 이전 상태([this+0x28])에서 오면 0x8a2d8 로 가운데 판을 오른쪽에서 미끄러뜨린다.
 * 원본 표는 1 · 0xd3 · 0xcb · 0xf5 · 0xf1 다섯이다. 새 시즌은 원본이 0xca → 0xc8 → 0xcc → **0xcb** → 0xc9 로 가
 * 이전이 0xcb 지만, 웹은 0xc8·0xcc·0xcb 를 상태로 두지 않고 0xca 에서 곧장 0xc9 로 온다 — 그래서 0xca 를 0xcb 자리로 넣는다
 * (0xca 에서 0xc9 로 오는 다른 길은 없다: 취소는 장면을 나간다).
 */
const CENTER_SLIDE_FROM: readonly number[] = [
  1,
  SEASON_SCENE_STATE.이벤트재생,
  SEASON_SCENE_STATE.진입분기,
  SEASON_SCENE_STATE.엔딩,
  SEASON_SCENE_STATE.경기뒤마무리,
  SEASON_SCENE_STATE.팀고르기,
]

export function managementMenuBranch({
  scene,
  state,
  session,
  actions,
  onExit,
  previousScene,
  isEndingFadeIn,
  setEndingFadeIn,
}: SeasonBranchInput): ReactNode {
  if (scene !== SEASON_SCENE_STATE.관리메뉴) return null
  const request = session.tradeRequest
  return (
    <>
      <SeasonManagementScreen
        state={state}
        // 0xec10 — StrMODE[203] "[%s] 팀에서 트레이드 요청이 왔습니다 확인 하시겠습니까?", %s = 팀 이름([this+0x158])
        alert={
          session.isTradeRequestAlertOpen
            ? { text: fillModeText(ORIGINAL_MODE_TEXT[203] ?? '', TEAMS[request.opponentTeamId]?.name ?? ''), onAnswer: actions.answerTradeRequest }
            : null
        }
        // 메뉴 객체 this+0x70 의 커서 — 장면이 사는 동안 이어진다 (요청 "예" 는 칸 1 로 옮긴다)
        cursor={session.menuCursors.management}
        onCursorChange={(index) => actions.moveMenuCursor('management', index)}
        onSelect={(item, target) => {
          // 관리 메뉴 칸 5 → 0xd8 다음경기 (점프표 0xcbe40). 경기는 그 화면의 확인에서 시작한다
          if (item === '다음경기') return actions.openNextGame()
          actions.goto(target)
        }}
        onConfirmKey={actions.pressManagementConfirm}
        // 관리 메뉴 키 0x8f30 의 취소(−16) 8f5a~8f6e: 0x375d · [0x140006c] = 5 · 장면 0x103 — 게임시작 목록으로 바로 연다
        onExit={() => onExit(5)}
        gamePoint={session.gamePoints}
        centerSlidesIn={previousScene === null || CENTER_SLIDE_FROM.includes(previousScene)}
      />
      {/* 엔딩을 넘긴 0x8bd8 8d1e~8d2c 의 효과기 종류 2(검정에서 밝아짐) — 0xc9 위에서 아홉 틀, 그동안 키가 안 먹는다 */}
      {isEndingFadeIn && <SeasonScreenFade kind="검게어두워짐" onEnd={() => setEndingFadeIn(false)} />}
    </>
  )
}

export function teamMenuBranch({ scene, state, session, actions, backToManagement }: SeasonBranchInput): ReactNode {
  if (scene !== SEASON_SCENE_STATE.구단관리) return null
  return (
    <SeasonTeamMenuScreen
      state={state}
      // 메뉴 객체 this+0x78 의 커서 — 관리 메뉴에서 들어오면 0 (0x47d8), 하위 화면에서 돌아오면 남는다
      cursor={session.menuCursors.teamMenu}
      onCursorChange={(index) => actions.moveMenuCursor('teamMenu', index)}
      onSelect={(_item, target) => actions.goto(target)}
      onBack={backToManagement}
      gamePoint={session.gamePoints}
    />
  )
}

export function trainingBranch({
  scene,
  state,
  session,
  actions,
  trainingResultFirstLine,
  setTrainingResultFirstLine,
  backToManagement,
}: SeasonBranchInput): ReactNode {
  if (scene !== SEASON_SCENE_STATE.트레이닝) return null
  return (
    <SeasonTrainingScreen
      state={state}
      // G 포인트는 전역 저장(+0x64) 칸이라 시즌 레코드에 없다 — 그 칸이 곧 지갑이다
      gamePoints={session.gamePoints}
      onTrain={(_slot, index) => actions.runTraining(index)}
      onBack={backToManagement}
      result={session.trainingResult}
      onCloseResult={actions.closeTrainingResult}
      resultFirstLine={trainingResultFirstLine}
      onResultFirstLineChange={setTrainingResultFirstLine}
    />
  )
}

export function outingMapBranch({ scene, state, actions, outingCursor, setOutingCursor, backToManagement }: SeasonBranchInput): ReactNode {
  if (scene !== SEASON_SCENE_STATE.외출지도) return null
  return (
    <SeasonOutingScreen
      state={state}
      cursor={outingCursor}
      onCursorChange={setOutingCursor}
      // 0x4a94 — 확인 팝업 0x16 에 "예": 장소를 넘기고 연출 0xe3 으로
      onRun={(_place, index) => actions.enterOuting(index)}
      onBack={backToManagement}
    />
  )
}

// 외출 연출 0xe3 (진입 0x5184 · 키 0x4944 · 갱신 0xce0c · 그리기 0xa06c = 지도 0x7ea64(gfx, p, 0) → 가운데 정렬판 0x84ea0).
// 연출이 끝난 틀에 결과 0xc81c 가 굴리고 팝업 0x17 을 띄운다 — 팝업은 연출이 놓인 판 위에 뜨고, 닫으면 0xc9
export function outingPlayBranch({ scene, session, actions }: SeasonBranchInput): ReactNode {
  if (scene !== SEASON_SCENE_STATE.외출연출 || session.outingPlace === null) return null
  const place = session.outingPlace
  const resultText = session.outingResultText
  return (
    <RawScreen>
      <SeasonOutingMap selected={place} />
      <SeasonOutingPopup place={place} onFinished={() => actions.runOuting(place)} />
      {resultText !== null && <MessageBox text={resultText} buttons={['확인']} onAnswer={actions.closeOutingResult} />}
    </RawScreen>
  )
}
