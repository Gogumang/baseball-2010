import type { OriginalMission } from '@/shared/config/original/missions'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { SoundPort } from '@/shared/api/audio/soundPort'
import { LOADING_TIPS } from '@/shared/config/loadingTips'
import { SKY_ROW_COUNT } from '@/widgets/batting-stage/lib/stageScenery'
import { openScenePatternDeck } from '@/entities/batting/model/battedBallOutcome'
import { rollSimulatorInit } from '@/entities/game/model/simulatorInit'
import { rollSceneLoadingTip } from '@/entities/game/model/sceneLoadingTip'
import { startPlayClock } from '@/entities/collection/model/playClock'
import { missionFirstHalfIsHuman, type MissionRun } from '@/entities/mission/model/missionRun'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import { SCENE_RESULT_CODE_START } from '@/features/defense-play/model/sceneResultCode'
import { rollHalfInningFielders } from '@/features/play-game/model/halfInningBoard'
import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import { UNFILLED_SPECIAL_SWING } from '@/app/model/missionSession/constants/missionConstants'
import type { MissionAtoms } from '@/app/model/missionSession/atoms/missionScope'
import { autoRelayStepAtom, autoTicksAtom } from '@/app/model/missionSession/atoms/runAtoms'
import * as play from '@/app/model/missionSession/atoms/playAtoms'
import * as field from '@/app/model/missionSession/atoms/fieldAtoms'
import * as scene from '@/app/model/missionSession/atoms/sceneAtoms'
import * as pitcher from '@/app/model/missionSession/atoms/pitcherAtoms'
import { enterNewAtBatConfirm } from '@/app/model/missionSession/scene/sceneSteps'

/** 새 경기 — 굴리던 자동진행을 버린다 */
export function dropAutoRelay(atoms: MissionAtoms): void {
  atoms.set(autoTicksAtom, null)
  atoms.set(autoRelayStepAtom, null)
}

/** 새 경기 — 마구 남은 칸 · 투수 +0x2c · 공 객체를 새로 (팀 new 0xb891c 가 −1, 0xb8820 이 저장의 투수 레코드를 다시 베낀다) */
export function resetPitcherCells(atoms: MissionAtoms): void {
  atoms.set(pitcher.pitcherMagicStoredAtom, UNFILLED_SPECIAL_SWING)
  // 0xb8820 이 저장의 투수 레코드를 다시 베낀다 — +0x2c 도 저장값에서 다시
  atoms.set(pitcher.pitcherStaminaStoredAtom, null)
  atoms.set(pitcher.ballMagicNumberAtom, 0)
}

/**
 * 새 경기 장면의 판 칸을 비운다 — 시작 상황(카운트)은 상태 8 끝 48c86 의 0xaae7c(…, 0xd, 0x18, 0)(aaf10)이 0x18 앞에 깐다.
 * 0xe 대기는 첫 0x18 판 OK 뒤(`openFirstHalfBoard` · `confirmHalfInningBoard`). 플레이 객체 new(0xb0b68)라 수비 장면 칸이 처음 값이다
 */
export function clearMatchScene(atoms: MissionAtoms, runner: AtBatRunner, mission: OriginalMission): void {
  runner.resetAtBat(mission.start)
  atoms.set(scene.newAtBatWaitAtom, null)
  atoms.set(scene.sceneConfirmAtom, null)
  atoms.set(scene.halfInningBoardAtom, null)
  runner.setBannerText('')
  runner.setIsPaused(false)
  atoms.set(play.pendingDefensePlayAtom, null)
  atoms.set(play.pickoffReplayAtom, null)
  atoms.set(play.pendingRunnerPlayAtom, null)
  atoms.set(play.pendingBenchClearingAtom, null)
  atoms.set(field.stealInputAtom, [])
  atoms.set(field.missionSceneAtom, undefined)
  atoms.set(field.sceneResultCodeAtom, SCENE_RESULT_CODE_START)
  atoms.set(field.stealingFromAtom, [])
  atoms.set(field.pitcherStealDisplayAtom, null)
}

