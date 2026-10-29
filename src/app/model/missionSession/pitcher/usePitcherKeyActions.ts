import { pickoffPlayForKey } from '@/entities/defense-controls/model/pickoff'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'
import type { PickoffPlayInput } from '@/features/defense-play/model/pickoffPlay'
import { aimTickOf, type AimDirection } from '@/features/play-pitcher-game/model/pitchAim'
import { MISSION_STAGE_SIDE } from '@/app/model/missionSession/constants/missionConstants'
import { type MissionScope, useMissionValue } from '@/app/model/missionSession/atoms/missionScope'
import { pitcherRunAtom } from '@/app/model/missionSession/atoms/runAtoms'
import {
  pendingBenchClearingAtom,
  pendingDefensePlayAtom,
  pendingRunnerPlayAtom,
  pickoffReplayAtom,
} from '@/app/model/missionSession/atoms/playAtoms'
import { missionSceneAtom, sceneResultCodeAtom } from '@/app/model/missionSession/atoms/fieldAtoms'
import { cancelPitcherResultEntryAtom } from '@/app/model/missionSession/atoms/pitcherAtoms'
import { pickoffAbilitiesOf } from '@/app/model/missionSession/batter/playAbilities'
import { isBaseOccupied } from '@/app/model/missionSession/batter/baseOccupied'
import { throwModeOf } from '@/app/model/missionSession/pitcher/throwArrival'

