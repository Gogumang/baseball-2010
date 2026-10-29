import type { OriginalMission } from '@/shared/config/original/missions'
import { matchResultEventOf } from '@/entities/story/model/aceMatch'
import { giveUp as giveUpMission } from '@/entities/mission/model/missionRun'
import { type MissionAtoms, type MissionScope, useMissionValue } from '@/app/model/missionSession/atoms/missionScope'
import { missionRunAtom, pitcherAceMatchMissionAtom, pitcherRunAtom } from '@/app/model/missionSession/atoms/runAtoms'
import {
  pendingBenchClearingAtom,
  pendingDefensePlayAtom,
  pendingRunnerPlayAtom,
  pickoffReplayAtom,
} from '@/app/model/missionSession/atoms/playAtoms'
import { loadingTipAtom } from '@/app/model/missionSession/atoms/sceneAtoms'
import { cancelPitcherResultEntryAtom } from '@/app/model/missionSession/atoms/pitcherAtoms'
import { leaveMissionResult } from '@/app/model/missionSession/result/leaveResult'

/** 붙든 판을 모두 내린다 — 수비 화면 · 재생 · 실시간 주자 판 · 붙든 타석 결과 */
function dropHeldPlays(atoms: MissionAtoms): void {
  atoms.set(pendingDefensePlayAtom, null)
  atoms.set(pickoffReplayAtom, null)
  atoms.set(pendingRunnerPlayAtom, null)
  atoms.set(pendingBenchClearingAtom, null)
}

/** 못 맞힌 공의 0x12 진입 틀 시계를 거둔다 — 미션을 나가거나 포기하면 원본도 그 틀에 닿지 않는다 */
export function cancelPitcherResultEntry(atoms: MissionAtoms): void {
  atoms.get(cancelPitcherResultEntryAtom)?.()
  atoms.set(cancelPitcherResultEntryAtom, null)
}

