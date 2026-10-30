import { RawScreen } from '@/shared/ui'
import { useRecoloredSprite, useWarmRecoloredFolder } from '@/shared/lib/sprite/paletteSwap'
import { useGameSceneUpdateCounter } from '@/shared/lib/commonWindow/useGameSceneUpdateCounter'
import { CAMERA_FOLLOW_PERCENT } from '@/pages/defense/lib/defenseCamera'
import { DEFENSE_BACKGROUND_URL, DEFENDER_FRAMES, defenderPaletteIndexOf } from '@/pages/defense/lib/defenseView'
import { DefenseField } from './defenseScreen/DefenseField'
import type { DefenseScreenProps } from './defenseScreen/defenseScreenProps'
import { useDefenseCamera } from './defenseScreen/useDefenseCamera'

/**
 * 수비 화면 (R3-field-view 1~6절).
 *
 * 배경 stadium/defense.pzx(310×500)를 좌우 반전 두 장으로 620×500 을 만들고
 * (I 1b), 카메라 오프셋 0x41230 만큼 옮겨 깐다. 야수·주자·공은 월드 좌표를
 * 같은 오프셋으로 화면에 찍는다.
 *
 * 화면이 하지 않는 것: 이동·포구·송구·판정은 전부 모델 몫이다. 여기서는
 * 받은 스냅샷을 그리고 카메라만 굴린다.
 */
export function DefenseScreen({
  state,
  followPercent = CAMERA_FOLLOW_PERCENT,
  isRunning = true,
  grassPalette = null,
  underActors,
  cameraOffsetRef,
  drawRedraws = 0,
  children,
  camera: fixedCamera,
  overBackground,
  hidesFieldMap,
  isEmbedded = false,
}: DefenseScreenProps) {
  // 카메라 0x3f060 은 경기 장면 갱신이다 — 공용 창이 서 있으면 52cc6 이 건너뛰어 카메라도 선다(`useGameSceneUpdateCounter`)
  const update = useGameSceneUpdateCounter(isRunning)
  /** 그리기 쪽 애니가 넘어간 수 — 갱신마다 한 그림 + 창이 선 첫 그림 (`drawRedraws`) */
  const drawnPictures = update + drawRedraws
  // 시즌 잔디 (`0x7885c`) — 아직 다 안 칠했거나 캔버스가 없으면 구운 그림을 그대로 쓴다.
  const backgroundUrl = useRecoloredSprite(DEFENSE_BACKGROUND_URL, grassPalette)
  // 야수 · 주자(defender)는 매 틱 동작이 바뀐다 — 두 팀 벌로 칸 전부를 미리 칠해 처음 서는 동작에 구운 벌이 비치지 않게
  // 야수 · 주자(defender)는 매 틱 동작이 바뀐다 — 두 팀 벌로 칸 전부를 미리 칠해 처음 서는 동작에 구운 벌이 비치지 않게
  // (원본 0x48658 은 적재 때 팔레트를 갈아 끼운다). 그림만 — 진행 로직은 안 건드린다. 마선수 주자도 실린 그림이 없으면
  // defender 를 팀 벌로 그린다(`runnerSpriteFolderOf`) — 주자는 다 넣는다
  useWarmRecoloredFolder(DEFENDER_FRAMES, [
    ...state.fielders.map((fielder) => (fielder.aceIndex == null ? defenderPaletteIndexOf(fielder.teamIndex) : null)),
    ...state.runners.map((runner) => defenderPaletteIndexOf(runner.teamIndex)),
  ])
  const offset = useDefenseCamera(update, state, followPercent, fixedCamera, cameraOffsetRef)
  const field = (
    <>
      <DefenseField
        state={state}
        offset={offset}
        backgroundUrl={backgroundUrl}
        drawnPictures={drawnPictures}
        overBackground={overBackground}
        underActors={underActors}
        hidesFieldMap={hidesFieldMap}
      />
      {children}
    </>
  )
  return isEmbedded ? field : <RawScreen>{field}</RawScreen>
}
