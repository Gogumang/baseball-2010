import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { registerContact } from '@/entities/batting/model/battedContact'
import { runnerCountOf } from '@/entities/game/model/baseState'
import { MISSION_PITCHER_MODE, type PitcherRun } from '@/entities/mission/model/pitcherRun'
import { missionDefensePlayInputOf } from '@/entities/mission/model/missionRun'
import { vibrate } from '@/entities/defense-controls/model/vibration'
import { clearsPitchJudgement, runOpenedPitchArrivalPlay, type PitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import { inPlayCallSoundIdOf, pitchCallSoundIdOf } from '@/features/play-at-bat/model/atBatSounds'
import { strikeoutVibrationMillisecondsOf } from '@/features/play-game/model/strikeoutVibration'
import { playSoundIdsAfterSceneTicks } from '@/features/play-game/model/sceneTickSounds'
import { setGameSceneTickTimeout } from '@/shared/lib/commonWindow/commonWindow'
import { FOUL_PLAY_OUTCOME } from '@/app/model/missionSession/constants/missionConstants'
import { pitcherRunAtom } from '@/app/model/missionSession/atoms/runAtoms'
import { pendingDefensePlayAtom, pendingRunnerPlayAtom, pitcherArrivalContextAtom } from '@/app/model/missionSession/atoms/playAtoms'
import { missionSceneAtom, pitcherStealDisplayAtom } from '@/app/model/missionSession/atoms/fieldAtoms'
import { lastPitchJudgementClearedAtom } from '@/app/model/missionSession/atoms/pitcherAtoms'
import { arrivalCallSoundIdOf } from '@/app/model/missionSession/runnerPlay/arrivalReplay'
import { playAbilitiesOf } from '@/app/model/missionSession/batter/playAbilities'
import { finishPitcherMissionArrival } from '@/app/model/missionSession/pitcher/finishPitcherArrival'
import { openPitcherArrival, recordThrownPitch, type ThrowHands, type ThrownPitch } from '@/app/model/missionSession/pitcher/throwArrival'

/**
 * 삼진 진동 100ms — 미션(모드 5)도 경기 장면 0x104 라 못 맞힌 공은 0x11 → 0x12 를 지나고, 그 그리기 0x4ce9c 는
 * 모드를 가리지 않는다(0x52fb6 표 0xd05a0[0x12]). 0x12 진입 3dfac 이 0x9d57c 로 state[0xc] = 5(삼진) 를 쓰면
 * 첫 그리기(경기+0x2c == 0)의 4d0ba → 4d0d6 0x3a44(100, 100) (`strikeoutVibration`). 난수 없음.
 * 때: 0x12 틱 0 의 그림 — 놓은 틱에서 `pitchResultEntryDelayTicksOf` 뒤(미션 투수는 마투수가 아니다, 투수편과 같다)
 */
function vibrateOnStrikeout({ isVibrationOn }: ThrowHands, thrown: ThrownPitch, entryDelayTicks: number): void {
  const strikeoutMs = strikeoutVibrationMillisecondsOf(thrown.swing.resolution, thrown.strikesBefore)
  const isStrikeoutVibrationOn = isVibrationOn !== false
  if (strikeoutMs <= 0) return
  if (entryDelayTicks > 0) setGameSceneTickTimeout(() => vibrate(strikeoutMs, isStrikeoutVibrationOn), entryDelayTicks)
  else vibrate(strikeoutMs, isStrikeoutVibrationOn)
}

/**
 * 투구 순간 소리 (0x3f378 — 투수 단계가 공을 놓는 칸에 닿을 때) — 이 틀(놓는 틀). 심판 콜은 0x12 진입 틀: 0x3dfac 가 판정
 * 0x9d57c 를 메시지 0xbba 로 곧바로 보낸다(3e1e2~3e1e8) — 놓은 틀에서 `pitchResultEntryDelayTicksOf` 뒤, 삼진 진동과 같은 틀이다
 * (투수편 `usePitcherGame` · 팀경기 `useTeamGame` 과 같은 셈 — `PitchStepSoundTiming`). 원본은 그 사이 공이 날아가 두 소리가 다 들린다.
 * 공 도착 판의 판정 콜 — 붙든 도루 · 폭투 판은 화면이 판 안의 그 틱(결과 메시지 0xbba → 0x51a56)에 낸다.
 * 여기 오는 것은 밀어내기(콜 없음)뿐이다. 재생 칸에 넣는 판이면 재생 화면이 기록된 틱에 낸다
 */
function announceThrowResult({ audio }: ThrowHands, thrown: ThrownPitch, play: PitchArrivalPlay | null, entryDelayTicks: number): void {
  const { outcome } = thrown
  playSoundIdsAfterSceneTicks(
    audio,
    [
      pitchCallSoundIdOf(thrown.swing.resolution, thrown.nextAtBat),
      arrivalCallSoundIdOf(play),
      outcome === null || thrown.runsDefense ? null : inPlayCallSoundIdOf(outcome),
    ],
    entryDelayTicks,
  )
}

/** 수비 화면(0x17) 판 하나 — 사람이 수비다(환경설정 송구 +0xf4 가 그대로 0xae6c8 의 답) · 수비 장면 칸은 판을 넘어 남는다 */
function startPitcherDefensePlay(
  { atoms, random, throwModeManual }: ThrowHands,
  thrown: ThrownPitch,
  nextRun: PitcherRun,
  outcome: AtBatOutcome,
  foul: boolean,
) {
  const { swing } = thrown
  // 타구 판(종류 1) 시작 0x3d7b8 3d8d2 — 도루 주자의 표시 칸을 지운다
  atoms.set(pitcherStealDisplayAtom, null)
  const base = {
    ...missionDefensePlayInputOf(
      nextRun.bases,
      nextRun.outs,
      outcome,
      random,
      MISSION_PITCHER_MODE,
      throwModeManual,
      playAbilitiesOf(atoms, nextRun),
    ),
    scene: atoms.get(missionSceneAtom),
  }
  atoms.set(pendingDefensePlayAtom, {
    side: '투수',
    // 파울 각 공 — state[4] 는 판 끝 결과 코드 11 · 판 뒤 스트라이크(0xb6b58)가 이 공 앞의 스트라이크를 본다(11 은 번트일 때만 난다).
    // 페어 타구 — 0x517e6 마타자 필살이 성공한 타구는 필살타법 표시 속성 4(0xaf180)가 서서 야수가 쥐지 못한다.
    // 둘 다 CPU 가 공이 나는 동안 건 도루(판 시작 리드 0x3d7b8) · 장면 +0xfdc 번트 종류(리드 +3 틱 · 필살수비 관문 50fc8 · 정산)를 싣는다
    input: foul
      ? { ...base, stealingFrom: thrown.stealingFrom, strikes: thrown.strikesBefore, buntKind: swing.buntKind ?? 0 }
      : { ...base, isUncatchable: swing.isUncatchable, stealingFrom: thrown.stealingFrom, buntKind: swing.buntKind ?? 0 },
    outcome,
    isBunt: false,
    runnersOnBase: runnerCountOf(nextRun.bases),
    ...(foul ? { isFoulPlay: true } : {}),
  })
  atoms.set(pitcherRunAtom, nextRun)
}

/** 놓은 공이 연 판 — 밀어내기(종류 2)는 vt4c 가 안 돌아 키가 +0x160 만 적고 쓰이지 않는다 — 미리 돌려 재생한다. 도루 · 폭투 판은 붙든다 */
function openedPlaysOf(hands: ThrowHands, thrown: ThrownPitch) {
  const opened = openPitcherArrival(hands, thrown)
  // 3e0aa — 낫아웃 갈래가 판정 칸을 지웠으면 0x12 틱 0 의 판정 글자 · 삼진 파티클이 없다(같은 진입이 적고 그 틀 그림이 읽는다)
  hands.atoms.set(lastPitchJudgementClearedAtom, clearsPitchJudgement(opened))
  const held = opened !== null && opened.kind !== 2 ? opened : null
  const play = opened !== null && held === null ? runOpenedPitchArrivalPlay(opened) : null
  // 판이 남긴 수비 장면 칸은 다음 판으로 (+0x160 은 다음 판 시작 vt1c 0xb0edc 가 −1 로 지운다)
  if (play !== null) hands.atoms.set(missionSceneAtom, play.result.scene)
  return { held, play }
}

/**
 * **0x12 진입 0x3dfac 과 그 뒤** — `entryDelayTicks` 는 지금에서 0x12 진입 틀까지 남은 장면 틱이다. 못 맞힌 공은 그 틀에 부르고(0),
 * 맞은 공(파울 각 · 타구 — 0x3dfac 을 안 지난다)은 놓는 걸음에 부른다(`resultEntryTicks`)
 */
export function finishThrow(hands: ThrowHands, thrown: ThrownPitch, entryDelayTicks: number): void {
  const { atoms } = hands
  const { held, play } = openedPlaysOf(hands, thrown)
  const nextRun = recordThrownPitch(thrown, held, play)
  vibrateOnStrikeout(hands, thrown, entryDelayTicks)
  announceThrowResult(hands, thrown, play, entryDelayTicks)
  if (held !== null) {
    // 판이 도는 동안(상태 0x17) 다음 공은 없다 — 판 끝(`actions.finishRunnerPlay`)이 `finishPitcherMissionArrival` 로 잇는다
    atoms.set(pitcherArrivalContextAtom, { outcome: thrown.outcome, pitcherStamina: thrown.human.pitcherStamina })
    atoms.set(pitcherRunAtom, nextRun)
    atoms.set(pendingRunnerPlayAtom, { kind: 'arrival', opened: held, side: '수비' })
    return
  }
  // 파울 각 공 — 원본도 판(상태 0x17)을 돈다(맞은 공은 모두 메시지 0x11 → 0x13 → 0x17). 타석은 아직 안 끝났다 —
  // 판이 파울로 닫히면 `finishDefensePlay` 가 스트라이크를 올리고 같은 타석 다음 공으로, 잡히면 판 끝 정산(뜬공 아웃)이다
  const foulContact = thrown.swing.foulContact
  if (foulContact !== undefined) return startPitcherDefensePlay(hands, thrown, nextRun, registerContact(FOUL_PLAY_OUTCOME, foulContact), true)
  // 수비 화면(0x17)이 돈다 — 실점·피안타·이닝 목표는 다 돌고 난 뒤에 센다
  if (thrown.runsDefense && thrown.outcome !== null) return startPitcherDefensePlay(hands, thrown, nextRun, thrown.outcome, false)
  // 같은 타석 다음 공이면 0xf 진입 0x3d954(CPU 대타 · "Time!" 22)는 0x12 문턱 갱신 0x4e6d4 가 예약한 다음 틀이다
  const selectionDelay = Math.max(0, thrown.pitchSelectionTicks - (thrown.resultEntryTicks - entryDelayTicks))
  finishPitcherMissionArrival(hands, nextRun, play, { outcome: thrown.outcome, pitcherStamina: thrown.human.pitcherStamina }, selectionDelay)
}
