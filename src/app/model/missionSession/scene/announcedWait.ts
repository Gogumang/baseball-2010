import type { SceneConfirmWait } from '@/features/play-game/model/sceneConfirm'

/** 0x16 을 안 거친 0xd 로 선 새 타석 대기 — 내놓을 때 타석 등장음을 단다 */
export const freshAtBatWaits = new WeakSet<SceneConfirmWait>()
/** 지금 판으로 고른 대기의 타석 등장음 — 그리기마다 고친다 */
export const atBatEntrySoundOf = new WeakMap<SceneConfirmWait, number>()
/**
 * 대기 하나에 내놓는 객체 하나 — 화면은 받은 OK 수를 객체로 세므로(`useSceneConfirm`) 판이 바뀌어도(견제로 주자가 바뀌는 등)
 * 같은 객체여야 한다. 등장음은 화면이 0xd 를 그리기 시작할 때 읽는 그때의 값이다.
 */
const announcedWaits = new WeakMap<SceneConfirmWait, SceneConfirmWait>()
export function announcedWaitOf(wait: SceneConfirmWait): SceneConfirmWait {
  const known = announcedWaits.get(wait)
  if (known !== undefined) return known
  const announced: SceneConfirmWait = {
    entries: wait.entries,
    get atBatEntrySoundId() {
      return atBatEntrySoundOf.get(wait)
    },
  }
  announcedWaits.set(wait, announced)
  return announced
}

/** 화면에 내놓는 대기 — 새 타석 대기면 타석 등장음을 단 객체 */
export function shownSceneConfirmOf(wait: SceneConfirmWait | null): SceneConfirmWait | null {
  return wait !== null && freshAtBatWaits.has(wait) ? announcedWaitOf(wait) : wait
}
