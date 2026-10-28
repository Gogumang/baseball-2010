import { applyPitchResolution } from '@/entities/at-bat/model/atBatState'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { QuickAtBatBatter } from '@/entities/game/model/quickAtBat'
import { runnerCountOf } from '@/entities/game/model/baseState'
import { lineupSlotOf } from '@/entities/game/model/quickLineup'
import { withPredictedOutcome } from '@/features/defense-play/model/runDefensePlay'
import { registerContact } from '@/entities/batting/model/battedContact'
import { sceneResultCodeOfThrown } from '@/features/defense-play/model/sceneResultCode'
import { type CpuBatterTraits, type CpuPitchOutcome, cpuSwingPoseOf } from '@/entities/pitching/model/simulateBatter'
import { arrivesUnhit } from '@/features/defense-play/model/pitchArrivalPlay'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { withMoundsPitched } from '@/features/play-pitcher-game/model/pitcherGameFlow/auto/quickPitching'
import { defensePlayInputOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/fielding/defensePlayInput'
import { arrivePitcherPitchThenRest } from '@/features/play-pitcher-game/model/pitcherGameFlow/pitch/pitchArrival'
import { withoutStealDisplay } from '@/features/play-pitcher-game/model/pitcherGameFlow/pitch/stealDisplay'
import type { PitcherPendingPitchArrival } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/pitchStateTypes'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/** `startPitch` 가 공을 놓은 뒤의 경기 — 투구 처리 0xa5e14 · 경기 +0xfd4 · 도루 출발 st[0x14 + 루] */
export function afterPitchOf(
  progress: PitcherGameProgress,
  pitched: {
    readonly stamina: PitcherGameProgress['stamina']
    readonly magicRemaining: number
    readonly ballMagicNumber: PitcherGameProgress['ballMagicNumber']
    readonly pitch: Pitch
    readonly isMistake: boolean
    readonly thrown: CpuPitchOutcome
    readonly stealingFrom: PitcherGameProgress['stealingFrom']
    readonly stealScene: PitcherGameProgress['defenseScene']
  },
): PitcherGameProgress {
  const { stamina, magicRemaining, ballMagicNumber, pitch, isMistake, thrown, stealingFrom, stealScene } = pitched
  const resolution = thrown.resolution
  const foulContact = thrown.foulContact

  const afterPitch: PitcherGameProgress = {
    ...progress,
    stamina,
    // ⚠️ 마구 횟수는 **코스 확정(OK)** 때 줄어든다 — 구질을 고른 순간이 아니다 (0x50e9c)
    magicRemaining,
    ballMagicNumber,
    // 투구 처리 0xa5e14 가 공마다 state[0xe](CPU 대타 막음)를 내린다 (a5e7c)
    pinchHitUsed: false,
    // 같은 0xa5e14 의 a5e72 가 state[0xd](교체 직후)도 내린다 — 두 팀 공용 한 칸이다
    ...withMoundsPitched(progress),
    pitchCount: progress.pitchCount + 1,
    // 같은 0xa5e14 가 정산 사건 목록을 비운다 (a5e80 ctx+0x2c = 0)
    pendingSettlementEvents: undefined,
    // ctx+0x161 · ctx+0x16c — 투구 처리 0xa5e14 가 공 하나마다 둘 다 올린다
    atBatPitches: progress.atBatPitches + 1,
    halfInningPitches: progress.halfInningPitches + 1,
    lastPitch: pitch,
    lastPitchIsMistake: isMistake,
    lastCpuSwing: cpuSwingPoseOf(thrown),
    lastResolution: resolution,
    // 경기 +0xfd4 — 0x11 진입이 지우고 CPU 타자가 휘두른 공이면 스윙 판정이 덮는다
    sceneResultCode: sceneResultCodeOfThrown(resolution, foulContact),
    // 판을 도는 파울 각 공은 판이 파울로 닫힌 뒤에야 스트라이크가 오른다(0x35108 → 0xb6b58)
    atBat: foulContact === undefined ? applyPitchResolution(progress.atBat, resolution) : progress.atBat,
    stealingFrom,
    // 0xa9bd4 가 세운 st[0x14 + 루] 는 화면 표시 칸이기도 하다 — 출발이 없으면 앞 0xf 진입이 이미 지웠다
    stealDisplay: stealingFrom.length === 0 ? null : { bases: stealingFrom, selectionEntered: false },
    ...(stealScene === progress.defenseScene ? {} : { defenseScene: stealScene }),
  }
  return afterPitch
}

/** `startPitch` 의 CPU 타자 결정 0x34334 · 0xab214 가 보는 것 — `pitchAgainstBatterDetailed` 의 `traits` 인자 */
export function cpuBatterTraitsOf(
  progress: PitcherGameProgress,
  isMistake: boolean,
  staminaPercent: number,
  opponentBatter: QuickAtBatBatter,
): CpuBatterTraits {
  const { options } = progress
  return {
    isMistakePitch: isMistake,
    // 모드 3 — 0xab214 의 팀 조작 보정(−10)은 모드 3·4 밖에서만이라 안 붙는다
    swingMode: '나만의리그',
    // ab3d0 sp40 = (모드 == 3 || 4) · ab41c 0xb6389(투수) = 내 육성 투수 rec[0xa] 비트7
    isPitcherOwnPlayer: true,
    careerYearIndex: options.careerYearIndex ?? 0,
    // 파울 각 공도 수비 판을 돈다 — 낙구 전에 잡히면 파울 뜬공 아웃(13), 아니면 판이 닫힌 뒤 스트라이크(0x35108 → 0xb6b58)
    playsFoulBall: true,
    // ab838 — 이번 공을 깎은 뒤 체력% 가 0 이면 B · C 에 +2000
    pitcherStaminaPercent: staminaPercent,
    // 0xab214 ab91c~ — 상대 지금 타자 레코드 +0x14 (`0xb62b4(타자, n)` — 붙박이 줄은 Xls 행, 마타자는 제 행)
    batterSkillIds: opponentBatter.skillIds,
    // 같은 갈래가 던지는 내 투수 레코드 +0x14 도 `0xb62b4(투수, n)` 로 읽는다 — 장착 스킬(비트 + 16)
    pitcherSkillIds: options.pitcherSkillIds ?? [],
    skillSituation: {
      // 투수 스킬 31(0xabcd8)의 `0xb6394(타자)` = +0xa & 0x1f — 경기 준비 0xb8768 → 0xb603c 가 마선수 아닌 줄을 명단 배열
      // 첨자로 다시 매기고(`QuickLineup.recordSlots` — 마타자에 밀린 옛 9번은 12), 마타자는 제 순번 그대로
      batterOrderIndex: opponentBatter.recordSlot ?? 0,
      inning: progress.game.inning,
      // 0xab966 — 수비(우리) 점수 > 공격(상대) 점수
      isLosing: progress.game.ourScore > progress.game.opponentScore,
      runnerCount: runnerCountOf(progress.game.bases),
      hasSecondBaseRunner: progress.game.bases.second,
      // 이 타순 칸의 오늘 타석 결과 링 (팀 객체 + 타순×0x18 + 0x34)
      recentAtBatCodes: progress.opponentLineup.records[lineupSlotOf(progress.opponentOrderIndex)]?.results ?? [],
    },
  }
}

/** `startPitch` 의 나머지 — 공을 놓은 뒤 파울 각 공 판 · 공 도착 0x3dfac (판이 열리면 그 굴림) */
export function rollReleasedPitchRest(
  progress: PitcherGameProgress,
  afterPitch: PitcherGameProgress,
  released: {
    readonly thrown: CpuPitchOutcome
    readonly pitch: Pitch
    readonly grade: number
    readonly live: boolean
    readonly holdsArrival: boolean
  },
  random: RandomPort,
): PitcherGameProgress {
  const { thrown, pitch, grade, live, holdsArrival } = released
  const resolution = thrown.resolution
  const foulContact = thrown.foulContact

  // 파울 각 공 — 원본도 판(상태 0x17)을 돈다(맞은 공은 모두 메시지 0x11 → 0x13 → 0x17). 공 도착 판(0x3dfac)은 못 맞힌 공만이다.
  // 타석은 아직 안 끝났다 — 판이 파울로 닫히면 `resolveDefensePlay` 가 스트라이크를 올리고 같은 타석 다음 공으로 간다
  if (foulContact !== undefined) {
    return {
      // 파울 각 공 판도 타구 판(종류 1)이다 — 시작 리드 0x3d7b8 이 출발 표시를 지운다(3d8c6~3d8d2)
      ...withoutStealDisplay(afterPitch),
      pendingDefensePlay: withPredictedOutcome({
        ...defensePlayInputOf(afterPitch, registerContact(FOUL_PLAY_OUTCOME, foulContact), random),
        // 판 끝 결과 코드 11(2스트라이크 번트 파울) · 판 뒤 스트라이크(0xb6b58)가 이 공 앞의 스트라이크를 본다
        strikes: progress.atBat.strikes,
        // 장면 +0xfdc — CPU 타자의 번트 종류. 11 은 번트(state[0x13])일 때만 난다
        buntKind: thrown.buntKind ?? 0,
      }),
    }
  }

  // 공 도착 0x3dfac — 못 맞힌 공이면 0.1% 폭투·포일(종류 9)이나 CPU 가 건 도루(종류 5) 판을 연다
  const arrivalPitch: PitcherPendingPitchArrival = {
    resolution,
    outcomeAfter: afterPitch.atBat.outcome,
    buntKind: thrown.buntKind ?? 0,
    // CPU 타자의 손 0xb63c0 — 공의 화면 배치(`simulateBatter` 가 맞은 공의 손으로 쓰는 값). 밀어내기 · 낫아웃 타석 자리
    batterHand: pitch.stageSide,
    grade,
    live,
  }
  // 화면 갈래 — 0x3dfac 은 0x12 진입 틀이다. 공이 나는 동안의 관리자 틱 굴림이 먼저 나도록 그 틀까지 붙든다 (`enterPitchResult`)
  if (holdsArrival && arrivesUnhit(resolution)) return { ...afterPitch, pendingPitchArrival: arrivalPitch }
  return arrivePitcherPitchThenRest(afterPitch, arrivalPitch, random)
}

/** 파울 각 공 판의 임시 결과 칸 — 판이 파울로 닫히면 쓰지 않고, 잡히면 판 끝 정산(뜬공 아웃)이 갈아 끼운다 */
const FOUL_PLAY_OUTCOME: AtBatOutcome = { kind: '아웃', detail: '뜬공아웃' }
