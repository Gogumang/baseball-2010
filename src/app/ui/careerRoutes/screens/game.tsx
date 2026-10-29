import type { ReactNode } from 'react'
import { GameRoute } from '@/app/ui/GameRoute'
import { GameResultScreen } from '@/pages/game-result/ui/GameResultScreen'
import { GameEvaluationScreen } from '@/pages/game-result/ui/GameEvaluationScreen'
import { NariEventUnderlay } from '@/pages/management/ui/NariEventUnderlay'
import { nariLastGameRecordLineOf } from '@/entities/career/model/playerCareer'
import { managementOf } from '@/app/ui/careerRoutes/managementScreen'
import type { CareerScreenInput, ScreenOf } from '@/app/ui/careerRoutes/careerScreenInput'

export function gameScreenOf(input: CareerScreenInput): ReactNode {
  const { session, runner, random, career, gameSettings, aceLevels } = input
  if (session.progress === null) return managementOf(input)
  return (
    <GameRoute
      session={session}
      progress={session.progress}
      runner={runner}
      random={random}
      career={career}
      gameSettings={gameSettings}
      aceLevels={aceLevels}
    />
  )
}

export function gameResultScreenOf(input: CareerScreenInput, screen: ScreenOf<'경기결과'>): ReactNode {
  const { session, random, career, actions } = input
  // 경기 장면 0x104 의 경기 끝 판 0x18 → 정산 0x19. 정산 판을 나가면(0x3f3) 나리 장면이 새로 서서 100 → 116 (`leaveGameSettlement`)
  return (
    <GameResultScreen
      summary={screen.summary}
      gamePointReward={screen.gamePointReward}
      career={career}
      onContinue={actions.leaveGameSettlement}
      onSettlementEnter={actions.enterGameSettlement}
      // 정산 0x4ea0c 를 지났을 때 — 결과 그림 0x4a384 의 배경 · 정산 효과(경기 난수)
      {...(screen.settlementInning === undefined
        ? {}
        : {
            settlement: {
              inning: screen.settlementInning,
              playerSide: screen.settlementPlayerSide ?? 1,
              random,
              // 경기 중 구장 하늘 줄 그대로 (0x783b0 — 경기를 세울 때 한 번)
              ...(screen.settlementSkyRow === undefined ? {} : { skyRow: screen.settlementSkyRow }),
              // 구장 객체도 방금 끝난 경기 장면의 것 그대로 (다음 경기를 세울 때까지 세션이 든다)
              stadium: session.sceneStadium,
            },
          })}
    />
  )
}

export function gameEvaluationScreenOf(input: CareerScreenInput, screen: ScreenOf<'경기평가'>): ReactNode {
  const { career, actions } = input
  // 나리 장면 0x106 의 116 경기 뒤 평가 → 114 내장 이벤트 0x8a6fc. 진입 징글은 세션이 띄울 때 냈다
  return (
    <GameEvaluationScreen
      newTitles={screen.newTitles}
      onConfirmTitle={actions.confirmGameResultTitle}
      evaluation={screen.evaluation}
      streakNotices={screen.streakNotices}
      {...(screen.streakRewards === undefined ? {} : { streakRewards: screen.streakRewards })}
      // 0x8c460 이 보상 창을 띄운 갱신에 평판을 준다 — 상태판이 그 창부터 새 값
      rewardUnderlay={(rewarded) => <NariEventUnderlay career={rewarded} isPreviousGame />}
      // 116 의 S+0x1d8 — 정산이 남긴 줄(포스트시즌 경기 뒤에는 앞 평가 경기 줄)
      {...(career.lastGame === undefined ? {} : { recordLine: nariLastGameRecordLineOf(career.lastGame) })}
      career={career}
      onContinue={actions.confirmGameResult}
      // 114 보상 명령마다 몫 · 저장(0x8c460 끝 — S+0x50 은 114 진입이 이미 3 · 0xb, Q-23)
      onRewardsGiven={actions.giveEvaluationRewards}
      // 116(0x11e0c) → 114 평가 대화 0x8b5ac: 공 무늬 · 상태판([이벤트+0xb] = 1 — 0x8a71e) · 머리띠
      underlay={<NariEventUnderlay career={career} isPreviousGame />}
      // 116 이 선 첫 틀 — 그림 0x11e0c(머리띠 · 상태판 0x7d34c(gfx, 0)). 114 는 다음 틀
      entryUnderlay={<NariEventUnderlay career={career} />}
    />
  )
}

// 국가대항전 경기 결과 — 정규 경기와 같은 결과 판(0x18 · 0x4a384), 116 평가 없이 [확인] → 134 대진판
export function cupGameResultScreenOf(input: CareerScreenInput, screen: ScreenOf<'대회경기결과'>): ReactNode {
  const { session, random, career, actions } = input
  return (
    <GameResultScreen
      summary={screen.summary}
      gamePointReward={screen.gamePointReward}
      career={career}
      onContinue={actions.confirmCupGameResult}
      onSettlementEnter={actions.enterGameSettlement}
      // 대회 경기도 정산 0x4ea0c 꼬리를 지난다 — 결과 그림 0x4a384 의 배경 · 정산 효과(경기 난수)
      settlement={{
        inning: screen.settlementInning,
        playerSide: screen.settlementPlayerSide,
        random,
        skyRow: screen.settlementSkyRow,
        stadium: session.sceneStadium,
      }}
    />
  )
}
