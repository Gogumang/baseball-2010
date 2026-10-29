import type { ReactNode } from 'react'
import { nariBatterOf, nariPitcherOf } from '@/app/model/useCollection'
import { modeBatterOf } from '@/app/model/modeBatter'
import { nariSeasonRecordsOf } from '@/app/model/seasonHallOfFameRecords'
import { SeasonRoute, MissionRoutes } from '@/app/ui/app/lazyRoutes'
import { MISSION_PITCHER_MODE, MISSION_BATTER_MODE } from '@/app/ui/app/appConstants'
import { withHiddenOpenNotice } from '@/app/ui/app/appOverlay'
import type { AppScope } from '@/app/ui/app/appScope'

// 미션 모드는 메인 메뉴에서 들어가 선수 고르기(하위 17)부터 띄운다 — 육성·명예 선수가 다 없으면 원본대로
// 고르기 창에서 막힌다(StrCOMMON[38]·[39]). 고른 선수의 편이 투수(모드 5)/타자(모드 6) 미션을 정한다.
export function missionRoutesOf(app: AppScope): ReactNode {
  const { setLastPlayedMode, gameSettings, random, screen, setScreen, runner, wallet, pitcherSession, careerSession, mission, collection } = app
  // 미션 선수 고르기(하위 17) 0x29a54 의 답 → this+0x13c = 5(투수)|6(타자) → 상태 0x27 → 0x327b8 이 +0x3c 에 적는다.
  // 마선수 대결(나리 이벤트)은 이 고르기를 안 지나 +0x3c 를 안 건드린다
  const missionFromMenu = {
    ...mission,
    actions: {
      ...mission.actions,
      choosePlayer: (pick: Parameters<typeof mission.actions.choosePlayer>[0]) => {
        setLastPlayedMode(pick.side === '투수' ? MISSION_PITCHER_MODE : MISSION_BATTER_MODE)
        mission.actions.choosePlayer(pick)
      },
    },
  }
  return withHiddenOpenNotice(
    app,
    <MissionRoutes
      screen={screen}
      setScreen={setScreen}
      session={missionFromMenu}
      runner={runner}
      random={random}
      // 미션(모드 6)은 0x213c0(앱, 4, 0) 으로 나리 타자편 저장을 올린다 — 진행 중 커리어가 없으면
      // 저장된 선수다. 능력치는 0xb6414(장비·스킬)까지만: 0xb570c 의 질병·부상·사기 감소는 모드 3·4 갈래라
      // 미션에서는 안 먹는다 (`modeBatterOf`). 마선수 대결(이벤트)도 같은 화면이다.
      batter={modeBatterOf(careerSession.career ?? careerSession.savedCareer)}
      // 선수 고르기 창(하위 17) — 칸 0·5 나리 투수·타자는 두 편 저장(0x213c0(…, 3|4, 1))이다
      hallOfFame={collection.collection}
      nari={{
        투수: nariPitcherOf(pitcherSession.career),
        타자: nariBatterOf(careerSession.career ?? careerSession.savedCareer),
      }}
      pitchControl={gameSettings.settings.pitchControl}
      gameSettings={gameSettings}
      // 하위 17 머리띠 0x54d95(skin, 11, 5) 는 제목이 −1 이 아니라 G포인트도 그린다 (29261d0)
      gamePoint={wallet.balance}
    />,
  )
}

// 시즌모드는 나만의리그 커리어와 아예 다른 저장·흐름이다 (원본 장면 0x105)
export function seasonRouteOf(app: AppScope): ReactNode {
  const { gameSettings, random, setScreen, seasonSession, pitcherSession, careerSession, collection, aceSelect } = app
  return withHiddenOpenNotice(
    app,
    <SeasonRoute
      session={seasonSession}
      random={random}
      gameSettings={gameSettings}
      // 관리 메뉴 0xc9 취소(0x8f5a)는 [0x140006c] = 5 — 게임시작 목록으로 바로 연다. 그 밖의 나감은 처음 단
      onExit={(openTier) => setScreen(openTier === undefined ? { kind: '메인메뉴' } : { kind: '메인메뉴', openTier })}
      aceSelect={aceSelect}
      // 선수영입 후보의 명예의 전당 칸 (0x1f62c · 0x1f640)
      hallOfFame={collection.collection}
      // 시즌 장비 창에서 명예 선수가 장비를 사면 명전 기록에도 (0x2328c)
      onHallOfFameEquipment={collection.syncSeasonHallOfFameEquipment}
      // 시즌 영입 0xc554 가 명전 기록 +0xa 아랫 5비트를 고른 자리로 고치고 전역 블록과 함께 저장한다 (더비 · 미션 k)
      onHallOfFameRecruit={collection.syncSeasonHallOfFameRecruit}
      // 영입 목록(종류 0) 나리 칸 0·5 — 나리 투수편·타자편 저장 (미션 선수 고르기와 같은 값)
      nari={{
        투수: nariPitcherOf(pitcherSession.career),
        타자: nariBatterOf(careerSession.career ?? careerSession.savedCareer),
      }}
      // 나리 칸을 고르면 영입할 기록 (0x22168 · 0x220ec — 같은 두 저장의 내 선수)
      nariRecords={nariSeasonRecordsOf(pitcherSession.career, careerSession.career ?? careerSession.savedCareer)}
    />,
  )
}
