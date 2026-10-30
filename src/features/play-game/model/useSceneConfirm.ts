/**
 * **상태 0xd · 0xe 의 사람 OK 대기** — 공개 이름 모음.
 *
 * 하위 폴더 (`useSceneConfirm/`): `sceneConfirmFrames`(0xd 두 그림 · 0xe 잠금 세 그림) · `sceneConfirmStore`(대기 객체마다 남는 셈 · 밖에서 보기) ·
 * `sceneDEntry`(0xd 진입 0x48d50 의 일 · 강판 지나감) · `useSceneConfirm`(OK 받기 훅)
 */
export {
  SCENE_CONFIRM_LOCK_FRAMES,
  SCENE_CONFIRM_READY_FRAMES,
  SCENE_PREPARE_FRAMES,
} from '@/features/play-game/model/useSceneConfirm/sceneConfirmFrames'
export {
  confirmedCountOf,
  isSceneConfirmAwaiting,
  noteSceneDEntryTick,
  useIsSceneConfirmAwaiting,
} from '@/features/play-game/model/useSceneConfirm/sceneConfirmStore'
export { useSceneConfirm, type SceneConfirm } from '@/features/play-game/model/useSceneConfirm/useSceneConfirm'