/**
 * 경기 장면을 세우는 굴림 — 맨 앞은 상태 7 **진입** 0x39f88 → 0x53dbc 의 로딩 팁 rand(0, 73)(`rollSceneLoadingTip`), 상태 7 갱신
 * 0x3e340 의 맨 앞 0x3e350 이 울리던 소리를 끊고(0x6e418 — 로딩 판부터 배경음이 없다) 3ed76 → 0xb08e8 이 이 장면의 패턴 덱을 섞는다
 * (사람 · CPU 타자가 같이 쓴다). 상태 9 갱신 0x3f584 의 공통 꼬리 0x3fa0e — 시뮬 초기화 0xc0dac 의 rand(0, 2) 한 번(미션 모드 5·6 도
 * 보통 경기 장면이라 모드 점프 뒤 이 꼬리를 탄다 — 1회초 판·첫 타석 준비보다 앞), 같은 꼬리 0x3fa3e 의 0x3f554 — 플레이 시계를
 * 지금부터 잰다(정산 0x4e8b0 이 모드 5 · 6 칸에 더한다). 상태 9 끝 3fa5e 가 예약한 상태 8 경기 적재(48774 → 0x352e8 → 0x783b0) —
 * 하늘 줄 rand(0, 6) (`skyRowAtom` 머리말)
 */
export function rollMatchSceneStart(atoms: MissionAtoms, random: RandomPort, audio: SoundPort): void {
  atoms.set(scene.loadingTipAtom, LOADING_TIPS[rollSceneLoadingTip(random)] ?? null)
  audio.stop()
  openScenePatternDeck(random)
  rollSimulatorInit(random)
  startPlayClock()
  atoms.set(scene.skyRowAtom, random.rand(0, SKY_ROW_COUNT))
}

/** 새 경기 — 필살·마구 남은 칸은 0xaebe4 가 다시 채운다 (팀 new 0xb891c 가 −1), 공 객체도 새것 */
export function resetForNewMatch(atoms: MissionAtoms, runner: AtBatRunner, random: RandomPort, audio: SoundPort, mission: OriginalMission): void {
  dropAutoRelay(atoms)
  // 새 경기 — 0xaae7c 가 저장된 마투수 레코드(+0x2c = 10000)를 다시 베낀다
  atoms.set(pitcher.batterSpecialSwingStoredAtom, UNFILLED_SPECIAL_SWING)
  resetPitcherCells(atoms)
  clearMatchScene(atoms, runner, mission)
  rollMatchSceneStart(atoms, random, audio)
}

/**
 * **상태 8 끝 → 첫 0x18** (48bf0 — 미션은 인트로 0xc 를 안 지난다). 부르는 쪽이 판을 세운 뒤(`startMission` · `startPitcherMission`
 * 은 굴리지 않는다) 하늘 줄 다음에 부른다. 첫 반 이닝이 사람 몫이면 판이 서고 틱 0 의 0x3fac4 가 rand 36 개를 굴린다
 * (`missionFirstHalfIsHuman` — 웹의 미션 · 마선수 대결은 모두 사람 몫이다).
 * ⚠️ 미구현(남김 — 웹에 없는 미션 꼴): 사람 몫이 아니면 원본은 0x18 → 0x21 자동진행으로 가지만 그런 미션이 웹에 없어 그 길은 옮기지 않았다 — 판 없이 0xd → 0xe.
 */
export function openFirstHalfBoard(atoms: MissionAtoms, random: RandomPort, run: MissionRun | PitcherRun): void {
  if (!missionFirstHalfIsHuman(run)) {
    enterNewAtBatConfirm(atoms)
    return
  }
  const fielderRolls = rollHalfInningFielders(random)
  const serial = atoms.get(scene.halfInningBoardSerialAtom) + 1
  atoms.set(scene.halfInningBoardSerialAtom, serial)
  atoms.set(scene.halfInningBoardAtom, {
    fielderRolls,
    serial,
    inning: run.game.inning + 1,
    half: run.game.offenseSide === 0 ? '초' : '말',
  })
}