/** 미션 · 대결을 끝내고 떠나는 액션 — 이 그림의 판(클로저)을 읽는다 */
export function useEndActions(scope: MissionScope, begin: (mission: OriginalMission) => void) {
  const { atoms, runner, screen, setScreen } = scope
  const missionRun = useMissionValue(atoms, missionRunAtom)
  const pitcherRun = useMissionValue(atoms, pitcherRunAtom)
  const pitcherAceMatchMission = useMissionValue(atoms, pitcherAceMatchMissionAtom)
  /**
   * **경기 중 메뉴 "나가기"** — 경기 상태 0x22 갱신 `0x40140` 은 밀기가 끝나면 모드 5·6 에서 `0xa5368(미션, 0)`(실패 — 횟수·보상·해금을
   * 안 건드리고 [obj+0xbc] = 0 만) 뒤 0x140006c = 4 · 장면 0x103(메인 메뉴 처음 단). 결과 화면(상태 0x19)도 미션 목록(장면 0x107)도
   * 지나지 않는다. 클리어 기록은 그대로다. 다시 들어오면 [최근게임] 5·6 → 하위 17(선수 고르기) — 미션 모드를 떠나면 고른 선수가 내려간다
   */
  const quitToMainMenu = (clearRun: () => void) => {
    dropHeldPlays(atoms)
    clearRun()
    atoms.set(loadingTipAtom, null)
    runner.setIsPaused(true)
    setScreen({ kind: '메인메뉴' })
  }
  return {
    /**
     * 투수편 마선수 대결이 끝났다 — **이겼나**를 돌려준다 (대결 중이 아니면 null).
     *
     * 원본 경기 뒤 0x4ea0c 의 모드 5·6 갈래: 0x4ef3e 가 `g[0x11f]`·`g[0x176]` 이 서 있으면 G 보상을 건너뛰고,
     * 0x4f004~0x4f018 이 `g[0x177] = [미션객체+0xbc]` 를 적는다 — +0xbc 는 미션 끝 0x509a0 → 0xa5368(obj, 목표 달성?)
     * 이 적은 **성공 여부**다. 105 진입 0x10df8 이 이 바이트로 `resultEvents[이김 ? 0 : 1]` 을 고른다 (0x10e40).
     * 그래서 이김 = 미션 상태 '성공'. 미션 클리어 G 보상은 없다 (`rememberCleared` 를 안 부른다).
     *
     * 0xa5368(obj, 1) 은 플래그를 안 보고 `[obj+0xbd] ≤ 15` 면 클리어 횟수 칸(전역 +0x150 + 편×16 + idx)을 올린다.
     * 대결의 +0xbd 는 SYS 8 이 `g[0x175]` 와 같은 team − 1(15~19)로 적는다(0x8d88a~0x8d890) — 그래서
     * team 16(메디카, 레코드 15)을 이겼을 때만 투수 15번 칸이 −1 에서 하나 오른다 (`rememberAceMatchCleared`).
     */
    finishPitcherAceMatch: (): boolean | null => {
      if (pitcherRun === null || pitcherAceMatchMission === null) return null
      // 결과 바이트 · 클리어 칸은 판이 설 때 정산이 적었다
      const isWin = pitcherRun.status === '성공'
      atoms.set(pitcherRunAtom, null)
      atoms.set(pitcherAceMatchMissionAtom, null)
      atoms.set(pendingDefensePlayAtom, null)
      atoms.set(pendingBenchClearingAtom, null)
      return isWin
    },

    /**
     * 타자편 마선수 대결이 끝났다 — 결과 이벤트로 돌아간다. SYS 8 의 타자편 갈래(0x8d782~0x8d7ce)도 g[0xf7] = team − 1 ·
     * g[0x11f] = 1 을 적고 미션객체 +0xbd = team − 1 · +0xbf = 6 이라, 이기면 0xa5368(obj, 1) 이 타자 15번 칸을 올린다
     * (team 16 일 때만 — `rememberAceMatchCleared`). G 보상은 0x4ef3e 가 g[0x11f] 로 건너뛴다.
     */
    finishAceMatch: () => {
      if (missionRun === null || screen.kind !== '마선수대결') return
      // 결과 바이트 · 클리어 칸은 판이 설 때 정산이 적었다
      const eventId = matchResultEventOf(screen.resultEvents, missionRun.status === '성공')
      atoms.set(missionRunAtom, null)
      setScreen({ kind: '이벤트', eventId, context: screen.context, carried: screen.carried })
    },

    giveUpBatter: () => {
      dropHeldPlays(atoms)
      if (missionRun !== null) atoms.set(missionRunAtom, giveUpMission(missionRun))
    },

    /** **경기 중 메뉴 "나가기"** (보통 타자 미션, 모드 6) — 위 `quitToMainMenu` */
    quitBatterMission: () => quitToMainMenu(() => atoms.set(missionRunAtom, null)),

    /** **경기 중 메뉴 "나가기"** (보통 투수 미션, 모드 5) — `quitBatterMission` 과 같은 길이다(0x22 갱신 `0x40140` 의 모드 5·6 갈래) */
    quitPitcherMission: () => {
      cancelPitcherResultEntry(atoms)
      quitToMainMenu(() => atoms.set(pitcherRunAtom, null))
    },

    giveUpPitcher: () => {
      cancelPitcherResultEntry(atoms)
      atoms.set(pendingDefensePlayAtom, null)
      atoms.set(pendingBenchClearingAtom, null)
      if (pitcherRun !== null) atoms.set(pitcherRunAtom, { ...pitcherRun, status: '실패' })
    },

    /**
     * 결과 판(0x19) "아니오"·CLR — 0x140006c = 1 → 장면 0x107 상태 1(미션 목록). 대기가 서 있으면 판이 대결 꼴이라 어느 키든
     * g[0xf6] 의 나리 장면으로 간다(`leaveMissionResult`).
     */
    finishBatter: () => {
      if (missionRun === null || !leaveMissionResult(scope)) return
      atoms.set(missionRunAtom, null)
    },

    finishPitcher: () => {
      if (pitcherRun === null || !leaveMissionResult(scope)) return
      atoms.set(pitcherRunAtom, null)
    },

    /**
     * 결과 판(0x19) "예" — 0x140006c = 3 → 장면 0x107 상태 3 진입 0x1e908: 같은 미션(obj+0xbd = this+0x9c)을
     * `0xa5368(obj, 0)` 뒤 곧바로 장면 0x104 로 다시 세운다(목록을 안 지난다, Q2 2a). 보상은 진입 0x4ea0c 가 이미 줬다.
     * 경기 중 메뉴 "다시하기" 0x3c98e 도 모드 5 · 6 이면(3c9bc) 0x140006c = 3 · 장면 0x107(3c9ce)로 같은 길이고, 목록에서 다음 미션을
     * 고르는 것도 새 장면 0x104 다 — 셋 다 상태 7 → 9 → 8 → 첫 0x18 판(굴림 36 · OK 대기)을 다시 지난다(`begin` · `openFirstHalfBoard`).
     */
    retryBatter: () => {
      if (missionRun !== null) begin(missionRun.mission)
    },

    retryPitcher: () => {
      if (pitcherRun !== null) begin(pitcherRun.mission)
    },
  }
}
