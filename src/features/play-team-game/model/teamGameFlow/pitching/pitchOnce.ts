import type { RandomPort } from '@/shared/api/random/randomPort'
import { MAGIC_PITCH_TYPE_NUMBER, ballMagicNumberOfPitch } from '@/entities/pitcher-career/model/magicPitch'
import { drainStamina, pitchGradeOf, buildHumanPitch, mistakeHumanPitchOf } from '@/features/play-pitcher-game/model/pitcherPitch'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { isMistakePitch } from '@/entities/pitching/model/mistakePitch'
import { runnerCountOf } from '@/entities/game/model/baseState'
import { NO_ACE_BATTER } from '@/features/play-team-game/model/teamGameRoster'
import { pitchAgainstBatterDetailed } from '@/entities/pitching/model/simulateBatter'
import { cpuStealStartOf } from '@/features/play-team-game/model/teamGameFlow/baseRunning/cpuStealStart'
import { ourTeamMoraleOf } from '@/features/play-team-game/model/teamGameFlow/context/abilityContext'
import { cpuSwingTraitsOf } from '@/features/play-team-game/model/teamGameFlow/pitching/cpuSwingTraits'
import { finishOurThrow } from '@/features/play-team-game/model/teamGameFlow/pitching/finishOurThrow'
import { ourAfterPitchOf } from '@/features/play-team-game/model/teamGameFlow/pitching/ourAfterPitch'
import { ourFatiguedStatsOf } from '@/features/play-team-game/model/teamGameFlow/pitching/ourFatiguedStats'
import { entryBatterIntimidatesAt, entryBattersOf, entryStageAbilityOf } from '@/features/play-team-game/model/teamGameFlow/roster/batters'
import { ourPitcherStats } from '@/features/play-team-game/model/teamGameFlow/roster/currentPitcher'
import {
  mistakeSkillFlagsOf,
  pitcherEntryAt,
  pitcherRepertoireAt,
  pitcherSkillFlagsAt,
} from '@/features/play-team-game/model/teamGameFlow/roster/pitchers'
import { ACE_SPECIAL_NUMBER_OFFSET } from '@/features/play-team-game/model/teamGameFlow/roster/specialSwing'
import { isPitchTurn } from '@/features/play-team-game/model/teamGameFlow/turn/turns'
import type { TeamPitchInput } from '@/features/play-team-game/model/teamGameFlow/types/plays'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/** `defer` 가 참이면 인플레이 타구에서 멈춘다 — 그 밖은 예전처럼 타구까지 한 번에 돌린다 */
export function pitchOnce(
  progress: TeamGameProgress,
  input: TeamPitchInput,
  random: RandomPort,
  defer: boolean,
  holdsArrival = false,
): TeamGameProgress {
  if (!isPitchTurn(progress) || progress.pendingPitchArrival != null) return progress
  const { options } = progress
  const isMagic = input.typeNumber === MAGIC_PITCH_TYPE_NUMBER
  if (isMagic && progress.magicRemaining <= 0) return progress

  const stats = ourPitcherStats(progress)
  // 스태미나 소모 0xa5e14 — 상태 0x11 **진입** 0x3de10 의 0x3dec6 이다. 놓기 0x4dc78(0x11 의 틱 10)보다 앞이라
  // 등급 굴림 0x4dbac · 피로 능력치 0x34968 · CPU 타자 스윙 0xab214 가 모두 **이번 공을 깎은 뒤**의 체력을 본다.
  // 스태미나는 게이지 결과와 무관하다 — 인자가 (game, 구질) 뿐이다 (P1 3-1 확정)
  const stamina = drainStamina({
    stamina: progress.stamina,
    typeNumber: input.typeNumber,
    staminaAbility: stats.stamina,
    teamMorale: ourTeamMoraleOf(options),
    // 0xaeb08 `team+0x26 − team+0x33 == 1` — 마운드를 밟은 투수가 지금 투수 하나뿐일 때만 첫 투수 보너스(0x66e44 +200).
    // 교체로 올라온 구원 투수는 받지 않는다 (P1 3-2, 상대 쪽 `throwOpponentPitch` 와 같은 식)
    isFirstPitcher: progress.ourUsedPitchers.length === 0,
    // 상대 지금 타자의 0xb62b4(타자, 22) 압도 — 레코드 +0x14 (`TeamEntryBatter.skillBits`)
    batterIntimidates: entryBatterIntimidatesAt(progress, options.opponentTeamId, progress.opponentOrderIndex),
    ...pitcherSkillFlagsAt(progress, options.ourTeamId, progress.ourPitcherIndex),
  })
  const fatigued = ourFatiguedStatsOf(progress, stats, stamina)
  const staminaPercent = staminaPercentOf(stamina)
  const repertoire = pitcherRepertoireAt(progress, options.ourTeamId, progress.ourPitcherIndex)
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
      repertoire: {
        pitchMask: repertoire.pitchMask,
        form: repertoire.form,
        magicNumber: repertoire.magicId,
      },
      side: options.stageSide ?? 1,
    },
    random,
  )

  // 코스 확정 0x50e9c 가 남은 마구를 줄이고(아래 magicRemaining) 상태 0x11 진입 0x3de10 이 그 **뒤**에
  // `구질 == 22 && 남은 > 0` 이면 공+0x10 = 투수+0x18 을 싣는다 — 마지막 한 개(1 → 0)는 안 싣는다 (H2 3-4).
  // 되돌리는 줄이 없어 마구 뒤의 공에도 남는다. CPU 타석 판정의 0x34d6c 투수 쪽이 이 칸을 본다
  const magicRemainingAfter = isMagic ? progress.magicRemaining - 1 : progress.magicRemaining
  // 고침(B-01)이면 마구로 던진 이 공에만 싣는다 — `ballMagicNumberOfPitch`
  const ballMagicNumber = ballMagicNumberOfPitch({
    previous: progress.ballMagicNumber,
    pitchTypeNumber: input.typeNumber,
    pitcherMagicNumber: repertoire.magicId,
    remainingBefore: progress.magicRemaining,
    remainingAfter: magicRemainingAfter,
  })
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
        side: options.stageSide ?? 1,
      })
    : aimedPitch

  const batter = entryStageAbilityOf(progress, options.opponentTeamId, progress.opponentOrderIndex)
  // 0xb633d(타자) — 레코드 +0xa 비트 6. 명단에 끼운 마타자(`withAceBatter`)만 참이다
  const aceBatterIndex = entryBattersOf(progress, options.opponentTeamId)[progress.opponentOrderIndex]?.aceIndex ?? NO_ACE_BATTER
  const isMagicBatter = aceBatterIndex >= 0
  const ourRepertoireAce = repertoire.magicId >= ACE_SPECIAL_NUMBER_OFFSET
  const { stealingFrom, stealScene } = cpuStealStartOf(progress, random)
  const thrown = pitchAgainstBatterDetailed(
    pitch,
    batter,
    random,
    {
      control: fatigued.control,
      velocity: fatigued.velocity,
    },
    // 원본 0x34334 는 state+4·+5·+6(S·B·O)과 주자 유무로 타격 표(0x9f190)의 행을 고른다
    {
      strikes: progress.atBat.strikes,
      balls: progress.atBat.balls,
      outs: progress.game.outs,
      hasRunner: runnerCountOf(progress.game.bases) > 0,
    },
    cpuSwingTraitsOf(progress, isMistake, isMagicBatter, aceBatterIndex, ourRepertoireAce, repertoire, staminaPercent),
  )
  const resolution = thrown.resolution
  const foulContact = thrown.foulContact

  const afterPitch = ourAfterPitchOf(progress, {
    stamina,
    magicRemainingAfter,
    ballMagicNumber,
    thrown,
    resolution,
    foulContact,
    pitch,
    isMistake,
    stealingFrom,
    stealScene,
  })

  return finishOurThrow(afterPitch, thrown, resolution, foulContact, pitch, random, defer, holdsArrival)
}
