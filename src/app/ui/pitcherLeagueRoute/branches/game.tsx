import type { ReactNode } from 'react'
import { nariGameRecordOf } from '@/entities/career/model/nariCupTeams'
import { nariRecordFieldersOf } from '@/entities/career/model/nariTeamRecord'
import { PitcherGameEvaluationScreen } from '@/pages/pitcher-league/ui/PitcherGameEvaluationScreen'
import { PitcherGameScreen } from '@/pages/pitching/ui/PitcherGameScreen'
import type { PitcherBranchInput } from '@/app/ui/pitcherLeagueRoute/branchInput'

export function gameBranch(input: PitcherBranchInput): ReactNode {
  const { random, gameSettings, onExit, career, scene, gameOptions, actions } = input
  if (scene !== '경기' || gameOptions === null) return null
  return (
    <PitcherGameScreen
      options={gameOptions}
      pitcherName={career.name}
      // 소개 판 0x44944 의 시즌 줄 — 내 투수 레코드 +0x20~(커리어 시즌 줄, 이 경기 앞) · 상대 타자는 리그 기록표
      matchupRecords={{ mySeason: career.stats, stats: career.leaguePlayerStats }}
      // 마운드 내 투수 그림의 장비 겹 (0x108f8 모드 ≠ 4 → 0x79368 · 0x10810 → 0x79790)
      pitcherEquipmentLevels={career.equipmentLevels}
      pitcherSkinIndex={career.skinIndex}
      // 두 팀 레코드 타자 배열 차례 — 교대 판 이름표 0x40008 · 운동장 마선수 그림 0x79b48 이 훑는다 (경기 장면 0x39fdc 의 0xb891c 모드 3)
      fieldLineups={{
        ours: nariRecordFieldersOf(nariGameRecordOf(career, gameOptions.ourTeamId), gameOptions.ourTeamId, null),
        opponent: nariRecordFieldersOf(nariGameRecordOf(career, gameOptions.opponentTeamId), gameOptions.opponentTeamId, null),
      }}
      // 정산 판(0x4a384) 보유 GP 줄 — 전역 G [app+0x64] (커리어 칸은 지갑과 다리로 이어진다). 판이 이 경기 G 를 더해 보인다
      gamePoint={career.gamePoint}
      random={random}
      onFinish={actions.finishGame}
      // 경기 중 "나가기" — 상태 0x22 갱신 0x40140 은 모드를 가리지 않고 0x140006c = 4 · 장면 0x103(메인 메뉴 처음 단).
      // 관리(105)로 가지 않는다. 저장·+0x4f 는 그대로라 [14]·[최근게임] 이 곧장 경기로 다시 세운다
      onQuit={() => {
        actions.quitGame()
        onExit()
      }}
      settings={gameSettings.settings}
      onSettingsChange={gameSettings.setSettings}
    />
  )
}

// 116 경기 뒤 평가 — [확인] = 114 → 105/109/128/136
export function gameResultBranch(input: PitcherBranchInput): ReactNode {
  const { career, scene, actions } = input
  if (scene !== '경기결과' || career.lastGame === undefined) return null
  return (
    <PitcherGameEvaluationScreen
      career={career}
      lastGame={career.lastGame}
      onConfirm={actions.confirmGameResult}
      onRewardsGiven={actions.giveEvaluationRewards}
    />
  )
}
