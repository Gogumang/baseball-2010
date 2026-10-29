import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { AtBatState } from '@/entities/at-bat/model/atBatState'
import { registerContact } from '@/entities/batting/model/battedContact'
import { runnerCountOf } from '@/entities/game/model/baseState'
import { MISSION_BATTER_MODE, missionDefensePlayInputOf, recordSwing, type MissionRun } from '@/entities/mission/model/missionRun'
import { openPitchArrivalPlay, pitchJudgementOf, type OpenedPitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { SoundPort } from '@/shared/api/audio/soundPort'
import { playSoundIds } from '@/app/model/useSound'
import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import { FOUL_PLAY_OUTCOME } from '@/app/model/missionSession/constants/missionConstants'
import type { MissionAtoms } from '@/app/model/missionSession/atoms/missionScope'
import { missionRunAtom } from '@/app/model/missionSession/atoms/runAtoms'
import { pendingDefensePlayAtom } from '@/app/model/missionSession/atoms/playAtoms'
import { missionSceneAtom, sceneResultCodeAtom } from '@/app/model/missionSession/atoms/fieldAtoms'
import { clearStealDisplay, takeStealingFrom } from '@/app/model/missionSession/scene/sceneSteps'
import { playAbilitiesOf } from '@/app/model/missionSession/batter/playAbilities'

/** 타자 미션 공 하나의 손잡이 — 칸 · 타석 · 난수 · 소리 · 환경설정 주루 */
export interface BatterPitchHands {
  readonly atoms: MissionAtoms
  readonly runner: AtBatRunner
  readonly random: RandomPort
  readonly audio: SoundPort
  readonly batterRunningMode: '수동' | '자동'
}

/** 배트를 냈다 — 스윙 수는 휘두른 자리에서 준다 */
export function recordSwingIf(atoms: MissionAtoms, hasSwung: boolean): void {
  if (hasSwung) atoms.set(missionRunAtom, (previous) => (previous === null ? previous : recordSwing(previous)))
}

/** 판 입력의 공통 칸 — 수비 아홉 칸 · 루별 주루 · 사람 공격의 환경설정 주루(설정 +0xbd, 0xae690 둘째 항) · 판을 넘어 남는 수비 장면 칸 */
function batterDefenseInputOf({ atoms, random, batterRunningMode }: BatterPitchHands, run: MissionRun, outcome: AtBatOutcome) {
  return {
    ...missionDefensePlayInputOf(run.bases, run.outs, outcome, random, undefined, undefined, playAbilitiesOf(atoms, run)),
    runningMode: batterRunningMode,
    scene: atoms.get(missionSceneAtom),
  }
}

/**
 * 파울 각 공 — 원본은 맞은 공이면 각과 무관하게 판(상태 0x17)을 돈다(메시지 0x11 → 0x13 → 0x17). 스트라이크(0xb6b58) ·
 * 파울 콜 25(51c5c)는 판이 파울로 닫힐 때(`finishDefensePlay`)다 — 여기서는 타구음만 낸다. 공 도착 판(0x3dfac)은 못 맞힌
 * 공만이라 열지 않는다. 필살타법 성공 굴림(0x517e6)도 판 시작이 한다(`foulContact` 의 재료)
 */
export function startBatterFoulPlay(
  hands: BatterPitchHands,
  detail: PitchOutcomeDetail & { readonly foulContact: NonNullable<PitchOutcomeDetail['foulContact']> },
  foulRun: MissionRun,
  buntKind: number,
): void {
  const { atoms, runner, audio } = hands
  const foulOutcome = registerContact(FOUL_PLAY_OUTCOME, detail.foulContact)
  const foulStealing = takeStealingFrom(atoms)
  // 타구 판(종류 1) 시작 0x3d7b8 3d8d2 — 도루 주자의 표시 칸을 지운다
  clearStealDisplay(atoms)
  playSoundIds(audio, [detail.contactSoundId])
  // 배트를 냈다 — 스윙 수는 휘두른 자리에서 준다. 다 썼는지는 판이 파울로 닫힌 뒤 본다
  recordSwingIf(atoms, detail.hasSwung)
  atoms.set(pendingDefensePlayAtom, {
    side: '타자',
    input: {
      ...batterDefenseInputOf(hands, foulRun, foulOutcome),
      stealingFrom: foulStealing,
      buntKind,
      // state[4] — 판 끝 결과 코드 11 · 판 뒤 스트라이크(0xb6b58)가 이 공 앞의 스트라이크를 본다
      strikes: runner.atBatRef.current.strikes,
    },
    outcome: foulOutcome,
    isBunt: false,
    runnersOnBase: runnerCountOf(foulRun.bases),
    isFoulPlay: true,
  })
  runner.setIsPaused(true)
}

/** 타구 판 하나 — 스윙 수만 먼저 줄이고 루·아웃·목표는 판 끝(`finishDefensePlay`)이 먹인다 */
export interface BatterDefenseStart {
  readonly current: MissionRun
  readonly detail: PitchOutcomeDetail
  readonly outcome: AtBatOutcome
  readonly isUncatchable: boolean
  readonly stealing: readonly StealBase[]
  readonly buntKind: number
  readonly runnersOnBase: number
}

/**
 * 맞은 공(쏜 패턴이 묶인 안타·아웃·홈런) — 수비 화면(상태 0x17)이 먼저 돈다. 스윙 수만 먼저 줄이고 **루·아웃·목표는 한 톨도
 * 건드리지 않는다** — 수비 화면이 다 돈 뒤 `finishDefensePlay` 가 한 번에 먹인다 (원본도 0x17 이 도는 동안 0xf 로 안 간다)
 */
export function startBatterDefensePlay(hands: BatterPitchHands, start: BatterDefenseStart): void {
  const { atoms, runner } = hands
  recordSwingIf(atoms, start.detail.hasSwung)
  // 타구 판(종류 1) 시작 0x3d7b8 3d8d2 — 도루 주자의 표시 칸을 지운다
  clearStealDisplay(atoms)
  atoms.set(pendingDefensePlayAtom, {
    side: '타자',
    input: {
      ...batterDefenseInputOf(hands, start.current, start.outcome),
      isUncatchable: start.isUncatchable,
      // 공이 나는 동안 출발한 주자 — 판 시작 리드(0x3d7b8)가 다음 루로 몰아 돌린다
      stealingFrom: start.stealing,
      // 장면 +0xfdc — 번트면 도루 안 한 주자의 판 시작 리드가 +3 틱
      buntKind: start.buntKind,
    },
    outcome: start.outcome,
    isBunt: start.detail.isBunt,
    runnersOnBase: start.runnersOnBase,
  })
  runner.setIsPaused(true)
}

/**
 * 공 도착 0x3dfac — 못 맞힌 공이면 0.1% 폭투·포일(종류 9)이나 출발한 도루(종류 5) 판을 연다. 미션(모드 6)도 보통 경기 장면 0x104 라
 * 같은 길이다 (0x3dfac 는 모드 7 만 0.1% 굴림을 건너뛴다). 판 시작까지만 연다 — 도루 · 폭투 판은 사람 주루 키(0x5331c · 0x585)를
 * 받으므로 붙들어 화면이 실시간으로 돌린다
 */
export function openBatterArrival(
  { atoms, random, batterRunningMode }: BatterPitchHands,
  current: MissionRun,
  detail: PitchOutcomeDetail,
  nextAtBat: AtBatState,
  arrival: { readonly stealing: readonly StealBase[]; readonly buntKind: number },
): OpenedPitchArrivalPlay | null {
  return openPitchArrivalPlay(
    {
      gameMode: MISSION_BATTER_MODE,
      pitchJudgement: pitchJudgementOf(detail.resolution, nextAtBat.outcome),
      stealingFrom: arrival.stealing,
      bases: current.bases,
      outs: current.outs,
      // 사람 타자의 손 0xb63c0 — 밀어내기 · 낫아웃 판의 타자주자 타석 자리(vt94 0xa0884)
      batterHand: detail.batterHand,
      // 루별 주루 — 루에 선 주자의 신원(사람 칸 팀 타순 칸)대로 0xb570d(ctx, 3, 주자, 1, 90, 1), 0 은 지금 타자.
      // 아홉 칸 수비는 CPU 수비 팀 레코드(판 시작 0xb0fb4 — `missionDefenseAbilitiesOf`)
      ...playAbilitiesOf(atoms, current),
      // 타자 미션은 수비가 CPU · 공격이 사람. 사람 공격이라 0xae690 첫 항이 거짓 — 환경설정 주루(+0xbd)가 답이다
      defenseIsCpu: true,
      offenseIsCpu: false,
      runningMode: batterRunningMode,
      // 장면 +0xfdc — 못 맞힌 번트의 번트 종류. 도루 판 리드 0x3d7b8 이 도루 안 한 주자에게 +3 틱
      buntKind: arrival.buntKind,
      // 경기 +0xfd4 — 이 공의 값
      sceneResultCode: atoms.get(sceneResultCodeAtom),
      // 수비 장면 칸 — 경기 장면 · 플레이 객체는 경기 하나에 한 번 만들어져 판을 넘어 남는다
      scene: atoms.get(missionSceneAtom),
    },
    random,
  )
}
