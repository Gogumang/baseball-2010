import type { ReactNode } from 'react'
import { nariBatterOf } from '@/app/model/useCollection'
import { PitcherLeagueRoute, PitcherAceMatchRoute } from '@/app/ui/app/lazyRoutes'
import { REGISTERED_HALL_OF_FAME_HIDDEN_ID } from '@/app/ui/app/appConstants'
import { withHiddenOpenNotice } from '@/app/ui/app/appOverlay'
import type { AppScope } from '@/app/ui/app/appScope'

// 나만의리그 투수편은 타자편 커리어와 다른 저장·흐름이다 (원본 모드 3, 장면 0x106)
export function pitcherLeagueOf(app: AppScope): ReactNode {
  const { gameSettings, random, setScreen, runner, wallet, openHidden, pitcherSession, careerSession, mission, collection } = app
  return withHiddenOpenNotice(
    app,
    <PitcherLeagueRoute
      session={pitcherSession}
      random={random}
      openedHiddenIds={collection.collection.openedHiddenIds}
      gameSettings={gameSettings}
      // 명예의 전당 등록 (나리 상태 145, 모드 3) — 칸 5 나리 타자는 타자편 저장이 있으면
      hallOfFame={{
        collection: collection.collection,
        nariBatter: nariBatterOf(careerSession.career ?? careerSession.savedCareer),
        register: (target, slot) => collection.registerPitcher(target, wallet, slot),
        // 145 완료 창(꼬리표 0x30) 닫힘 0x1ca4c — 히든 17 을 열면 알림(꼬리표 0x31)을 닫은 뒤 메인 메뉴로
        openRegisteredHidden: (then: () => void) => openHidden(REGISTERED_HALL_OF_FAME_HIDDEN_ID, then),
        // 등록 목록(상태 145) 머리띠 0x54d95(skin, 9 "나만의리그 투수편", 5) 가 전역 G 를 그린다
        gamePoint: wallet.balance,
      }}
      // 105 취소(0x126e6)는 [0x140006c] = 5 — 게임시작 목록으로 바로 연다. 그 밖의 나감은 처음 단
      onExit={(openTier) => setScreen(openTier === undefined ? { kind: '메인메뉴' } : { kind: '메인메뉴', openTier })}
      // 마선수 대결 (SYS 8 → 투수 미션 team − 1) — 미션 세션이 투수편 내 투수(`pitcherMissionPitcher`)로 던지고
      // 이겼나를 돌려주면 투수편 세션이 140 → resultEvents[이김 ? 0 : 1] → 105 로 잇는다
      renderAceMatch={(match, onFinish) => (
        <PitcherAceMatchRoute
          mission={match.mission}
          session={mission}
          runner={runner}
          pitchControl={gameSettings.settings.pitchControl}
          gameSettings={gameSettings}
          onFinish={onFinish}
          onQuit={pitcherSession.actions.quitAceMatch}
          // 첫 0x18 판 PITCHER(0x420dc) — 0x1fbd0 은 g[0x176](투수편 대결)이면 늘 투수편 저장 [저장+0x3c] 선수다
          pitcherName={pitcherSession.career?.name ?? null}
        />
      )}
    />,
  )
}
