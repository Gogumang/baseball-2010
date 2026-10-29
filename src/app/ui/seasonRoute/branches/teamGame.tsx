import type { ReactNode } from 'react'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { TeamGameScreen } from '@/pages/team-game/ui/TeamGameScreen'
import { seasonStadiumOf } from '@/entities/season-mode/model/stadiumItems'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import type { SeasonBranchInput } from '@/app/ui/seasonRoute/branchInput'

// 경기 — 사람이 팀을 조작한다 (모드 2)
export function teamGameBranch({
  scene,
  state,
  session,
  actions,
  playerStats,
  gameOptions,
  random,
  gameSettings,
  onExit,
}: SeasonBranchInput): ReactNode {
  if (scene !== SEASON_SCENE_STATE.경기직전 || gameOptions === null) return null
  return (
    <TeamGameScreen
      options={gameOptions}
      random={random}
      onFinish={actions.finishGame}
      // 경기 중 "나가기" — 경기 상태 0x22(0x40140)는 모드를 가리지 않고 메인 메뉴(장면 0x103)로 나간다. +0x4e 와 블록은
      // 남아 다음 시즌모드 진입이 그 자리에서 다시 세운다
      onQuit={() => {
        actions.leaveGame()
        onExit()
      }}
      // 이어하기 — 저장 블록에서 다시 세운다 (0x213c0(앱, 2, 0) → 장면 0x104)
      {...(session.resumeGame === null ? {} : { resumeFrom: session.resumeGame })}
      // 0xdd OK 0x847e · 반 이닝 0x4f928 · 장면 진입 0x3a426 — +0x4e = 1 과 블록
      onHalfInningSave={actions.saveGameProgress}
      // 정산 진입 0x4ea0c → 0x4f3d6 — +0x4e = 0
      onSettlementEnter={actions.enterGameSettlement}
      // 자동진행 비용은 전역 저장 +0x64 에서 나간다 (시즌 사용내역 종류 3, 0x22c29)
      gamePoint={session.gamePoints}
      onSpendGamePoint={actions.spendGamePoint}
      settings={gameSettings.settings}
      onSettingsChange={gameSettings.setSettings}
      // 장착한 관중석·전광판 — **홈경기일 때만** 넘긴다 (원본 0x40ff0: 모드 2 이고
      // `0xb6bdc(경기, 1) == SR[1]`, 곧 내 팀이 side 1 = 홈일 때만 시즌 구장 0x77494).
      // 웹에서 그 side 를 정하는 것은 `0xb7844` 의 세 가지(정규 `leagueSideOf` ·
      // 포스트시즌 `postseasonSideOf` · 국가대항전 `nationalCupSideOf`) 고, 그 값이 그대로
      // `playerSide` 다 — side 1 = 후공 = 홈. 원정이면 undefined 라 일반 구장으로 그려진다.
      //
      // ⚠️ **국가대항전은 홈이어도 일반 구장이다.** 경기 준비 0x6650 이 `경기[0x28+side]` 에
      // 넣는 값이 대표팀 번호(10 대한민국 ~ 13 미국)인데, 비교 상대인 `SR[1]`(내 구단)은
      // 시즌모드에서 0~9 뿐이라(히든 팀은 일반모드에서만 고른다 — J-1) 절대 같아지지 않는다.
      seasonStadium={gameOptions.playerSide === PLAYER_SIDE_LAST_BAT && session.gameKind !== '국가대항전' ? seasonStadiumOf(state.record) : undefined}
      // 상태 0xe 소개 판 0x44944 의 시즌 줄 — 레코드 +0x20~ 의 웹 자리(리그 기록표)와, 이 경기 줄을 더할지:
      // 기록 게이트 0xa56dc 모드 2 갈래(0xa56fa)는 국가대항전·포스트시즌이면 거짓, 그 밖엔 마선수만 거짓(받는 쪽이 거른다)
      matchupRecords={{ stats: playerStats, countsThisGame: session.gameKind === '정규' }}
    />
  )
}
