import { emitSubstitutionEntryParticle } from '@/widgets/batting-stage/lib/substitutionEntryParticle'
import { SCENE_PREPARE_FRAMES, confirmedCountOf, noteSceneDEntryTick } from '@/features/play-game/model/useSceneConfirm'
import { gameSceneTickNow, setGameSceneTickTimeout } from '@/shared/lib/commonWindow/commonWindow'
import { playSoundIds } from '@/app/model/useSound'
import { type MissionScope, useMissionValue } from '@/app/model/missionSession/atoms/missionScope'
import {
  halfInningBoardAtom,
  loadingTipAtom,
  newAtBatWaitAtom,
  sceneConfirmAtom,
  substitutionSceneAtom,
} from '@/app/model/missionSession/atoms/sceneAtoms'
import { shownSceneConfirmOf } from '@/app/model/missionSession/scene/announcedWait'
import { enterNewAtBatConfirm } from '@/app/model/missionSession/scene/sceneSteps'
import { useAskPitchSelection } from '@/app/model/missionSession/scene/useAskPitchSelection'

/** 장면 흐름의 화면 콜백 — 로딩 판 · 첫 0x18 판 · 0xe 의 OK · 교체 연출 끝. 이 그림의 칸(클로저)을 읽는다 */
export function useSceneFlowActions(scope: MissionScope) {
  const { atoms, audio } = scope
  const sceneConfirm = useMissionValue(atoms, sceneConfirmAtom)
  const substitutionScene = useMissionValue(atoms, substitutionSceneAtom)
  const halfInningBoard = useMissionValue(atoms, halfInningBoardAtom)
  const askPitchSelection = useAskPitchSelection(scope)
  return {
    /**
     * 로딩 판을 다 그렸다 — 상태 8 끝(48bf0)이 첫 0x18 로 보낸다. 미션은 인트로 0xc 를 안 지나 예약음 61 도 없다. 굴림 없음.
     */
    finishLoading: () => atoms.set(loadingTipAtom, null),

    /**
     * **첫 0x18 판의 OK** — 메시지 1(인자 0x18) → 0x50c18 → 0xae3a0: 모드 5 · 6 이면 판정 0xaaa6c(시작에는 아무 목표도 안 차 진행 중),
     * 경기 끝이 아니라 0xd → 0xe 에서 첫 타석 OK 를 기다린다. 굴림 없음.
     */
    confirmHalfInningBoard: () => {
      if (halfInningBoard === null) return
      atoms.set(halfInningBoardAtom, null)
      enterNewAtBatConfirm(atoms)
    },

    /**
     * 0xe 의 OK 하나 — 화면(`useSceneConfirm` 의 `onConfirm`)이 부른다. 새 타석 대기의 OK 면 0xf 진입 0x3d954 가 CPU 교체를 묻는다.
     * OK 를 받은 그 걸음 안에서 묻는다 — 교체가 나면 새 대기가 같은 걸음에 서서 공이 나가는 그림이 끼지 않는다.
     */
    confirmScene: () => {
      const wait = atoms.get(newAtBatWaitAtom)
      if (wait === null || wait !== sceneConfirm) return
      atoms.set(newAtBatWaitAtom, null)
      askPitchSelection('new')
    },

    /**
     * 화면이 교체 연출 0x16 을 다 그렸다(끝 비트 → 메시지 0xd). 0xd 두 그림 뒤 0xe 그리기(0x38d1c 38dc2 · 0x49e64 49f76 → 0x38b64)가
     * 들어온 선수 자리에 파티클을 쏘고 등판음을 낸다. 이 틀이 0xd 틱 0 이라 화면에 내놓는 대기의 0xd 진입 틱으로 적는다
     * (`noteSceneDEntryTick` — 화면의 0xe 대기가 이 틱부터 0xd 두 그림을 센다, `useSubstitutionScene` 과 같다).
     */
    finishSubstitutionScene: () => {
      const scene = substitutionScene
      if (scene === null) return
      atoms.set(substitutionSceneAtom, null)
      const shown = shownSceneConfirmOf(sceneConfirm)
      if (shown !== null) noteSceneDEntryTick(shown, confirmedCountOf(shown), gameSceneTickNow())
      // 경기 장면 틱으로 센다 — 공용 창이 서 있으면 0xd 의 장면 틱(52cc6) · 0xe 그리기(52efe)가 서기 때문이다
      // 0x38b64 — 들어온 선수 자리에 파티클(투수 ptc/004 · 타자 ptc/003)을 먼저 쏘고 등판음
      setGameSceneTickTimeout(() => {
        emitSubstitutionEntryParticle(scene.entryKind)
        playSoundIds(audio, [scene.entrySoundId])
      }, SCENE_PREPARE_FRAMES)
    },
  }
}
