import type { RandomPort } from '@/shared/api/random/randomPort'
import { MAGIC_PITCH_TYPE_NUMBER, ballMagicNumberOfPitch } from '@/entities/pitcher-career/model/magicPitch'
import { type PitcherStats, pitchGradeOf, buildHumanPitch, mistakeHumanPitchOf } from '@/features/play-pitcher-game/model/pitcherPitch'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { PitcherRepertoire } from '@/shared/config/original/pitcherRepertoires'
import { isMistakePitch } from '@/entities/pitching/model/mistakePitch'
import { runnerCountOf } from '@/entities/game/model/baseState'
import { entryBatterIntimidatesAt } from '@/features/play-team-game/model/teamGameFlow/roster/batters'
import { mistakeSkillFlagsOf, pitcherEntryAt } from '@/features/play-team-game/model/teamGameFlow/roster/pitchers'
import type { TeamPitchInput } from '@/features/play-team-game/model/teamGameFlow/types/plays'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/** 사람 투수가 놓은 공 하나 — 굴림 셋(등급 · 놓기 · 실투)을 지난 결과 */
export interface OurRolledPitch {
  readonly pitch: Pitch
  readonly isMistake: boolean
  readonly magicRemainingAfter: number
  readonly ballMagicNumber: number
}

/** 공을 놓는 데 쓰는 투수 쪽 재료 — 이번 공을 깎은 뒤의 체력으로 부른 능력치 */
export interface OurPitcherCondition {
  /** 피로 전 경기용 능력치 (`ourPitcherStats`) */
  readonly stats: PitcherStats
  /** 체력%로 부른 제구 · 구속 · 변화 (`ourFatiguedStatsOf`) */
  readonly fatigued: PitcherStats
  readonly staminaPercent: number
  readonly repertoire: PitcherRepertoire
}

/**
 * **사람 투수의 공 하나를 굴린다** — 굴림 차례: 등급 0x4dbac → 놓기(제구 흩어짐) → 실투 0x33cbc.
 * 그 사이 마구 칸(코스 확정 0x50e9c · 0x3de10)은 굴림 없이 정한다.
 */
export function rollOurPitch(progress: TeamGameProgress, input: TeamPitchInput, condition: OurPitcherCondition, random: RandomPort): OurRolledPitch {
  const { options } = progress
  const { stats, fatigued, staminaPercent, repertoire } = condition
  const isMagic = input.typeNumber === MAGIC_PITCH_TYPE_NUMBER
  const side = options.stageSide ?? 1
  const grade = pitchGradeOf(
    {
      gaugeSettingOn: options.gaugeSettingOn === true,
      typeNumber: input.typeNumber,
      gaugeCell: input.gaugeCell,
      effectiveControl: fatigued.control,
      staminaPercent,
    },
    random,
  )
  const builtPitch = buildHumanPitch(
    {
      typeNumber: input.typeNumber,
      ...(input.aim === undefined ? {} : { aim: input.aim }),
      grade,
      gaugeCell: input.gaugeCell,
      stats: fatigued,
      repertoire: { pitchMask: repertoire.pitchMask, form: repertoire.form, magicNumber: repertoire.magicId },
      side,
    },
    random,
  )
  const { magicRemainingAfter, ballMagicNumber } = ourMagicPitchOf(progress, input.typeNumber, repertoire.magicId)
  const aimedPitch: Pitch = { ...builtPitch, magicNumber: ballMagicNumber, pitcherMagicNumber: repertoire.magicId }

  // 실투 판정 0x33cbc — 투구 순간 0x4dc78 이 궤적 준비 0x9e669 **뒤**(0x4dea0)에 부른다.
  // 등급 뽑기·제구 흩어짐 굴림 뒤, CPU 타자 결정 0x34334 앞이다. 마구가 아니면 rand(0,100) 한 번.
  const isMistake = isMistakePitch(
    {
      isMagicPitch: isMagic,
      grade,
      // 0xb570d(ctx, 1, 투수, 1, 90, 1) — 칸 1 구속, 체력 인자 90 이라 피로 감소가 없다.
      // `ourPitcherStats` 가 곧 그 경기용 값(질병·사기·팀 능력치·코치, 피로 전)이다
      effectiveVelocity: stats.velocity,
      runnerCount: runnerCountOf(progress.game.bases),
      hasSecondBaseRunner: progress.game.bases.second,
      // 상대 지금 타자의 스킬 22 압도(0xb62b4) — 레코드 +0x14 (`TeamEntryBatter.skillBits`)
      batterIntimidates: entryBatterIntimidatesAt(progress, options.opponentTeamId, progress.opponentOrderIndex),
      // 우리 투수 레코드 +0x14 의 비트 16 안정감 · 17 새가슴 · 22 냉정 (`TeamEntryPitcher.skillBits`, 마투수는 제 행)
      ...mistakeSkillFlagsOf(pitcherEntryAt(progress, options.ourTeamId, progress.ourPitcherIndex)?.skillBits ?? 0),
    },
    random,
  )
  // 실투면 0x4dec0~0x4df5e 가 곡선 0x9e3c9 앞에서 공을 존 한가운데 · N 18/20 으로 다시 놓는다 (굴림 없음)
  const pitch = isMistake
    ? mistakeHumanPitchOf(aimedPitch, {
        typeNumber: input.typeNumber,
        grade,
        stats: fatigued,
        repertoire: { pitchMask: repertoire.pitchMask, form: repertoire.form, magicNumber: repertoire.magicId },
        side,
      })
    : aimedPitch
  return { pitch, isMistake, magicRemainingAfter, ballMagicNumber }
}

/** 이 공 뒤의 남은 마구 · 공+0x10 (굴림 없음) */
function ourMagicPitchOf(
  progress: TeamGameProgress,
  typeNumber: number,
  magicId: number,
): Pick<OurRolledPitch, 'magicRemainingAfter' | 'ballMagicNumber'> {
  // 코스 확정 0x50e9c 가 남은 마구를 줄이고(아래 magicRemaining) 상태 0x11 진입 0x3de10 이 그 **뒤**에
  // `구질 == 22 && 남은 > 0` 이면 공+0x10 = 투수+0x18 을 싣는다 — 마지막 한 개(1 → 0)는 안 싣는다 (H2 3-4).
  // 되돌리는 줄이 없어 마구 뒤의 공에도 남는다. CPU 타석 판정의 0x34d6c 투수 쪽이 이 칸을 본다
  const magicRemainingAfter = typeNumber === MAGIC_PITCH_TYPE_NUMBER ? progress.magicRemaining - 1 : progress.magicRemaining
  // 고침(B-01)이면 마구로 던진 이 공에만 싣는다 — `ballMagicNumberOfPitch`
  const ballMagicNumber = ballMagicNumberOfPitch({
    previous: progress.ballMagicNumber,
    pitchTypeNumber: typeNumber,
    pitcherMagicNumber: magicId,
    remainingBefore: progress.magicRemaining,
    remainingAfter: magicRemainingAfter,
  })
  return { magicRemainingAfter, ballMagicNumber }
}