/** 투수 미션 사람 키 — 조준 틱 · 견제. 이 그림의 판 · 붙든 칸(클로저)을 읽는다 */
export function usePitcherKeyActions(scope: MissionScope) {
  const { atoms, random, throwModeManual } = scope
  const pitcherRun = useMissionValue(atoms, pitcherRunAtom)
  const pendingDefensePlay = useMissionValue(atoms, pendingDefensePlayAtom)
  const pendingBenchClearing = useMissionValue(atoms, pendingBenchClearingAtom)
  const pickoffReplay = useMissionValue(atoms, pickoffReplayAtom)
  const runningPitcherRun = pitcherRun !== null && pitcherRun.status === '진행중' ? pitcherRun : null
  /** 수비 화면·벤치 클리어링·앞 판 재생 · 실시간 주자 판 중이거나 공이 날거나 0x12 진입 전(0x12 진입 틀 시계)이면 상태 0xf 가 아니다 */
  const isAtPitchSelection = () =>
    pendingDefensePlay === null &&
    pendingBenchClearing === null &&
    pickoffReplay === null &&
    atoms.get(pendingRunnerPlayAtom) === null &&
    atoms.get(cancelPitcherResultEntryAtom) === null
  return {
    /**
     * **조준(상태 0x10)의 틱 하나 `0x39c5c`** — 화면(`AimCursor`)이 0x10 에 있는 동안 매 틱 부른다.
     * 걸음 · 자르기 뒤 투수 미션(모드 5 — 마선수 대결도)이면 조건코드대로 **경기 난수로** 흔든다. OK · CLR 을 누른 틱도 한 번 돈다.
     * 원본 차례: 흔들기 여러 번 → 0x11 → 놓을 때 등급 굴림(0x4dbac) → 흩어짐(0x4dc78) — `handleThrow` 가 뒤 둘이다.
     */
    aimTick: (aim: WorldPoint, direction: AimDirection): WorldPoint =>
      aimTickOf(
        aim,
        direction,
        MISSION_STAGE_SIDE,
        runningPitcherRun === null ? undefined : { conditionCode: runningPitcherRun.mission.conditionCode, random },
      ),

    /**
     * **투수 미션 사람 견제** — 구질 고르기(상태 0xf)에서 키 '3' 1루 · '1' 2루 · '7' 3루 (`PitchingScreen.onPickoffKey`).
     *
     * 원본은 모드 5 를 막지 않는다 (직접 재역어셈):
     * - 미션 경기 준비 0xaa57c 가 사람 칸을 경기[0x31 + 칸] = 0 으로 세우고(aa658), 조작 객체 생성 0x3f584 가 그 값으로
     *   0x34af8(장면, 칸, 0xb6c20 값)을 불러 0 이면 사람 조작 객체(new 0x30 · 0x53218 → vtable 0xd0a14)를 만든다
     *   (3f974~3f998). 수비측 객체는 [+0xc] = 1 (3f9c4) — 투수 미션의 사람 칸이 수비다.
     * - 키는 경기 장면 키 처리 0x498d4 의 끝(499fa~49a52)이 두 조작 객체 중 `[+0x10] == 0`(사람)에게
     *   슬롯 2 0x53290(상태, 키, r3 = 0 → [+0x1c] = 0) · 슬롯 3 0x536bc 로 넘긴다. 상태 0xe 의 틱 ≤ 2 말고는 거르지 않는다.
     * - 0x536bc 는 [+0x1c] == 0 이면 점프표 0xd0a24 로 상태 0xf → 0x53580: 수비([+0xc] ≠ 0)면 구질 0x534d8 **뒤에 이어서**
     *   견제 0x53548 을 부른다 — 구질 키가 먹는 자리면 견제 키도 늘 먹는다. 모드를 읽는 줄이 없다.
     * - 메시지 0x10 → 0x509a0(앞머리의 [장면+0x214] vt0xc 는 빈 함수 0xae5f8) → 0x50a4c → 0x50f28: 루 > 0 ·
     *   0xa9878 주자 있음 → 종류 4 · state[0x27] = 루 · 상태 0x17. 모드·미션 객체(+0x1788)를 안 본다.
     * - 모드 5·6 에서만 도는 0xaada4(장면 갱신 52ed6)는 제한 시간만 보고 키를 먹지 않는다.
     * 투수편 마선수 대결도 같은 미션 장면(모드 5)이라 같은 길이다.
     *
     * 판은 투수편 `pickoff`(4dec1e1)와 같은 입력이다: 사람 수비 · 환경설정 "송구"(+0xf4)가 0xae6c8 의 답, 공격은 CPU.
     * 끝은 판정 B 0xae3e8 — 아웃 ≤ 2 면 같은 타석 0xf(ae592), 정산 0xa8024 는 늘(ae5a8) → 실점은 주자 운명으로 센다.
     * 3아웃이면 0x18 — 타석이 끊긴다. 견제는 투구가 아니라 투구 수·볼카운트·마구 칸을 안 건드린다.
     * 수비 아홉 칸·주자 주루는 미션 타구와 같은 값이다(`missionPlayAbilitiesOf` — 사람 칸 팀 레코드 0xb0fb4 · CPU 주자 신원의 주력).
     * 견제사는 아웃 콜(결과 13 → 0xa7d0c)이 R+0x13c 를 올려 '아웃' 목표에도 든다 — 판 끝 판정 0xaaa6c(ae5c4)가 바로 본다
     * (`outCallsOf`).
     * 같은 타석으로 돌아가면 0xf 진입 0x3d954 가 CPU 대타 0xac228 을 다시 묻는다 (`missionCpuTeam`, 위 0xf 진입 효과).
     * 견제 판(종류 4)은 0x58c 밖이라 vt4c 의 사람 송구(+0x160, 0x53420 → 0x533c8 → 0x588)를 받는다 — 붙들어 화면이 실시간으로
     * 돌리고, 판 끝(`finishRunnerPlay`)이 `afterPitcherMissionPickoff` 로 먹인다. 판정 콜은 화면이 판 안의 그 틱에 낸다.
     */
    pickoff: (webKey: string) => {
      if (runningPitcherRun === null || !isAtPitchSelection()) return
      const { bases } = runningPitcherRun
      const play = pickoffPlayForKey(webKey, (base) => isBaseOccupied(bases, base))
      if (play === null) return
      const input: PickoffPlayInput = {
        targetBase: play.targetBase,
        bases,
        outs: runningPitcherRun.outs,
        random,
        // 투수 미션은 공격이 CPU 다 — 자동 진루 제어기 0xaf918 이 돈다 (0xae690 첫 항)
        offenseIsCpu: true,
        // 사람이 수비한다 — 0xae6c8 은 환경설정 "송구"(+0xf4) 혼자가 받은 야수의 0xafa60 을 켠다
        defenseIsCpu: false,
        throwMode: throwModeOf(throwModeManual),
        // 수비 아홉 칸(사람 칸 팀 레코드, 0xb0fb4) · 루별 주루(CPU 타선 주자 신원)
        ...pickoffAbilitiesOf(atoms, runningPitcherRun),
        // 경기 +0xfd4 — 견제는 0x11 을 안 지나 앞 공의 값이 남는다
        sceneResultCode: atoms.get(sceneResultCodeAtom),
        // 수비 장면 칸 — 경기 장면 · 플레이 객체는 경기 하나에 한 번 만들어져 판을 넘어 남는다
        scene: atoms.get(missionSceneAtom),
      }
      atoms.set(pendingRunnerPlayAtom, { kind: 'pickoff', input, side: '수비' })
    },
  }
}
