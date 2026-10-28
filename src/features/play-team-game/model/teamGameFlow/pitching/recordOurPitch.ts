import { type CpuPitchOutcome, cpuSwingPoseOf } from '@/entities/pitching/model/simulateBatter'
import { applyPitchResolution } from '@/entities/at-bat/model/atBatState'
import { sceneResultCodeOfThrown } from '@/features/defense-play/model/sceneResultCode'
import type { CpuStealStart } from '@/features/play-team-game/model/teamGameFlow/baseRunning/cpuStealStart'
import type { OurRolledPitch } from '@/features/play-team-game/model/teamGameFlow/pitching/rollOurPitch'
import { withHalfInningPitches } from '@/features/play-team-game/model/teamGameFlow/records/atBatRecords'
import { withSpecialSwingSlot } from '@/features/play-team-game/model/teamGameFlow/roster/specialSwing'
import { chargeMoundLine } from '@/features/play-team-game/model/teamGameFlow/settlement/pitcherLines'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * **사람 투수가 공 하나를 던진 뒤의 진행** — 상태 0x11 진입 0x3de10 · 소모 0xa5e14 · 코스 확정 0x50e9c 가 바꾸는 칸과
 * CPU 타자 반응(0x34334) · CPU 도루 출발(0x520de)이 남긴 칸. 굴림은 없다(굴림은 부르는 쪽이 이미 했다)
 */
export function withOurPitchThrown(
  progress: TeamGameProgress,
  pitched: {
    readonly stamina: number
    readonly rolled: OurRolledPitch
    readonly thrown: CpuPitchOutcome
    readonly steal: CpuStealStart
  },
): TeamGameProgress {
  const { stamina, thrown } = pitched
  const { magicRemainingAfter, ballMagicNumber, pitch, isMistake } = pitched.rolled
  const { stealingFrom, stealScene } = pitched.steal
  const { resolution, foulContact } = thrown
  return {
    ...progress,
    stamina,
    // ⚠️ 마구 횟수는 **코스 확정(OK)** 때 줄어든다 — 구질을 고른 순간이 아니다 (0x50e9c)
    magicRemaining: magicRemainingAfter,
    ballMagicNumber,
    // 0x4e136 — CPU 마타자의 필살 스윙이 나간 틱에 그 타순 칸 −1 (헛스윙도)
    opponentSpecialSwingRemaining:
      thrown.specialSwingRemaining === null
        ? progress.opponentSpecialSwingRemaining
        : withSpecialSwingSlot(progress.opponentSpecialSwingRemaining, progress.opponentOrderIndex, thrown.specialSwingRemaining),
    pitchCount: progress.pitchCount + 1,
    // 투구마다 state[0xd] 가 내려간다 (0xa5e72) — 그 뒤라야 다시 교체를 볼 수 있다
    pitcherJustChanged: false,
    // 같은 0xa5e14 가 state[0xe](CPU 대타 막음)도 내린다 (a5e7c)
    cpuPinchHitUsed: false,
    // 같은 0xa5e14 가 정산 사건 목록을 비운다 (a5e80 ctx+0x2c = 0)
    pendingSettlementEvents: undefined,
    // 0xa5e14 가 이 타석·반 이닝 투구 수(ctx+0x161 a5eda · +0x16c a5e4e)를 올린다.
    // 코스를 확정했으니(0x50e9c) state[0x8c] = 1 — 완투 계열의 조건이다
    recordTally: withHalfInningPitches(
      {
        ...progress.recordTally,
        atBatPitches: progress.recordTally.atBatPitches + 1,
        pitchCourseConfirmed: true,
      },
      progress.game,
      1,
    ),
    ourPitcherCounters: {
      ...progress.ourPitcherCounters,
      pitches: progress.ourPitcherCounters.pitches + 1,
    },
    pitcherLines: chargeMoundLine(progress, true, { pitches: 1 }),
    lastPitch: pitch,
    lastPitchIsMistake: isMistake,
    lastResolution: resolution,
    // 판을 도는 파울 각 공은 판이 파울로 닫힌 뒤에야 스트라이크가 오른다(0x35108 → 0xb6b58)
    atBat: foulContact === undefined ? applyPitchResolution(progress.atBat, resolution) : progress.atBat,
    stealingFrom,
    // CPU 도루 0x520de → 0xa9bd4 — 출발한 주자가 있으면 표시 칸도 같은 칸이다 (없으면 앞 0xf 진입이 이미 지웠다)
    ...(stealingFrom.length === 0 ? {} : { stealDisplayFrom: stealingFrom }),
    ...(stealScene === progress.defenseScene ? {} : { defenseScene: stealScene }),
    sceneBuntKind: thrown.buntKind ?? 0,
    lastCpuSwing: cpuSwingPoseOf(thrown),
    // 경기 +0xfd4 — 0x11 진입이 지우고 CPU 타자가 휘두른 공이면 스윙 판정이 덮는다
    sceneResultCode: sceneResultCodeOfThrown(resolution, foulContact),
  }
}
