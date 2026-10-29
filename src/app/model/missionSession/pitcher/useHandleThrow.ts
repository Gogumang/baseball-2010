import { isAtBatFinished } from '@/entities/at-bat/model/atBatState'
import { isMissionPlayOutcome } from '@/entities/mission/model/missionRun'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import { withMissionCpuSpecialSwing } from '@/entities/mission/model/missionCpuTeam'
import { MAGIC_PITCH_TYPE_NUMBER } from '@/entities/pitcher-career/model/magicPitch'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'
import { cpuSwingPoseOf } from '@/entities/pitching/model/simulateBatter'
import { arrivesUnhit } from '@/features/defense-play/model/pitchArrivalPlay'
import { sceneResultCodeOfThrown } from '@/features/defense-play/model/sceneResultCode'
import { scheduleSceneFrameUpdate } from '@/features/play-game/model/sceneTickSounds'
import { resultWaitTicksOf } from '@/pages/game/lib/batterRecordAlert'
import { pitchReleaseSoundIdOf } from '@/widgets/batting-stage/lib/pitchReleaseSound'
import { pitchResultEntryDelayTicksOf, pitchSelectionEntryDelayTicksOf } from '@/widgets/batting-stage/lib/pitcherSideStage'
import { PITCH_TYPES, type PitchTypeInfo } from '@/shared/config/original/pitchTypes'
import { playSoundIds } from '@/app/model/useSound'
import { isModeMagicPitchType, modePitcherMagicRemainingOf } from '@/app/model/modePitcher'
import { type MissionPlayScope, type MissionAtoms, useMissionValue } from '@/app/model/missionSession/atoms/missionScope'
import { pitcherRunAtom } from '@/app/model/missionSession/atoms/runAtoms'
import { pendingBenchClearingAtom, pendingDefensePlayAtom, pendingRunnerPlayAtom } from '@/app/model/missionSession/atoms/playAtoms'
import { sceneResultCodeAtom } from '@/app/model/missionSession/atoms/fieldAtoms'
import * as cells from '@/app/model/missionSession/atoms/pitcherAtoms'
import { rollHumanPitch } from '@/app/model/missionSession/pitcher/humanPitch'
import { rollCpuSwing } from '@/app/model/missionSession/pitcher/cpuSwing'
import type { ThrowHands, ThrownPitch } from '@/app/model/missionSession/pitcher/throwArrival'
import { finishThrow } from '@/app/model/missionSession/pitcher/throwFinish'

/** 원본 구질 번호 1~21, 메뉴의 마구 칸은 22 (0xb6d6a). 표에 없는 이름이면 1(FASTBALL)로 둔다 */
const typeNumberOf = (type: PitchTypeInfo, isMagic: boolean) =>
  isMagic ? MAGIC_PITCH_TYPE_NUMBER : Math.max(1, PITCH_TYPES.findIndex((candidate) => candidate.name === type.name) + 1)

/**
 * 다음 공을 받을 수 있나 — 화면이 수비를 돌리는 동안에는 다음 공이 나가지 않는다 (원본 0x17 이 도는 동안 0xf 로 안 간다) —
 * 실시간 주자 판도 같다. 앞 공이 아직 날거나 0x12 진입 전(0x12 진입 틀 시계) · 벤치 클리어링 연출(0x1e)이 도는 동안에도 없다
 */
function isReadyToThrow(atoms: MissionAtoms, held: { readonly hasDefensePlay: boolean; readonly hasBenchClearing: boolean }): boolean {
  if (held.hasDefensePlay || atoms.get(pendingRunnerPlayAtom) !== null) return false
  return atoms.get(cells.cancelPitcherResultEntryAtom) === null && !held.hasBenchClearing
}

