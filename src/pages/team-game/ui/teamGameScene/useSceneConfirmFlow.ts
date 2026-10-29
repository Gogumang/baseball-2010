import { useEffect } from 'react'
import { emitSubstitutionEntryParticle } from '@/widgets/batting-stage/lib/substitutionEntryParticle'
import { useSceneConfirm } from '@/features/play-game/model/useSceneConfirm'
import { useSubstitutionScene } from '@/features/play-game/model/useSubstitutionScene'
import type { TeamGameSession } from '@/pages/team-game/model/useTeamGame'
import { useBatterPitchEnd } from './otherSlices'
import { type SceneUncoverInput, isSceneUncoveredOf } from './sceneConditions'

interface SceneConfirmFlowInput {
  readonly session: TeamGameSession
  readonly isPlayShown: boolean
  /** 일시정지 팝업(경기 중 메뉴 · 조작방법) — 0x52cc6 */
  readonly isFrozen: boolean
  readonly humanArrivalPlay: unknown
  readonly setPitchBusyTicks: (ticks: number) => void
  /** 덮는 것들 — 공 끝 대기(`isBatterPitchEndHolding`)는 여기서 채운다 */
  readonly cover: Omit<SceneUncoverInput, 'isBatterPitchEndHolding'>
}

/**
 * **상태 0xe — 사람 OK 를 기다린다** (`features/play-game/model/sceneConfirm`). 새 타석·반 이닝 시작·교체 연출 뒤·교체 창
 * 취소 뒤마다 진행기가 대기를 싣는다. 공격이든 수비든 같다 — 0x532b0 은 조작 객체의 공수(+0xc)를 안 본다.
 * 인트로·교대 판·수비 화면·벤치 클리어링·경기 중 메뉴·조작방법·설정·교체 창이 덮고 있으면 받지 않는다.
 * OK 뒤 굴림(돌발 0x8f158 · 0xf 진입 0x3d954)은 OK 를 받을 때 진행기가 돌린다 (`confirmScene`).
 */
export function useSceneConfirmFlow({ session, isPlayShown, isFrozen, humanArrivalPlay, setPitchBusyTicks, cover }: SceneConfirmFlowInput) {
  const { progress, actions, canBat, canPitch } = session
  const pitchEnd = useBatterPitchEnd({ isPlayShown, isFrozen })
  // 0x12 진입 틀에 공 도착 판이 섰다 — 공 끝 · 키 막음은 이제 판이 맡는다(놓는 그림은 판이 설지 몰라 대기 틱을 세웠다)
  const { notePitchPlayOpened } = pitchEnd
  useEffect(() => {
    if (humanArrivalPlay === null) return
    // (옛 `react/set-state-in-effect` 끄기 자리 — 세터를 인자로 받아 린트가 못 본다) 판이 선 그림(0x12 틱 0)은 대기 틱이 남은 채 한 번 커밋된다 — 공 끝 알림(notePitchPlayOpened)과 같은 자리에서 지운다(투수편과 같다)
    setPitchBusyTicks(0)
    notePitchPlayOpened()
  }, [humanArrivalPlay, notePitchPlayOpened, setPitchBusyTicks])
  /**
   * 사람 타석 공의 0x12 대기 — 갱신 0x4e6d4 가 상태 틱이 15(타석 끝 31: 삼진 · 볼넷 · 사구)에 닿아야 판정 A 0xae24c 가 다음 상태
   * (+0x1b6c → 0xd)를 정한다. 그 전에는 0xd · 0xe 가 아니라 다음 타자 소개 판 0x44944 도 OK 도 없다. 웹 진행기는 판정 틀에서 다음 타석
   * 대기까지 실어 두므로 공 끝 대기(`useBatterPitchEnd`)가 남은 동안은 대기를 세지 않는다 (r226 — 삼진 글자가 날던 중 소개 판이 들던 것)
   */
  const isBatterPitchEndHolding = canBat && pitchEnd.isHolding
  const isSceneUncovered = isSceneUncoveredOf({ ...cover, isBatterPitchEndHolding })
  /**
   * **교체 연출 0x16** — 사람 `#` 교체 · 대타의 OK, 0xf 진입의 CPU 대타 · CPU 투수 교체 뒤 진행기가 싣는다(`substitutionScene`).
   * "CHANGE" 애니를 다 그린 뒤 0xd 두 그림 → 0xe(등판음 0x38b64 · OK 대기). 그동안은 0xe 대기를 세지 않는다.
   */
  const substitution = useSubstitutionScene(
    progress.substitutionScene,
    progress.sceneConfirm,
    isSceneUncovered,
    // 0xe 첫 그림의 0x38b64 — 타석 캔버스가 그린 투수 · 타자 자리에 등판 파티클
    (scene) => emitSubstitutionEntryParticle(scene.entryKind),
  )
  const sceneConfirm = useSceneConfirm(
    // 진행기가 OK 를 아직 안 받은 0xe 대기 (OK 를 받으면 `confirmScene` 이 그 뒤 굴림을 돌린다)
    progress.sceneConfirmPending === true ? progress.sceneConfirm : null,
    isSceneUncovered && !substitution.isShown,
    actions.confirmScene,
  )
  const isAwaitingConfirm = sceneConfirm.isAwaiting && (canBat || canPitch)
  return { pitchEnd, substitution, sceneConfirm, isAwaitingConfirm }
}
