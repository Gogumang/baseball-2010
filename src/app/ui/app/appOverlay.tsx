import type { ReactNode } from 'react'
import {
  CommonWindowOpenContext,
  CommonWindowPushContext,
  CommonWindowSceneContext,
  GameSceneMarkContext,
} from '@/shared/lib/commonWindow/commonWindow'
import { isGameSceneScreenKind } from '@/app/model/commonWindowScene'
import { SceneParticleLayer } from '@/widgets/particles/ui/SceneParticleLayer'
import { MessageBox, ScreenOverlay } from '@/shared/ui'
import { SCREEN_LAYERS } from '@/shared/config/screenLayers'
import { RecordAchievedContext } from '@/widgets/game-scene/model/recordAchievedContext'
import type { AppScope } from '@/app/ui/app/appScope'

/**
 * 화면 위에 늘 얹는 것 — 기록달성 해금 · 경기 장면 표시 · 공용 창 문맥과 히든 오픈 알림 공용 창(0x62368 → 0x74ef5) · 장면 파티클 층.
 * 원본 창은 어느 장면 위에도 그려지므로 모든 화면 위에 얹는다
 */
export function withHiddenOpenNotice(app: AppScope, routes: ReactNode): ReactNode {
  const { random, screen, hiddenOpenNotice, markGameScene, gameSceneCount, unlockByRecord, sceneClosesWithoutShrink } = app
  return (
    <RecordAchievedContext.Provider value={unlockByRecord}>
      <GameSceneMarkContext.Provider value={markGameScene}>
        <CommonWindowSceneContext.Provider value={sceneClosesWithoutShrink}>
          <CommonWindowOpenContext.Provider value={hiddenOpenNotice.text !== null}>
            <CommonWindowPushContext.Provider value={hiddenOpenNotice.push}>{routes}</CommonWindowPushContext.Provider>
          </CommonWindowOpenContext.Provider>
        </CommonWindowSceneContext.Provider>
      </GameSceneMarkContext.Provider>
      {hiddenOpenNotice.text !== null && (
        // 공용 창은 키를 통째로 가져간다(0x754f9) — 누름도 창 것이라 화면의 누름 칸(경기 OK 대기 '확인' 7 따위)보다 위에 둔다(r195)
        <ScreenOverlay zIndex={SCREEN_LAYERS.COMMON_WINDOW}>
          <MessageBox
            key={hiddenOpenNotice.serial}
            text={hiddenOpenNotice.text}
            buttons={['확인']}
            closesWithoutShrink={sceneClosesWithoutShrink}
            onAnswer={hiddenOpenNotice.close}
          />
        </ScreenOverlay>
      )}
      {/* 장면 파티클 [0x1400068] — 0x103 · 0x105 · 0x106 · 0x107 · 0x104 프레임이 굴리고 그린다(`sceneParticles`). 관리자는 앱에 하나다.
          경기 장면의 타석 · 수비 판 부품이 관리자를 쥔 동안은 그 부품이 제 틱 차례로 굴리고 그려 이 층은 쉰다.
          경기 장면(0x104)이 서 있고 공용 창이 떠 있으면 굴리지도 그리지도 않는다(0x52c50 의 53048 게이트) */}
      <SceneParticleLayer random={random} isGameScene={gameSceneCount > 0 || isGameSceneScreenKind(screen.kind)} />
    </RecordAchievedContext.Provider>
  )
}