/**
 * 놓은 공의 판정 뒤 — 0x4e136 필살 스윙이 나간 틱에 남은 −1 (헛스윙도, 마타자가 아니면 칸을 안 건드린다) · 판을 도는 파울 각 공은
 * 판이 파울로 닫힌 뒤에야 스트라이크가 오른다(0x35108 → 0xb6b58). 투수 미션은 결과 띠를 세우지 않는다 — 투구 화면(`PitchingScreen`)은
 * 띠 글을 그리지 않고, 0x11 · 0x12 동안 키를 막는 일은 화면이 마지막 공으로 센 틱(`pitchSceneBusyTicksOf`)이 맡는다. 띠 글을 남기면
 * 그것을 걷을 곳이 없어(타자 미션의 `pauseWithBanner` 같은 타이머가 없다) 삼진 · 볼넷으로 타석이 끝난 뒤 0xe 의 OK(`bannerText === ''`)와
 * 0x21 중계가 영영 열리지 않았다 — 맞은 공(띠 없음)과 같은 길로 둔다
 */
function judgedThrowOf(
  hands: ThrowHands,
  run: PitcherRun,
  typeNumber: number,
  rolled: ReturnType<typeof rollCpuSwing>,
  human: ThrownPitch['human'],
): ThrownPitch {
  const { runner } = hands
  const { swing } = rolled
  const cpuAfterSwing =
    swing.specialSwingRemaining === null ? run.cpu : withMissionCpuSpecialSwing(run.cpu, rolled.batterOrderSlot, swing.specialSwingRemaining)
  const strikesBefore = runner.atBatRef.current.strikes
  const nextAtBat = swing.foulContact === undefined ? runner.applyPitch(swing.resolution) : runner.atBatRef.current
  runner.setBannerText('')
  const outcome = isAtBatFinished(nextAtBat) ? nextAtBat.outcome : null
  const resultTicks = resultWaitTicksOf(outcome)
  return {
    run,
    typeNumber,
    human,
    swing,
    stealingFrom: rolled.steal.stealingFrom,
    runAbilities: rolled.steal.runAbilities,
    cpuAfterSwing,
    strikesBefore,
    nextAtBat,
    outcome,
    runsDefense: outcome !== null && isMissionPlayOutcome(outcome),
    // 놓은 틀에서 0x12 진입 틀까지 — 0x3dfac 이 공 도착을 돌리고 심판 콜 · 삼진 진동이 나는 틀
    resultEntryTicks: pitchResultEntryDelayTicksOf(human.pitch.frameCount),
    // 놓은 틀에서 같은 타석 다음 공의 0xf 진입 틀까지 — 0x12 문턱 갱신 0x4e6d4 가 예약한 다음 틀(CPU 대타 · "Time!" 22)
    pitchSelectionTicks: pitchSelectionEntryDelayTicksOf(human.pitch.frameCount, resultTicks),
  }
}

/**
 * 원작 투구 조작: 구질 → 조준 → 게이지. 타자는 자동으로 반응한다 (`handleThrow`).
 *
 * 공은 나리 투수편과 **같은 진행기 부품**(`buildHumanPitch`)으로 만든다 — 원본 순서
 * 0x50da8 구질 → **0x39c5c 조준(매 틱 흔들림, `aimTick`)** → 0x50e9c 확정 → 0x11 → 0x4dc78 등급 · 제구 흩어짐 그대로다.
 * 조준점이 월드 좌표라야 미션 흔들림(±600·±400)이 뜻을 갖는다.
 *
 * ⚠️ 경기 상태(이닝·점수·로스터)는 미션 레코드에 없으므로 진행기 `PitcherGameProgress` 를
 *    통째로 쓰지는 않는다 — 투구 한 개를 만드는 데 필요한 것만 위 상수로 채웠다.
 */
