import { runnerCountOf } from '@/entities/game/model/baseState'
import type { MissionRun } from '@/entities/mission/model/missionRun'
import { cpuSideOf, humanSideOf, missionFightingSpiritOf, missionTeamIdsOf } from '@/entities/mission/model/missionGame'
import {
  enterMissionPitchSelection,
  missionCpuAtNewPlateAppearance,
  missionCpuBatterOf,
  type MissionCpuTeam,
} from '@/entities/mission/model/missionCpuTeam'
import { rollCpuPitchTypeOnPitcherChangeTick } from '@/entities/pitching/model/selectPitch'
import { enterSceneConfirm } from '@/features/play-game/model/sceneConfirm'
import type { SubstitutionScene } from '@/features/play-game/model/substitutionScene'
import { aceCutInSlotOf } from '@/features/play-game/model/aceCutIn'
import { PITCHER_CHANGE_SOUND, pitcherEntrySoundIdOf } from '@/pages/team-game/model/teamGameSounds'
import { playSoundIds } from '@/app/model/useSound'
import { isPitcherSideOf, type MissionScope, useMissionValue } from '@/app/model/missionSession/atoms/missionScope'
import { missionRunAtom, pitcherAceMatchMissionAtom, pitcherRunAtom } from '@/app/model/missionSession/atoms/runAtoms'
import { pitcherStealDisplayAtom } from '@/app/model/missionSession/atoms/fieldAtoms'
import { sceneConfirmAtom, substitutionSceneAtom } from '@/app/model/missionSession/atoms/sceneAtoms'
import { missionMoundPitcherAbility } from '@/app/model/missionSession/opponent/missionOpponent'
import { missionAceMoundStaminaOf, missionCpuMagicStateOf } from '@/app/model/missionSession/opponent/opponentStamina'
import { missionCpuBatterRecordSlotOf } from '@/app/model/missionSession/lineup/cpuBatter'
import { clearStealDisplay } from '@/app/model/missionSession/scene/sceneSteps'

type Substitution = NonNullable<ReturnType<typeof enterMissionPitchSelection>['substitution']>

/** 0xf 진입의 마선수 등장 컷인 · 대타의 응원 되돌림 칸 — 교체 연출이 그린다 */
function substitutionExtrasOf(run: MissionRun, cpu: MissionCpuTeam, substitution: Substitution) {
  const isPinchHitter = substitution.kind === '대타'
  return {
    // 마선수 등장 컷인 0x473f0 번호 — 미션 상대 마선수(1 부터) 0xb63a1 = opponentAce − 1, 대타면 +5
    ...(substitution.incomingIsAce && run.mission.opponentAce > 0
      ? { aceSlot: aceCutInSlotOf(isPinchHitter ? '타자' : '투수', run.mission.opponentAce - 1) }
      : {}),
    // 0x16 진입 3d562 0x668cc(스킨, 공격 팀, 0) — 확정 0xaebe4 앞이라 나가는 CPU 타자의 레코드 칸을 공격 측(st[9])에
    ...(isPinchHitter
      ? { cheerRestore: { attackSide: run.game.offenseSide, recordSlot: missionCpuBatterRecordSlotOf(run, missionCpuBatterOf(cpu)) } }
      : {}),
  }
}

/** 교체 연출 0x16 한 판 — 번호는 앞 판 + 1 */
function substitutionSceneOf(
  previous: SubstitutionScene | null,
  run: MissionRun,
  cpu: MissionCpuTeam,
  substitution: Substitution,
): SubstitutionScene {
  return {
    serial: (previous?.serial ?? 0) + 1,
    // 0x38b64 의 가지 — 투수 교체는 투수 ptc/004 · 대타는 타자 ptc/003
    entryKind: substitution.kind === '대타' ? '타자' : '투수',
    incomingIsAce: substitution.incomingIsAce,
    entrySoundId: pitcherEntrySoundIdOf({ isAce: substitution.incomingIsAce, bases: run.bases }),
    ...substitutionExtrasOf(run, cpu, substitution),
  }
}

/**
 * **상태 0xf 진입 `0x3d954`** — 미션 CPU 교체 (`entities/mission/model/missionCpuTeam`).
 * 타자 미션(모드 6)은 CPU 투수 교체 0xac428, 투수 미션(모드 5)은 CPU 대타 0xac228 — 나리 타자편 · 투수편과 같은 자리(3da3e ·
 * 3da70)의 같은 함수다. 나면 22 "Time!"(3da88) → 교체 연출 0x16(`SubstitutionSceneOverlay` — game_ui 애니 9 "CHANGE" 17 그림)
 * → 0xd(지우기 건너뜀) 두 그림 → 0xe 에서 들어온 선수의 등판음(0x38b64 — 마선수 26 · 2·3루 주자 15 · 그 밖 14)을 내고
 * **OK 를 한 번 더** 기다린 뒤 0xf 재진입 — 그때는 state[0xd](교체 직후) · state[0xe](대타 막음)가 서 있어 굴림 없이 지나므로
 * 다시 묻지 않는다.
 * - 새 타석: 0xe 의 OK(메시지 1 → 0x50c18 → 0xf)를 받는 화면 콜백(`confirmScene`)에서 묻는다 — 원본 차례 그대로 22 가 OK 뒤에 난다.
 * - 같은 타석 다음 공: 원본은 결과 상태 0x12 가 끝난 뒤(문턱 갱신 0x4e6d4 가 예약한 다음 틀) 0xf 로 들어서 22 가 그때 난다.
 *   타자 미션은 결과 띠가 걷힌 뒤(0x12 끝), 투수 미션은 놓은 틀에서 0x12 진입 · 문턱 + 1 틱 뒤(`pitchSelectionEntryDelayTicksOf`)에
 *   묻는다(아래 효과). 그 사이 진행기 굴림은 없다 — 0x12 동안 도는 파티클 관리자 틱(경기 난수)과의 차례는 원본대로 그 뒤가 된다.
 *
 * 이 그림의 판(클로저)을 읽는다 — 그린 뒤의 고리는 지난 그림의 이 함수를 부른다(`usePitchSelectionEntry`).
 */
