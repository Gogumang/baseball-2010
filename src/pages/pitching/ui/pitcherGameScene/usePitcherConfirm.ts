import { emitSubstitutionEntryParticle } from '@/widgets/batting-stage/lib/substitutionEntryParticle'
import { useSceneConfirm } from '@/features/play-game/model/useSceneConfirm'
import { useSubstitutionScene } from '@/features/play-game/model/useSubstitutionScene'
import type { PitcherGameSession } from '@/pages/pitching/model/usePitcherGame'
import { type PitcherCoverInput, isPitcherSceneUncoveredOf } from './pitcherSceneConditions'

/** 0xe 대기 칸 — 진행기가 OK 를 아직 안 받은 0xe 대기, 또는 0xe 진입에서 감독 강판으로 빠지는 지나감(0xd 두 그림 · 0xe 한 그림, `hooksAtEntry`) */
function confirmEntryOf(session: PitcherGameSession) {
  const { progress } = session
  return progress.sceneConfirmPending === true || progress.managerHookText !== null ? progress.sceneConfirm : null
}

/**
 * **상태 0xe — 내가 던지는 타석마다 사람 OK 를 기다린다** (`features/play-game/model/sceneConfirm`, 0x39e14 → 0x532b0 —
 * 0x532b0 은 조작 객체의 공수를 안 본다). 진입에서 감독 강판(0x504cc)이 참이면 0x23 이라 OK 를 기다리지 않고 0xd 두 그림 ·
 * 0xe 한 그림만 지난다(`hooksAtEntry`). OK 뒤 굴림(돌발 0x8f158 · 0xf 진입 0x3d954 의 CPU 대타)은 OK 를 받을 때 진행기가 돌린다 (`confirmScene`).
 *
 * **교체 연출 0x16** — 0xf 진입의 CPU 대타 뒤 진행기가 싣는다(`substitutionScene`). "CHANGE" 애니를 다 그린 뒤 0xd 두 그림 →
 * 0xe(진입 0x50674 의 감독 강판 판정 · 등판음 · OK 대기). 그동안은 0xe 대기 · 감독 대사 창을 세우지 않는다.
 */
export function usePitcherConfirm(session: PitcherGameSession, cover: PitcherCoverInput) {
  const { progress, canPitch, actions } = session
  const isUncovered = isPitcherSceneUncoveredOf(cover)
  const substitution = useSubstitutionScene(
    progress.substitutionScene,
    progress.sceneConfirm,
    isUncovered,
    // 0xe 첫 그림의 0x38b64 — 타석 캔버스가 그린 타자 자리에 대타 등판 파티클(ptc/003)
    (scene) => emitSubstitutionEntryParticle(scene.entryKind),
  )
  const sceneConfirm = useSceneConfirm(confirmEntryOf(session), isUncovered && !substitution.isShown, actions.confirmScene)
  /**
   * 감독 강판의 0xd · 0xe 지나감 — 진입 0x50674 506ea 0x504cc 참이어도 앞선 0xd 두 그림 · 0xe 한 그림(0x4d9ec)은 그린다. 다 지나면
   * 다음 틀 0xbc9c8 이 0x23 으로 옮겨 강판 창이 선다
   */
  const isHookPassing = progress.managerHookText !== null && sceneConfirm.isAwaiting
  const isAwaitingConfirm = sceneConfirm.isAwaiting && (canPitch || isHookPassing)
  /** 감독 대사 창(0x23)이 서 있는가 — 0x16 → 0xd → 0xe 진입 0x50674 의 감독 강판, 연출 · 지나감 뒤다 */
  const isManagerHookShown = progress.managerHookText !== null && !substitution.isShown && !isHookPassing
  return { substitution, sceneConfirm, isHookPassing, isAwaitingConfirm, isManagerHookShown }
}
