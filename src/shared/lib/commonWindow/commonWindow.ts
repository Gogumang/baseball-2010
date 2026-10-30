/**
 * **공용 창 [0x140005c] · 경기 장면 멈춤** — 공개 이름 모음.
 *
 * 쪼갠 파일: `commonWindowContexts`(창 문맥 · 장면 표지 훅) · `freezeState`(앱 전역 칸) · `freezeClock`(멈추기 · 풀기 · 장면 시계 붙잡기) ·
 * `sceneClock`(경기 장면 시각 · 틱) · `sceneTimeouts`(장면 시계 setTimeout · 틱 시계) · `sceneMarks`(창 · 장면 · 로딩 판 표지 · 첫 그림 셈)
 */
export {
  CommonWindowOpenContext,
  CommonWindowPushContext,
  CommonWindowSceneContext,
  GameSceneMark,
  GameSceneMarkContext,
  useCommonWindowPush,
  useIsCommonWindowOpen,
  useMarksCommonWindowShown,
  useMarksGameScene,
  useMarksGameSceneLoading,
  useSceneClosesWithoutShrink,
} from '@/shared/lib/commonWindow/commonWindowContexts'
export { noteCommonWindowOpensInSceneUpdate } from '@/shared/lib/commonWindow/freezeClock'
export {
  appTickOfGameSceneTick,
  gameSceneNow,
  gameSceneTickNow,
  gameSceneTickOf,
  gameSceneTickStartTime,
  gameSceneTimeOf,
  isGameSceneFrozen,
} from '@/shared/lib/commonWindow/sceneClock'
export {
  clearGameSceneTimeout,
  setGameSceneTickInterval,
  setGameSceneTickTimeout,
  setGameSceneTimeout,
} from '@/shared/lib/commonWindow/sceneTimeouts'
export {
  createGameSceneDrawGate,
  gameSceneBackdropFreezeSerialNow,
  isCommonWindowShown,
  isGameSceneUp,
  markCommonWindowShown,
  markGameSceneLoading,
  markGameSceneUp,
  rearmGameSceneFirstDraw,
  resetCommonWindowShownForTest,
} from '@/shared/lib/commonWindow/sceneMarks'
