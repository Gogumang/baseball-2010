import { useCallback } from 'react'
import { contactOutcomeOfDetail, type PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { preRollContactMessage } from '@/features/defense-play/model/runDefensePlay'
import { missionDefensePlayInputOf, type MissionRun } from '@/entities/mission/model/missionRun'
import { startHumanSteal, stealStartSceneOf } from '@/features/defense-play/model/pitchArrivalPlay'
import type { PickoffPlayInput } from '@/features/defense-play/model/pickoffPlay'
import type { PickoffBase } from '@/entities/defense-controls/model/pickoff'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import type { MissionAtoms, MissionScope } from '@/app/model/missionSession/atoms/missionScope'
import { missionRunAtom } from '@/app/model/missionSession/atoms/runAtoms'
import { pendingBenchClearingAtom, pendingDefensePlayAtom, pendingRunnerPlayAtom } from '@/app/model/missionSession/atoms/playAtoms'
import { missionSceneAtom, sceneResultCodeAtom, stealInputAtom, stealingFromAtom } from '@/app/model/missionSession/atoms/fieldAtoms'
import { pickoffAbilitiesOf, playAbilitiesOf } from '@/app/model/missionSession/batter/playAbilities'
import { isBaseOccupied } from '@/app/model/missionSession/batter/baseOccupied'

/** 지금 판이 진행 중이고 0xf 에 서 있나 — 수비 화면 · 실시간 주자 판 · 붙든 볼넷 · 사구(0x12 대기 · 벤치 클리어링)가 아니다 */
function runAtPitchSelection(atoms: MissionAtoms): MissionRun | null {
  const current = atoms.get(missionRunAtom)
  if (current === null || current.status !== '진행중') return null
  if (atoms.get(pendingDefensePlayAtom) !== null || atoms.get(pendingRunnerPlayAtom) !== null) return null
  return atoms.get(pendingBenchClearingAtom) === null ? current : null
}

/**
 * **맞은 판정 틀** — 메시지 0x11 굴림 묶음(필살수비 · 표시 패턴 · 두 공 폴 · 필살타법)을 이 공으로 설 판 입력으로 미리 굴린다(A-37).
 * 0x13 뒤 `handleMissionPitch` 가 세우는 판은 쏜 공에 묶인 그 값을 되찾는다 (수비 칸은 그 사이 안 바뀐다)
 */
export function usePreRollContact({ atoms, random }: MissionScope) {
  return useCallback(
    (detail: PitchOutcomeDetail, buntKind: number) => {
      const current = atoms.get(missionRunAtom)
      const outcome = contactOutcomeOfDetail(detail)
      if (current === null || outcome === null) return null
      return preRollContactMessage({
        ...missionDefensePlayInputOf(current.bases, current.outs, outcome, random, undefined, undefined, playAbilitiesOf(atoms, current)),
        buntKind,
      })
    },
    [atoms, random],
  )
}

/** 타자 미션 사람 키 — CPU 투수의 견제를 받는 자리 · 도루 출발 */
export function useBatterKeyActions(scope: MissionScope) {
  const { atoms, runner, random, batterRunningMode } = scope
  return {
    /**
     * **CPU 투수의 견제** — 타석 화면(`BattingStage.onPickoff`)이 상대 투수 AI 가 목표점 대신 고른 루를 알려 준다.
     *
     * 원본 길은 미션(모드 6)에서도 그대로 돈다 (직접 재역어셈):
     * CPU 조작 객체 0x53874 → 0x53824 `[+0x18] > 5` → 메시지 0x645 → 0x509a0 → 0x5121c → `0x345fc`
     * (모드 갈림은 0x3460e `+0x1104 == 7` 홈런더비 하나) → 종류 4 → `0x34848` 루 굴림 → 메시지 0x10 →
     * `0x50f28`(루 > 0 · 0xa9878 주자 있음 → 종류 4 · 상태 0x17, 모드·미션 객체를 안 본다).
     * 미션 객체로 걸러지는 0x66864 는 CPU 투수 교체 0x3d954·0xc1ba4 에서만 불린다(xref) — 견제 길에는 없다.
     *
     * 판은 바로 다 돌려 진루·아웃을 먹이고(`applyPickoff`), 화면은 `pickoffReplay` 를 재생한다(나만의리그와 같은 꼴).
     * 남은 타석·스윙은 그대로다 — 공을 안 던졌다. 볼카운트도 그대로지만, 견제사로 3아웃이면 판정 B 0xae3e8 이 0x18 로 보내
     * 이 타석이 끊기고 다음은 새 타석(0xd → 0xe)이다.
     * 수비 능력치·주루는 미션 타구와 같은 값이다(`missionPlayAbilitiesOf` — CPU 수비 팀 레코드 0xb0fb4 · 주자 신원의 주력), 사람 공격,
     * 주루는 환경설정 "주루"(설정 +0xbd)다 — 사람 공격이라 0xae690 첫 항이 거짓이어서 둘째 항(0x46418 이 넘기는 +0xbd)이 답이다.
     *
     * 판정 콜 — 세이프면 늘 17 (0x51c14 의 종류 4·5 갈래), 견제사면 62/20 (0x51b36). 원본은 결과 코드가 선 플레이 **틱**(메시지 0xbba)에
     * 낸다 — 판을 붙들어 화면이 실시간으로 돌리므로 그 틱에 화면이 낸다(`afterMissionCpuPickoff` 의 `callShown`). 화면이 결과를 못 넘긴
     * 판만 판 끝에서 낸다.
     */
    cpuPickoff: (base: PickoffBase) => {
      const current = runAtPitchSelection(atoms)
      if (current === null || !isBaseOccupied(current.bases, base)) return
      const input: PickoffPlayInput = {
        targetBase: base,
        bases: current.bases,
        outs: current.outs,
        random,
        // 타자 미션은 사람이 공격이다 (`missionDefensePlayInputOf` 의 offenseIsCpu 와 같다) — 주루 설정이 먹는다 (0xae690)
        offenseIsCpu: false,
        runningMode: batterRunningMode,
        // 수비는 CPU 다 — 미션 경기 준비 0xaa57c 가 레코드 +3 의 윗 4비트 칸을 사람(aa658 `0xb6c18(st, 칸, 0)`),
        // 다른 칸을 CPU(aa666 `… , 1)`)로 세우고, 타자 미션의 사람 칸은 공격이라 수비측 경기[0x31 + 수비측] == 1 이다.
        // 슬롯 2 의 0xae6c8 첫 항이 서서 받은 야수의 0xafa60 이 매 틱 돈다 (d80918a · 4dec1e1 의 타자편 cpuPickoff 와 같다).
        // 송구 설정(+0xf4)은 둘째 항이라 안 넘긴다
        defenseIsCpu: true,
        // 수비 아홉 칸(CPU 팀 레코드, 0xb0fb4) · 루별 주루(사람 칸 팀 주자 신원)
        ...pickoffAbilitiesOf(atoms, current),
        // 경기 +0xfd4 — 견제는 0x11 을 안 지나 앞 공의 값이 남는다
        sceneResultCode: atoms.get(sceneResultCodeAtom),
        // 수비 장면 칸 — 경기 장면 · 플레이 객체는 경기 하나에 한 번 만들어져 판을 넘어 남는다
        scene: atoms.get(missionSceneAtom),
      }
      // 견제 판(종류 4)은 0xae794 마스크 0x232 안이라 사람 주루 키(0x5331c → 0x582 · 0x584 → 0xa9b04)와 OK 슬라이딩(0x585)을
      // 받는다 — 붙들어 화면이 실시간으로 돌리고, 판 끝(`finishRunnerPlay`)이 `afterMissionCpuPickoff` 로 먹인다
      atoms.set(pendingRunnerPlayAtom, { kind: 'pickoff', input, side: '공격' })
      runner.setIsPaused(true)
    },

    /**
     * **도루 출발** — 타자 미션의 사람 키 '3' 1루 · '2' 2루 · '1' 3루 주자(`0x53610` → 메시지 0x583 → `0xa9bd4`).
     * 주자를 출발시키고 같은 메시지의 52222 가 CPU 송구 결정 0xafa60 을 한 번 돌린다(앞 판 수비가 공을 쥐었을 때만 굴림 —
     * `stealStartSceneOf`, r214). 성공·실패는 공이 도착할 때 도루 판(종류 5)이 정한다(`handleMissionPitch`). 소리 없음.
     * 사람 경기 도루는 간이 엔진 표 0xd9064 가 아니다(c18a833).
     */
    steal: (base: StealBase) => {
      const current = runAtPitchSelection(atoms)
      if (current === null) return
      const before = atoms.get(stealInputAtom)
      const next = startHumanSteal(current.bases, before, base)
      if (next === before) return
      // 수비 · 주자 칸은 공 도착 판(`playAbilitiesOf` — CPU 수비 팀 레코드 · 사람 칸 타순 주자)과 같다
      const { defenseAbilities, runAbilities } = playAbilitiesOf(atoms, current)
      atoms.set(
        missionSceneAtom,
        stealStartSceneOf(
          { scene: atoms.get(missionSceneAtom), bases: current.bases, outs: current.outs, defenseAbilities, runAbilities },
          next,
          random,
        ),
      )
      atoms.set(stealInputAtom, next)
      atoms.set(stealingFromAtom, next)
    },
  }
}