export function useAskPitchSelection(scope: MissionScope) {
  const { atoms, screen, runner, random, aceLevels, audio } = scope
  const missionRun = useMissionValue(atoms, missionRunAtom)
  const pitcherRun = useMissionValue(atoms, pitcherRunAtom)
  const pitcherAceMatchMission = useMissionValue(atoms, pitcherAceMatchMissionAtom)
  const isPitcherSide = isPitcherSideOf(screen.kind, pitcherAceMatchMission)

  /** 0xf 진입이 CPU 팀을 고쳤으면 그 편 판에 싣는다 */
  const storeCpuTeam = (team: MissionCpuTeam) => {
    if (isPitcherSide) atoms.set(pitcherRunAtom, (previous) => (previous === null ? previous : { ...previous, cpu: team }))
    else atoms.set(missionRunAtom, (previous) => (previous === null ? previous : { ...previous, cpu: team }))
  }

  /**
   * 투수 교체를 예약한 그 틱(0xf 틱 0)에도 CPU 조작 0x53850(수비 쪽)이 0x644 → 0x344dc 를 한 번 부른다 — 내려가는 투수의
   * 구질 목록으로 (`rollCpuPitchTypeOnPitcherChangeTick`). CPU 대타(투수 미션)는 CPU 가 공격 쪽이라 없다.
   * 맞바꿈은 다음 확정 0xaebe4 라 0x344dc 의 0xae83c[+0x18] 마구 · 0xaea10(팀 +0x28 남은 마구)이 모두 내려가는 투수 쪽이다
   * (34516 · 34524 — 마구 > 0 · 남은 > 0 · 마구 조건이면 22 를 적고 안 굴린다, 아니면 34566 rand(0,6)). 남은 마구는 미션 CPU 팀이
   * 드는 +0x28(`missionCpuMagicStateOf` — 소모 0x345fc 가 줄인 값, 안 찼으면 0xd 진입 0xaebe4 aeea8 처럼 지금 마운드 투수로 채움),
   * 볼카운트는 타석 세션의 이 0xf 진입 때 값 — 타자편 진행기(`AtBatCount`)와 같다
   */
  const rollChangeTick = (run: MissionRun, cpu: MissionCpuTeam) =>
    rollCpuPitchTypeOnPitcherChangeTick(
      {
        repertoire: missionMoundPitcherAbility({ ...run, cpu }, aceLevels).repertoire,
        magicRemaining: missionCpuMagicStateOf({ ...run, cpu }, aceLevels)?.remaining,
        runnerCount: runnerCountOf(run.bases),
        strikes: runner.atBatRef.current.strikes,
        balls: runner.atBatRef.current.balls,
      },
      random,
    )

  return (kind: 'new' | 'same') => {
    // 3d966~3d976 — st[0x14..0x17] · st[0xa4..0xa7] = 0 (도루 출발 표시). 교체 묻기(3da3e · 3da70)보다 앞이다
    clearStealDisplay(atoms)
    atoms.set(pitcherStealDisplayAtom, (previous) =>
      previous === null || previous.selectionEntered ? previous : { ...previous, selectionEntered: true },
    )
    const run = isPitcherSide ? pitcherRun : missionRun
    if (run === null || run.status !== '진행중') return
    // 새 타석 0xd(0x48d50 48eb6)가 state[0xe] 를 내린다
    const cpu = kind === 'new' ? missionCpuAtNewPlateAppearance(run.cpu) : run.cpu
    const { team, substitution } = enterMissionPitchSelection(
      cpu,
      {
        mission: run.mission,
        runnerCount: runnerCountOf(run.bases),
        balls: runner.atBatRef.current.balls,
        strikes: runner.atBatRef.current.strikes,
        aceStamina: missionAceMoundStaminaOf(run),
        inningIndex: run.game.inning,
        lead: run.game.scores[cpuSideOf(run.mission)] - run.game.scores[humanSideOf(run.mission)],
        // 마무리 정렬 열쇠 0xb5b50 의 스킬 14 갈래 — 지금 판의 경기 상태 (`missionFightingSpiritOf`)
        fightingSpirit: missionFightingSpiritOf(run, missionTeamIdsOf(run).cpu),
      },
      random,
    )
    if (team !== run.cpu) storeCpuTeam(team)
    if (substitution === null) return
    if (substitution.kind === '투수교체') rollChangeTick(run, cpu)
    // 3da88 — 0x16 에 들어서기 전
    playSoundIds(audio, [PITCHER_CHANGE_SOUND])
    atoms.set(substitutionSceneAtom, (previous) => substitutionSceneOf(previous, run, cpu, substitution))
    // 0x16 → 0xd → 0xe — 새 대기(화면은 연출이 끝난 뒤부터 0xd 두 그림을 센다)
    atoms.set(sceneConfirmAtom, enterSceneConfirm())
  }
}
