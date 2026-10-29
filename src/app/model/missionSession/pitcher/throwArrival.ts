import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { AtBatState } from '@/entities/at-bat/model/atBatState'
import { MISSION_PITCHER_MODE, recordPitch, type PitcherRun } from '@/entities/mission/model/pitcherRun'
import { missionCpuAfterPitch, type MissionCpuTeam } from '@/entities/mission/model/missionCpuTeam'
import { missionDefenseAbilitiesOf, type missionRunAbilitiesOnBaseOf } from '@/entities/mission/model/missionRunners'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import { countsTopGradePitch } from '@/entities/pitcher-career/model/pitcherGameRecord'
import type { pitchAgainstBatterDetailed } from '@/entities/pitching/model/simulateBatter'
import {
  arrivalApplicationOf,
  arrivesUnhit,
  openPitchArrivalPlay,
  pitchJudgementOf,
  type OpenedPitchArrivalPlay,
  type PitchArrivalPlay,
} from '@/features/defense-play/model/pitchArrivalPlay'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { SoundPort } from '@/shared/api/audio/soundPort'
import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import { MAX_GAUGE_GRADE } from '@/app/model/missionSession/constants/missionConstants'
import type { MissionAtoms } from '@/app/model/missionSession/atoms/missionScope'
import { missionSceneAtom, sceneResultCodeAtom } from '@/app/model/missionSession/atoms/fieldAtoms'
import { pitchArrivalPlatesOf, playAbilitiesOf } from '@/app/model/missionSession/batter/playAbilities'
import type { HumanPitch } from '@/app/model/missionSession/pitcher/humanPitch'

/** 공 하나의 손잡이 — 칸 · 타석 · 난수 · 소리 · 환경설정(송구 · 진동) */
export interface ThrowHands {
  readonly atoms: MissionAtoms
  readonly runner: AtBatRunner
  readonly random: RandomPort
  readonly audio: SoundPort
  readonly throwModeManual: boolean | undefined
  readonly isVibrationOn: boolean | undefined
}

/** 놓은 공 하나 — 놓기 전 판 · 사람 공 · CPU 스윙 · 판정 뒤 타석 · 0x12 진입 · 다음 0xf 까지의 틱 */
export interface ThrownPitch {
  readonly run: PitcherRun
  readonly typeNumber: number
  readonly human: HumanPitch
  readonly swing: ReturnType<typeof pitchAgainstBatterDetailed>
  readonly stealingFrom: readonly StealBase[]
  readonly runAbilities: ReturnType<typeof missionRunAbilitiesOnBaseOf>
  readonly cpuAfterSwing: MissionCpuTeam
  /** 이 공 **전** 스트라이크 — 0x9d57c 의 st[4] (삼진 진동이 본다) */
  readonly strikesBefore: number
  readonly nextAtBat: AtBatState
  readonly outcome: AtBatOutcome | null
  readonly runsDefense: boolean
  readonly resultEntryTicks: number
  readonly pitchSelectionTicks: number
}

/** 환경설정 "송구" — 사람이 수비라 0xae6c8 은 이 설정 혼자가 답이다(안 넘기면 원본 기본값 수동) */
export const throwModeOf = (throwModeManual: boolean | undefined) => (throwModeManual === false ? '자동' : '수동')

/**
 * 공 도착 0x3dfac — 못 맞힌 공이면 0.1% 폭투·포일(종류 9)이나 CPU 가 건 도루(종류 5) 판을 연다. 판 시작까지만 연다 —
 * 상태 0x17 키 0x53420 은 조작 [+0xc] ≠ 0(사람 수비)이면 판 종류 · 모드를 안 보고 송구 0x533c8 → 메시지 0x588 → 0x51890 →
 * 플레이 vt60 0xb3118 → +0x160 을 적고, 슬롯 2 의 52602 가 종류 ∉ 0x58c {2, 3, 7, 8, 10} 이면 vt4c 0xb45dc(b4660 사람 목표)를
 * 부른다 — 도루(5) · 폭투(9) 판은 사람 키로 던지므로 붙들어 화면이 실시간으로 돌린다(투수편 `startPitch(…, true)` 와 같은 길)
 */
