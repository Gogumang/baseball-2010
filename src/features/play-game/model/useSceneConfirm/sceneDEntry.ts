import { activeSound } from '@/shared/api/audio/soundPort'
import { clearSceneParticles } from '@/entities/particle/model/sceneParticleManager'
import { setGameSceneTickTimeout } from '@/shared/lib/commonWindow/commonWindow'
import type { SceneConfirmWait } from '@/features/play-game/model/sceneConfirm'
import { HOOK_PASSAGE_CONFIRM_FRAMES, SCENE_PREPARE_FRAMES } from '@/features/play-game/model/useSceneConfirm/sceneConfirmFrames'
import {
  announcedWaits,
  marksSceneDEntered,
  notifyConfirmListeners,
  passedHookWaits,
} from '@/features/play-game/model/useSceneConfirm/sceneConfirmStore'

/**
 * **0xd 첫 그림(진입 0x48d50)의 일** — 0xd 틱 0 이 아직 오지 않았으면 그 틀 머리에 한다.
 * 메시지 0xbc1(0x522d2)의 타석 등장음은 대기 하나에 한 번(첫 0xe 몫이라 OK 를 받기 전에만). 등장음이 실린 대기 = 교체 연출 0x16 을 안 거친
 * 0xd 진입이라, 같은 진입 0x48d50 이 48ef8 `[장면+0x28] != 0x16` 일 때 48f02 에서 앱 전역 파티클 관리자를 비운다(0x6dee4, 굴림 없음) —
 * 메뉴에서 남은 이미터도 여기서 진다. 그리고 48ee4 에서 투수 그림 객체를 상태 0 으로 되돌린다(0x35650 → 0x340c0 — `bumpMark`).
 * 0xb 에서 곧장 선 0xe 는 0xd 가 없다.
 */
export function enterSceneDOf(wait: SceneConfirmWait, confirmed: number, bumpMark: () => void): void {
  if (confirmed === 0 && wait.atBatEntrySoundId !== undefined && !announcedWaits.has(wait)) {
    announcedWaits.add(wait)
    clearSceneParticles()
    activeSound().play(wait.atBatEntrySoundId)
  }
  if (wait.skipsSceneD !== true && marksSceneDEntered(wait, confirmed)) bumpMark()
}

/** 0xd 첫 그림 — 0xd 틱 0 이 아직 오지 않았으면(elapsed < 0) 그 틀 머리에, 지났으면 곧바로 */
export function scheduleSceneDEntry(elapsed: number, enter: () => void): number | null {
  if (elapsed < 0) return setGameSceneTickTimeout(enter, -elapsed)
  enter()
  return null
}

/** 강판 지나감 — 0xe 를 한 그림 그린 뒤 끝난다(OK 잠금은 안 푼다). 끝나면 강판 창 0x23 이 선다 */
export function scheduleHookPassage(wait: SceneConfirmWait, elapsed: number, rerender: () => void): number {
  return setGameSceneTickTimeout(
    () => {
      passedHookWaits.add(wait)
      rerender()
      notifyConfirmListeners()
    },
    Math.max(0, SCENE_PREPARE_FRAMES + HOOK_PASSAGE_CONFIRM_FRAMES - elapsed),
  )
}
