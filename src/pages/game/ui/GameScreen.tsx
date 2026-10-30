import { useEffect, useRef, useState } from 'react'
import { emitSubstitutionEntryParticle } from '@/widgets/batting-stage/lib/substitutionEntryParticle'
import { useWarmStageCast } from '@/widgets/batting-stage/model/useWarmStageCast'
import { useInGameMenuState } from '@/features/play-team-game/model/useInGameMenuState'
import { useSceneConfirm } from '@/features/play-game/model/useSceneConfirm'
import { useSubstitutionScene } from '@/features/play-game/model/useSubstitutionScene'
import { stealableBasesOf } from '@/features/play-game/model/gameFlow'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import { useMarksCommonWindowShown, useMarksGameScene } from '@/shared/lib/commonWindow/commonWindow'
import { gameStageWarmCastOf } from '@/pages/game/lib/gameStageWarmCast'
import { GameBenchClearing } from './gameScreen/GameBenchClearing'
import { GameHalfInningBoard } from './gameScreen/GameHalfInningBoard'
import type { GameScreenProps, MenuOverlay } from './gameScreen/gameScreenProps'
import { benchClearingSceneOf, isSceneUncoveredOf, openHalfInningBoardOf, recordAlertSceneKeyOf } from './gameScreen/gameScreenScene'
import { GameStageScene } from './gameScreen/GameStageScene'
import { pushStealKey, useGameScreenKeys } from './gameScreen/useGameScreenKeys'

export type { RecordAlertScene } from './gameScreen/gameScreenProps'

/**
 * 나만의리그 타자편(모드 4) 경기 화면 — 타석 장면, 그 앞의 1회초 판(0x18) · 사구 뒤 벤치 클리어링(0x1e), 경기 중 메뉴.
 * 훅은 여기서 옛 차례 그대로 부르고, 띄울 장면 하나를 고른다.
 */
export function GameScreen(props: GameScreenProps) {
  const { career, progress, atBat, onSteal, onBenchClearingDone, onRecordAlertSceneChange } = props
  const menu = useInGameMenuState()
  // 경기 장면 0x104 — 생성자 0x3301c 가 [창+0x24f] = 1 (공용 창이 줄임 없이 닫힌다)
  useMarksGameScene()
  // 내 선수 · 상대 투수 명단의 칠하기를 미리 건다 — 원본은 타석 교대 0x47cc8 의 적재 때 칠해 첫 그림부터 제 색이다(`gameStageWarmCastOf`)
  const stageWarmCast = gameStageWarmCastOf(progress, career)
  useWarmStageCast(stageWarmCast)
  const [overlay, setOverlay] = useState<MenuOverlay | null>(null)
  // [조작방법] · [설정] 동안도 일시정지 창이 떠 있다(0x3c212 · 0x3c326 이 대기 칸으로 다시 띄운다 — I 4c-3) — 공용 창 [0x140005c]+9
  useMarksCommonWindowShown(overlay !== null)

  /** 지금 출발시킬 수 있는 루 — `canStartSteal`(0xa9924 앞길 검사). 이번 공에 이미 출발한 주자는 빠진다 */
  const stealableBases = onSteal === undefined ? [] : stealableBasesOf(progress)
  /** 타석 화면이 채우는 "공이 나는 동안(상태 0x11)인가" — 원본 도루 키 0x53610 은 이때만 받는다 */
  const flightProbeRef = useRef<(() => boolean) | null>(null)
  const stealIfFlying = (base: StealBase, event?: Event) => pushStealKey(flightProbeRef, onSteal, base, event)

  const benchClearing = benchClearingSceneOf(progress)
  /** OK 로 1회초 판을 닫았는가 */
  const [isBoardClosed, setBoardClosed] = useState(false)
  const openBoard = openHalfInningBoardOf(progress, atBat, isBoardClosed)
  /** 타석 대신 벤치 클리어링(0x1e) · 1회초 판(0x18)이 섰다 */
  const isStageReplaced = benchClearing !== null || openBoard !== null
  /** 경기 중 메뉴 · 그 하위(조작방법 · 설정)가 떠 있다 — 팝업 관리자 [0x140005c]+9 */
  const isPopupShown = menu.isOpen || overlay !== null
  const isSceneUncovered = isSceneUncoveredOf(props.isPaused, props.bannerText, isPopupShown, isStageReplaced)
  /**
   * **교체 연출 0x16** — 진행기가 0xe 확인 뒤 0xf 진입의 CPU 투수 교체를 실어 두면(`progress.substitutionScene`) 그 OK 를 받은 뒤
   * "CHANGE" 애니를 그린다. 그동안은 0xd · 0xe 가 아니라 다음 대기를 세지 않는다(0x16 → 0xd → 0xe).
   * 타석 중간(볼 · 스트라이크 · 파울 · 판 끝 · 견제 끝의 0xf 진입, be9a27f)이면 진행기가 새 대기(entries 1)와 `confirmsBefore` 0
   * 연출을 싣는다 — 곧장 서고, 카운트는 그대로(0xd 가 앞 상태 0x16 이라 타석 초기화를 건너뜀, 48e94) 0xe 의 OK 를 기다린다.
   */
  const substitution = useSubstitutionScene(
    progress.substitutionScene,
    progress.sceneConfirm,
    isSceneUncovered,
    // 0xe 첫 그림의 0x38b64 — 타석 캔버스가 그린 투수 · 타자 자리에 등판 파티클
    (scene) => emitSubstitutionEntryParticle(scene.entryKind),
  )
  /** **상태 0xe — 내 타석마다 사람 OK 를 기다린다** (`isSceneUncoveredOf`) */
  const sceneConfirm = useSceneConfirm(progress.sceneConfirm, isSceneUncovered && !substitution.isShown)
  useGameScreenKeys(menu, overlay, isStageReplaced, stealableBases, stealIfFlying)

  // 기록 달성 알림의 팝업 멈춤 · 장면 갈래를 알림을 든 쪽에 알린다 (`RecordAlertScene`)
  const alertSceneKey = recordAlertSceneKeyOf(benchClearing !== null, openBoard, sceneConfirm.isAwaiting)
  useEffect(() => {
    onRecordAlertSceneChange?.({ isFrozen: isPopupShown, key: alertSceneKey })
  }, [alertSceneKey, isPopupShown, onRecordAlertSceneChange])

  if (benchClearing !== null && onBenchClearingDone !== undefined) {
    return (
      <GameBenchClearing
        progress={progress}
        career={career}
        benchClearing={benchClearing}
        sceneStadium={props.sceneStadium}
        walkerSeats={props.walkerSeats}
        random={props.random}
        onDone={onBenchClearingDone}
      />
    )
  }
  if (openBoard !== null) {
    return (
      <GameHalfInningBoard
        progress={progress}
        career={career}
        board={openBoard}
        sceneStadium={props.sceneStadium}
        walkerSeats={props.walkerSeats}
        onConfirm={() => setBoardClosed(true)}
      />
    )
  }
  return (
    <GameStageScene
      props={props}
      menu={menu}
      overlay={overlay}
      setOverlay={setOverlay}
      isPopupShown={isPopupShown}
      sceneConfirm={sceneConfirm}
      substitution={substitution}
      stealableBases={stealableBases}
      stealIfFlying={stealIfFlying}
      warmCast={stageWarmCast}
      flightProbeRef={flightProbeRef}
    />
  )
}