export function openPitcherArrival({ atoms, random, throwModeManual }: ThrowHands, thrown: ThrownPitch): OpenedPitchArrivalPlay | null {
  const { run, swing } = thrown
  if (!arrivesUnhit(swing.resolution)) return null
  return openPitchArrivalPlay(
    {
      gameMode: MISSION_PITCHER_MODE,
      pitchJudgement: pitchJudgementOf(swing.resolution, thrown.outcome),
      stealingFrom: thrown.stealingFrom,
      bases: run.bases,
      outs: run.outs,
      // CPU 타자의 손 0xb63c0 — 공의 화면 배치(`simulateBatter` 가 맞은 공의 손으로 쓰는 값). 밀어내기 · 낫아웃 타석 자리
      batterHand: thrown.human.pitch.stageSide,
      // 루별 주루 — CPU 타선 주자 신원대로, 0 은 지금 타자(낫아웃 타자주자)
      runAbilities: thrown.runAbilities,
      // 아홉 칸 수비 — 사람 칸 팀 레코드(판 시작 0xb0fb4 — `missionDefenseAbilitiesOf`)
      defenseAbilities: missionDefenseAbilitiesOf(run),
      // 그림 전용 — 공 가진 야수 이름 판(0x43cb0, 칸 0 = 미션 투수) · CPU 마타자 주자 그림(0x79d10)
      ...pitchArrivalPlatesOf(playAbilitiesOf(atoms, run)),
      defenseIsCpu: false,
      offenseIsCpu: true,
      throwMode: throwModeOf(throwModeManual),
      // 장면 +0xfdc — CPU 타자의 이 공 번트 종류. 휘두른 공은 0x3445a 가 쓴 값(번트 헛스윙도 남는다), 안 휘두른 공은
      // 0x11 진입 0x340dc 의 memset(+0xfd8, 0, 12)이 지운 0 (`pitchAgainstBatterDetailed` 의 `buntKind`) — 도루 리드 0x3d7b8 의 +3 틱이 본다
      buntKind: swing.buntKind ?? 0,
      // 경기 +0xfd4 — 이 공의 값
      sceneResultCode: atoms.get(sceneResultCodeAtom),
      // 수비 장면 칸 — 경기 장면 · 플레이 객체는 경기 하나에 한 번 만들어져 판을 넘어 남는다
      scene: atoms.get(missionSceneAtom),
    },
    random,
  )
}

/** 낫아웃 판(종류 9 · 타자주자)인가 — 붙든 판이면 그 갈래, 미리 돌린 판이면 그 정산 */
function isNotOutPlay(held: OpenedPitchArrivalPlay | null, play: PitchArrivalPlay | null): boolean {
  if (held !== null) return held.kind === 9 && held.strikeout === 'batterRuns'
  return play !== null && arrivalApplicationOf(play) === 'batterRuns'
}

/**
 * 0xa5e14 — 사람이 던져도 공마다 state[0xd] · state[0xe](CPU 대타 막음)를 내린다 (a5e72 · a5e7c).
 * MAX게이지(R+0x158)는 공 도착 0x3dfac 의 스트라이크 · 삼진 갈래만 센다 — 낫아웃 판(종류 9 · 타자주자)은 v 를 0 으로 지워 건너뛴다
 */
export function recordThrownPitch(thrown: ThrownPitch, held: OpenedPitchArrivalPlay | null, play: PitchArrivalPlay | null): PitcherRun {
  const { run, human, swing } = thrown
  const cpu = missionCpuAfterPitch(thrown.cpuAfterSwing, { pitchTypeNumber: thrown.typeNumber, batterIntimidates: human.cpuBatterIntimidates })
  const isMaxGauge = human.grade === MAX_GAUGE_GRADE && countsTopGradePitch(swing.resolution.kind === '스트라이크', isNotOutPlay(held, play))
  return recordPitch({ ...run, cpu }, isMaxGauge)
}
