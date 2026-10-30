import { useState } from 'react'
import { useInGameMenuState } from '@/features/play-team-game/model/useInGameMenuState'
import { useGameSceneUpdateCounter } from '@/shared/lib/commonWindow/useGameSceneUpdateCounter'
import { useHomeRunDerby } from '@/pages/home-run-derby/model/useHomeRunDerby'
import { LoadingTip } from '@/widgets/loading-tip/ui/LoadingTip'
import type { SpriteSceneKey } from '@/shared/lib/sprite/scenePreload'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { useMarksCommonWindowShown, useMarksGameScene } from '@/shared/lib/commonWindow/commonWindow'
import { DerbyBenchClearing } from './homeRunDerbyScreen/DerbyBenchClearing'
import { DerbyGameScene } from './homeRunDerbyScreen/DerbyGameScene'
import type { HomeRunDerbyScreenProps, MenuOverlay } from './homeRunDerbyScreen/derbyScreenProps'
import { derbyStageBatterOf } from './homeRunDerbyScreen/derbyStageBatter'
import { SettingsScreen } from './homeRunDerbyScreen/otherSlices'
import { useDerbySceneKeys } from './homeRunDerbyScreen/useDerbySceneKeys'

/** 더비 로딩 판 동안 받아 둘 그림 — 기다리지 않는다 */
const DERBY_PRELOADS: readonly SpriteSceneKey[] = ['homeRunDerby']

/**
 * 홈런더비 (게임 모드 7) — `docs/re/H-modes.md` H-2 절의 규칙 전체를 옮긴 화면이다.
 *
 * 10구(+보너스) 동안 타석만 치고, 결과는 `entities/home-run-derby` 의 순수 모델이 센다.
 * 타석 연출은 다른 모드와 똑같이 `widgets/batting-stage` 를 쓰되 **일반 점수판 대신
 * 홈런더비 HUD(0x45a54)** 를 겹친다 — 원본도 `0x4c4bc` 에서 그렇게 갈린다.
 *
 * 판정 모드는 `'홈런더비'` 다: `0xab214` 는 모드 7(sp44)이면 contact·B·C 를 보정 없는 능력치로 세는
 * 다른 갈래(0xab69a)로 가고, 18 자리에서 24 를 한 번 더 굴린다 (`entities/batting/model/swingResult` 머리말).
 */
export function HomeRunDerbyScreen(props: HomeRunDerbyScreenProps) {
  const { aceLevels, random, bestDistance, settings, onSettingsChange, myTeamId, onOpenHidden } = props
  const session = useHomeRunDerby({
    bestDistance,
    onFinish: props.onFinish,
    aceLevels,
    random,
    myTeamId,
    modeBatterSlot: props.modeBatterSlot,
    ...(onOpenHidden === undefined ? {} : { onOpenHidden }),
  })
  const tick = useGameSceneUpdateCounter()
  const menu = useInGameMenuState()
  // 경기 장면 0x104 — 생성자 0x3301c 가 [창+0x24f] = 1 (공용 창이 줄임 없이 닫힌다)
  useMarksGameScene()
  const [overlay, setOverlay] = useState<MenuOverlay | null>(null)
  // [조작방법] · [설정] 동안도 일시정지 창이 떠 있다(0x3c212 · 0x3c326 이 대기 칸으로 다시 띄운다 — I 4c-3) — 공용 창 [0x140005c]+9
  useMarksCommonWindowShown(overlay !== null)
  /**
   * 결과 창의 "예"(재도전)는 메인 메뉴 하위 39 를 거쳐 모드 7 장면을 **새로 세운다** — 타석 캔버스도 새로 띄운다
   * (하늘 행 굴림이 새 장면마다 한 번이다). 경기 중 메뉴의 다시하기도 같은 길(0x3c98e → 0x27)이라 캔버스를 새로 띄운다.
   */
  const [stageSerial, setStageSerial] = useState(0)

  const sceneKeys = useDerbySceneKeys(session, menu, overlay)

  // 경기 장면 로딩 판 — 상태 7 진입 0x39f88(로딩 판 0x667f8 · 진행 칸 0x54120 끝 0x24 · 팁 rand(0, 73) 0x53dbc) 뒤 7 · 9 · 8 의 적재가
  // 한 단계마다 0x54128 · 0x53e04(바탕 · loadingbar 판 · StrTIP 팁 · 진행 막대 · 막대 끝 달리는 선수)를 그린다. 모드를 안 가려 더비도
  // 첫 장면 · 다시하기 · 재도전마다 선다. ⚠️ 근사(시간 · 남김 — 단말 몫 · 바이너리 밖): 원본 길이는 단말의 적재 시간 — 웹은 나리 타자편과 같은 `LoadingTip`
  if (session.loadingTip !== null) {
    return (
      <RawScreen>
        <LoadingTip tip={session.loadingTip} onDone={session.finishLoading} preloadScenes={DERBY_PRELOADS} />
      </RawScreen>
    )
  }
  const reopenMenu = () => {
    // 뷰어 · 설정을 닫으면(0x3ca36: 0x637d0 ≠ 0 · 0x3cb0e) 하위 0 으로 돌아가 일시정지 팝업 0x741a0 을 다시 띄운다 — 경기 중 메뉴로,
    // 메뉴 객체는 안 건드려 커서가 그대로다
    setOverlay(null)
    menu.reopen()
  }
  if (session.isBenchClearing) {
    return <DerbyBenchClearing session={session} myTeamId={myTeamId} batterForm={derbyStageBatterOf(session.batter, props).form} random={random} />
  }
  // 경기 중 메뉴의 "설정"(0x3c326). "조작방법"(0x3c212)은 아래에서 경기 장면 위에 얹는다
  if (overlay === '설정' && settings !== undefined && onSettingsChange !== undefined) {
    return (
      <SettingsScreen
        settings={settings}
        onChange={onSettingsChange}
        onResetCareer={() => {}}
        // [설정]에서 CLR(0x3cb0e)도 하위 0 · 팝업 0x741a0 을 다시 띄운다 — 경기 중 메뉴로, 커서는 그대로
        onBack={reopenMenu}
      />
    )
  }

  return (
    <DerbyGameScene
      props={props}
      session={session}
      menu={menu}
      tick={tick}
      overlay={overlay}
      setOverlay={setOverlay}
      stageSerial={stageSerial}
      onNewStage={() => setStageSerial((serial) => serial + 1)}
      sceneKeys={sceneKeys}
      onReopenMenu={reopenMenu}
    />
  )
}