export function useHandleThrow(scope: MissionPlayScope) {
  const { atoms, runner, random, audio, aceLevels, throwModeManual, isVibrationOn, pick } = scope
  const pitcherRun = useMissionValue(atoms, pitcherRunAtom)
  const hasDefensePlay = useMissionValue(atoms, pendingDefensePlayAtom) !== null
  const hasBenchClearing = useMissionValue(atoms, pendingBenchClearingAtom) !== null
  const pitcherMagicStored = useMissionValue(atoms, cells.pitcherMagicStoredAtom)
  const pitcherStaminaStored = useMissionValue(atoms, cells.pitcherStaminaStoredAtom)
  const ballMagicNumber = useMissionValue(atoms, cells.ballMagicNumberAtom)
  const pitcher = pick.pitcher
  const pitcherMagicRemaining = modePitcherMagicRemainingOf(pitcherMagicStored, pitcher)
  const hands: ThrowHands = { atoms, runner, random, audio, throwModeManual, isVibrationOn }
  return (
    type: PitchTypeInfo,
    /** 0x10 에서 확정한 조준점 x · y · z (흔들림은 `aimTick` 이 틱마다 이미 넣었다) */
    aim: WorldPoint,
    /** 게이지에서 **누른 칸 0~9** 그대로다 (0x50e08). 안 눌렀거나 게이지를 안 쓰면 0 */
    gaugeCell: number,
    /** 환경설정 [투구] 가 게이지인가 (설정 +0x2d, 0x3f500) */
    gaugeSettingOn: boolean,
  ) => {
    if (pitcherRun === null || pitcherRun.status !== '진행중') return
    if (!isReadyToThrow(atoms, { hasDefensePlay, hasBenchClearing })) return
    const isMagic = isModeMagicPitchType(type)
    const typeNumber = typeNumberOf(type, isMagic)
    // 0x50db8 — 구질 22 는 남은 마구(0xaea10) > 0 일 때만 받는다. 아니면 무시 (난수 없음)
    if (isMagic && pitcherMagicRemaining <= 0) return
    const staminaBefore = pitcherStaminaStored ?? pitcher.stamina
    const run = pitcherRun
    const pitchInput = {
      run,
      pitcher,
      typeNumber,
      isMagic,
      aim,
      gaugeCell,
      gaugeSettingOn,
      staminaBefore,
      magicRemaining: pitcherMagicRemaining,
      ballMagicNumber,
    }
    const human = rollHumanPitch(pitchInput, random)
    atoms.set(cells.pitcherStaminaStoredAtom, human.pitcherStamina)
    atoms.set(cells.pitcherMagicStoredAtom, human.magicRemainingAfter)
    atoms.set(cells.ballMagicNumberAtom, human.nextBallMagicNumber)
    const rolled = rollCpuSwing({ atoms, runner, run, pitcher, thrown: human, aceLevels }, random)
    // 경기 +0xfd4 — 이 공의 0x11 진입이 지우고 CPU 타자가 휘두른 공이면 스윙 판정이 덮는다
    atoms.set(sceneResultCodeAtom, sceneResultCodeOfThrown(rolled.swing.resolution, rolled.swing.foulContact))
    const thrown = judgedThrowOf(hands, run, typeNumber, rolled, human)
    atoms.set(cells.lastPitcherThrowAtom, {
      pitch: human.pitch,
      resolution: rolled.swing.resolution,
      resultTicks: resultWaitTicksOf(thrown.outcome),
      cpuSwing: cpuSwingPoseOf(rolled.swing),
    })
    // 0x3f378 3f46a — 구질 22 면 28. 미션 투수는 육성·명예 투수(비트7)라 0xb633d 가 거짓이어서
    // 공+0x10 갈래(3f488)는 안 탄다 → 투수 +0x18 을 0 으로 넘긴다 (b008959)
    playSoundIds(audio, [pitchReleaseSoundIdOf({ typeNumber, pitcherMagicNumber: 0, ballMagicNumber: human.nextBallMagicNumber })])
    if (!arrivesUnhit(rolled.swing.resolution)) {
      finishThrow(hands, thrown, thrown.resultEntryTicks)
      return
    }
    // 못 맞힌 공 — 공 도착 0x3dfac(`rollPassedBall` · 판 시작 굴림)은 0x12 진입 틀이다. 공이 나는 동안의 관리자 틱 굴림(마구 공 파티클
    // 따위 — 프레임 끝 0x6de85)이 먼저 나도록 그 틀까지 미룬다(r293). 그동안 판정 칸은 아직 안 지워졌다
    atoms.set(cells.lastPitchJudgementClearedAtom, false)
    const cancel = scheduleSceneFrameUpdate(() => {
      atoms.set(cells.cancelPitcherResultEntryAtom, null)
      finishThrow(hands, thrown, 0)
    }, thrown.resultEntryTicks)
    // 함수 값은 갱신 함수로 읽히므로 값을 돌려주는 함수로 싸서 적는다
    atoms.set(cells.cancelPitcherResultEntryAtom, () => cancel)
  }
}
