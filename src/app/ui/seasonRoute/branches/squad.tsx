import type { ReactNode } from 'react'
import { TradeScreen, CoachHireScreen } from '@/pages/season'
import { AceSelectScreen } from '@/pages/general-mode'
import { DEFAULT_OPENED_ACE_BATTER_IDS, DEFAULT_OPENED_ACE_PITCHER_IDS } from '@/pages/general-mode/lib/generalModeSetup'
import { SQUAD_PURPOSE } from '@/entities/season-mode/model/preGameFlow'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import type { SeasonBranchInput } from '@/app/ui/seasonRoute/branchInput'

// 트레이드 한 바퀴 (0xe4 팀 고르기 → 0xe5 영입 선수 → 0xe6 보상 선수 → 0xe7 확인·진행).
// 원본도 한 장면 객체가 네 칸을 이어 들고 있어(this+0x154·0x158·0x15c) 화면 하나가 단계를 든다
// CPU 트레이드 요청을 받으면 관리 메뉴에서 곧장 0xe5(영입 선수)로 온다 — 같은 화면이 요청 칸으로 단계를 든다
export function tradeBranch({ scene, state, session, actions, random, hallOfFame, backToTeamMenu }: SeasonBranchInput): ReactNode {
  if (scene !== SEASON_SCENE_STATE.트레이드 && scene !== SEASON_SCENE_STATE.트레이드영입선수) return null
  return (
    <TradeScreen
      state={state}
      // 두 팀 레코드를 칸 차례로 — 투수는 로테이션(0xb5ca8)으로 섞인 레코드 차례다. 지난 트레이드로 바뀐 CPU 팀은
      // 시즌 저장의 명단 (0x1f9a9). 화면이 낸 칸은 세션(finishTrade)이 명단 첨자로 되돌린다
      roster={session.tradeRoster}
      opponentRosterOf={session.tradeRosterOf}
      gamePoints={session.gamePoints}
      random={random}
      request={scene === SEASON_SCENE_STATE.트레이드영입선수 ? session.tradeRequest : null}
      onTrade={actions.finishTrade}
      // 0xe5 진입 0x5cd0 첫머리 — 열 팀 0xb512c (U-105 r154)
      onEnterAcquired={actions.clearRecordAces}
      onFinish={actions.closeTradeResult}
      onCancelRequest={actions.cancelTradeRequest}
      onBack={backToTeamMenu}
      // 0xe4 히든 칸 힌트 — 해금(전역 +0x70)이면 [0] 줄이 빠진다 (0x82f0)
      openedHiddenIds={hallOfFame?.openedHiddenIds ?? []}
      // 0xe5 · 0xe6 엔트리 목록 창 칸 재료 — 그 팀 레코드의 시즌 줄 · 체력
      entryCellSourceOf={session.entryCellSourceOf}
    />
  )
}

/** 경기 전 마선수 고르기에 넘기는 레벨 · 오픈 · 레벨업 손잡이 — 안 넘기면 화면 기본값 */
function preGameAceSelectOf(aceSelect: SeasonBranchInput['aceSelect']) {
  if (aceSelect === undefined) return {}
  return {
    levels: aceSelect.levels,
    onOpenAce: aceSelect.onOpenAce,
    onLevelUp: aceSelect.onLevelUp,
    ...(aceSelect.onAllAcesOpen === undefined ? {} : { onAllAcesOpen: aceSelect.onAllAcesOpen }),
  }
}

// 선수단 0xd7, this+0x11c = 1 — **경기 전 마선수 고르기**. 그림 0xaa24 가 공용 목록 k 2 + 0x5f395 +
// 머리띠(4 "마선수선택", 바닥 0x205)로 일반모드 상태 21 과 같은 화면이라 그 화면을 그대로 쓴다
export function preGameAceBranch({ scene, session, actions, aceSelect }: SeasonBranchInput): ReactNode {
  if (scene !== SEASON_SCENE_STATE.선수단 || session.squadPurpose !== SQUAD_PURPOSE.경기전) return null
  return (
    <AceSelectScreen
      phase={session.preGameAces.phase}
      // rec+0xe — 마타자 단계에서 회색으로 안 그릴 마투수 칸 (0x7b1d8)
      chosenPitcherCell={session.preGameAces.pitcher}
      openedAcePitcherIds={aceSelect?.openedAcePitcherIds ?? DEFAULT_OPENED_ACE_PITCHER_IDS}
      openedAceBatterIds={aceSelect?.openedAceBatterIds ?? DEFAULT_OPENED_ACE_BATTER_IDS}
      {...preGameAceSelectOf(aceSelect)}
      gamePoint={session.gamePoints}
      onSelect={actions.choosePreGameAce}
      onCancel={actions.cancelPreGameAce}
      // 공통 앞그림 0xb810 — 0xd7 는 0xdd · 0xe0 · 0xe1 밖이라 공 무늬를 먼저 깐다(일반모드 상태 21 은 장면이 달라 안 넘긴다)
      underlay={<SkinBackdrop kind="공무늬" />}
    />
  )
}

// 코치채용 — 선수단 화면 0xd7 을 `this+0x11c = 2` 로 띄운 것 (P4 1b, 구단관리 칸 3)
export function coachHireBranch({ scene, state, session, actions, aceSelect, backToTeamMenu }: SeasonBranchInput): ReactNode {
  if (scene !== SEASON_SCENE_STATE.선수단) return null
  return (
    <CoachHireScreen
      state={state}
      gamePoints={session.gamePoints}
      // 오픈 검사 0xa734 — 경기 전 마선수 고르기와 같은 전역 칸(+0x30 + 칸)과 [43] G 오픈
      openedAcePitcherIds={aceSelect?.openedAcePitcherIds ?? DEFAULT_OPENED_ACE_PITCHER_IDS}
      openedAceBatterIds={aceSelect?.openedAceBatterIds ?? DEFAULT_OPENED_ACE_BATTER_IDS}
      {...(aceSelect === undefined ? {} : { levels: aceSelect.levels, onOpenAce: aceSelect.onOpenAce })}
      onHire={actions.updateRecord}
      onBack={backToTeamMenu}
    />
  )
}
