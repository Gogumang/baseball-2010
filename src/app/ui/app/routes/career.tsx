import type { ReactNode } from 'react'
import { nariPitcherOf } from '@/app/model/useCollection'
import { CareerRoutes } from '@/app/ui/app/lazyRoutes'
import { REGISTERED_HALL_OF_FAME_HIDDEN_ID } from '@/app/ui/app/appConstants'
import { withHiddenOpenNotice } from '@/app/ui/app/appOverlay'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { AppScope } from '@/app/ui/app/appScope'

export function careerRoutesOf(app: AppScope, career: PlayerCareer): ReactNode {
  const { gameSettings, random, screen, setScreen, runner, aceLevels, wallet, openHidden, pitcherSession, careerSession, collection, startAceMatch } =
    app
  return withHiddenOpenNotice(
    app,
    <CareerRoutes
      screen={screen}
      setScreen={setScreen}
      session={careerSession}
      runner={runner}
      random={random}
      career={career}
      // 명예의 전당 등록 (나리 상태 145) — G 20000 은 전역 지갑에서 (0x62dc4)
      hallOfFame={{
        collection: collection.collection,
        nariPitcher: nariPitcherOf(pitcherSession.career),
        register: (target, slot) => collection.register(target, wallet, slot),
        // 145 완료 창(꼬리표 0x30) 닫힘 0x1ca4c — 히든 17 을 열면 알림(꼬리표 0x31)을 닫은 뒤 메인 메뉴로
        openRegisteredHidden: (then: () => void) => openHidden(REGISTERED_HALL_OF_FAME_HIDDEN_ID, then),
        // 등록 목록(상태 145) 머리띠 0x54d95(skin, 8 "나만의리그 타자편", 5) 가 전역 G 를 그린다
        gamePoint: wallet.balance,
      }}
      onAceMatch={startAceMatch}
      gameSettings={gameSettings}
      // 마선수 대결의 상대 마투수도 전역 레벨 칸을 본다 (0xb6414 배율 · 0xaebe4 마구 횟수)
      aceLevels={aceLevels.levels}
    />,
  )
}
