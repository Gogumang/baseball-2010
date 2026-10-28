import {
  type PitcherStats,
  fatiguedStatsOf,
  drainStamina,
  pitchGradeOf,
  buildHumanPitch,
  mistakeHumanPitchOf,
} from '@/features/play-pitcher-game/model/pitcherPitch'
import { entryPitcherGameAbilityParts, NO_ACE_BATTER } from '@/features/play-team-game/model/teamGameRoster'
import { pitcherGameStatsOf } from '@/entities/pitching/model/pitcherGameStats'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { MAGIC_PITCH_TYPE_NUMBER, ballMagicNumberOfPitch } from '@/entities/pitcher-career/model/magicPitch'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { isMistakePitch } from '@/entities/pitching/model/mistakePitch'
import { runnerCountOf } from '@/entities/game/model/baseState'
import { rollCpuStealStart, stealStartSceneOf, arrivesUnhit } from '@/features/defense-play/model/pitchArrivalPlay'
import { pitchAgainstBatterDetailed, cpuSwingPoseOf } from '@/entities/pitching/model/simulateBatter'
import { aceLevelOf, aceLevelSlotOf } from '@/entities/mission/model/aceLevel'
import { applyPitchResolution } from '@/entities/at-bat/model/atBatState'
import { sceneResultCodeOfThrown } from '@/features/defense-play/model/sceneResultCode'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import { offenseRunnerTeamGradeOf, runAbilitiesOnBaseOf } from '@/features/play-team-game/model/teamGameFlow/baseRunning/runners'
import { ourTeamMoraleOf, pitcherAbilityContextOf } from '@/features/play-team-game/model/teamGameFlow/context/abilityContext'
import { startDefensiveFoulPlay } from '@/features/play-team-game/model/teamGameFlow/defense/defensiveAtBat'
import { defenseAbilitiesFor } from '@/features/play-team-game/model/teamGameFlow/defense/fielders'
import { resolveDefensePlay } from '@/features/play-team-game/model/teamGameFlow/defense/resolveDefensePlay'
import { arriveOurPitchThenRest } from '@/features/play-team-game/model/teamGameFlow/pitching/ourPitchArrival'
import { withHalfInningPitches } from '@/features/play-team-game/model/teamGameFlow/records/atBatRecords'
import {
  entryBatterIntimidatesAt,
  entryBatterSkillIdsOf,
  entryBattersOf,
  entryPitcherSkillIdsOf,
  entryStageAbilityOf,
} from '@/features/play-team-game/model/teamGameFlow/roster/batters'
import { ourPitcherStats } from '@/features/play-team-game/model/teamGameFlow/roster/currentPitcher'
import {
  mistakeSkillFlagsOf,
  pitcherEntryAt,
  pitcherRepertoireAt,
  pitcherSkillFlagsAt,
} from '@/features/play-team-game/model/teamGameFlow/roster/pitchers'
import {
  ACE_SPECIAL_NUMBER_OFFSET,
  aceBatterLevelOf,
  specialSwingRemainingAt,
  withSpecialSwingSlot,
} from '@/features/play-team-game/model/teamGameFlow/roster/specialSwing'
import { chargeMoundLine } from '@/features/play-team-game/model/teamGameFlow/settlement/pitcherLines'
import { isPitchTurn } from '@/features/play-team-game/model/teamGameFlow/turn/turns'
import type { TeamPendingPitchArrival, TeamPitchInput } from '@/features/play-team-game/model/teamGameFlow/types/plays'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * 우리(사람) 투수의 **체력%로 부른** 제구 · 구속 · 변화 — 등급 0x4dbac · 피로 능력치 0x34968 은 CPU 투수와 같은 `0xb570c(…, 체력%)` 라
 * 시즌 내 팀 보정 → **피로 0xb58e6** → 팀 능력치 정액 → 스킬 14 투지 → 코치 차례다(`pitcherGameStatsOf`). 예전에는 정액까지 먹인
 * 값(`ourPitcherStats`)에 피로를 먹였다 — 체력 54% 아래에서 팀 정액이 있으면 값이 달랐다(A-23 에서 원본 차례로). 명단 칸이 없으면 옛 길
 */
function ourFatiguedStatsOf(progress: TeamGameProgress, stats: PitcherStats, stamina: number): PitcherStats {
  const entry = pitcherEntryAt(progress, progress.options.ourTeamId, progress.ourPitcherIndex)
  if (entry === undefined) return fatiguedStatsOf(stats, stamina)
  const parts = entryPitcherGameAbilityParts(pitcherAbilityContextOf(progress), progress.options.ourTeamId, entry)
  return { ...pitcherGameStatsOf(parts, staminaPercentOf(stamina)), stamina: stats.stamina }
}

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
  // CPU 도루 0x520de — 상태 0x11 의 10번째 틱(0x537dc → 메시지 0x583)이라 CPU 타자 결정(11번째 틱 0x34334)
  // **바로 앞**이다. 후보가 있을 때만 rand(0,1000) 한 번 → 0xa9bd4 출발 (`rollCpuStealStart`)
  const stealingFrom = rollCpuStealStart(
    {
      bases: progress.game.bases,
      offenseIsCpu: true,
      runAbilityOf: (base) => runAbilitiesOnBaseOf(progress, '수비')[base] ?? 0,
      // 루 위 주자 +0xa4 에 든 공격(상대) 팀 근성 등급 (0xa93ac a9488) — 300~383 이라 표 칸(÷250)은 그대로 1 이다
      runnerTeamGrade: offenseRunnerTeamGradeOf(progress, false),
    },
    random,
  )
  // 같은 메시지 0x583 의 52222 — CPU 송구 결정 0xafa60 한 번(앞 판이 끝난 그대로의 우리 수비). 11번째 틱 CPU 타자 결정보다 먼저다
  // (`stealStartSceneOf`, r214 — 예전 웹은 공 도착 판 맨 앞에서 굴렸다). 수비 · 주자 칸은 공 도착 판(`arriveTeamPitch`)과 같다
  const stealScene = stealStartSceneOf(
    {
      scene: progress.defenseScene,
      bases: progress.game.bases,
      outs: progress.game.outs,
      defenseAbilities: defenseAbilitiesFor(progress, options.ourTeamId),
      runAbilities: runAbilitiesOnBaseOf(progress, '수비'),
      runnerTeamGrade: offenseRunnerTeamGradeOf(progress, false),
    },
    stealingFrom,
    random,
  )
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
    {
      isMistakePitch: isMistake,
      isMagicBatter,
      // 마타자 필살 0x34468~0x34488 — 남은 칸(0xaea30)이 0 이 아니면 휘두를 때마다 필살이다 (난수 없음).
      // 번호 = 마선수 +0x18 = 순번 + 5, 보정 구조체 k = 레벨·5 + 순번
      ...(isMagicBatter
        ? {
            specialSwing: {
              swingNumber: aceBatterIndex + ACE_SPECIAL_NUMBER_OFFSET,
              remaining: specialSwingRemainingAt(progress, '상대'),
              aceOrder: aceBatterIndex,
              aceLevel: aceBatterLevelOf(progress, aceBatterIndex),
            },
          }
        : {}),
      // 0x34d6c 투수 쪽 — 공+0x10 이 서 있고 우리 투수가 마투수면 `mgr[0x13a + 순번]`
      pitcherAceLevel: ourRepertoireAce
        ? aceLevelOf(options.aceLevels, aceLevelSlotOf('투수', repertoire.magicId - ACE_SPECIAL_NUMBER_OFFSET + 1))
        : 0,
      // 팀 경기 모드 1·2·8·9 는 판정 묶음 '일반' — 수비(우리)가 사람이라 hit·power 쪽 −10 (0xab5c0).
      // 내 선수 보너스(모드 3·4)·투수 미션 +100(모드 5)은 없다 — 팀 명단에 비트7 선수가 없다
      swingMode: '일반',
      // 파울 각 공도 수비 판을 돈다 — 낙구 전에 잡히면 파울 뜬공 아웃(13), 아니면 판이 닫힌 뒤 스트라이크(0x35108 → 0xb6b58)
      playsFoulBall: true,
      // ab838 — 이번 공을 깎은 뒤 체력% 가 0 이면 B · C 에 +2000
      pitcherStaminaPercent: staminaPercent,
      // 0xab214 ab91c~ — 상대 지금 타자 레코드 +0x14 (`0xb62b4(타자, n)`, 마타자는 제 행)
      batterSkillIds: entryBatterSkillIdsOf(entryBattersOf(progress, options.opponentTeamId)[progress.opponentOrderIndex]),
      // 같은 갈래가 던지는 우리 투수 레코드 +0x14 도 `0xb62b4(투수, n)` 로 읽는다 — 명단 투수 비트 + 16 (마투수는 제 행)
      pitcherSkillIds: entryPitcherSkillIdsOf(pitcherEntryAt(progress, options.ourTeamId, progress.ourPitcherIndex)),
      skillSituation: {
        // 투수 스킬 31(0xabcd8)의 `0xb6394(타자)` — 경기 시작 레코드 첨자 · 마타자 순번 (`TeamEntryBatter.recordSlot`)
        batterOrderIndex: entryBattersOf(progress, options.opponentTeamId)[progress.opponentOrderIndex]?.recordSlot ?? 0,
        inning: progress.game.inning,
        // 0xab966 — 수비(우리) 점수 > 공격(상대) 점수
        isLosing: progress.game.ourScore > progress.game.opponentScore,
        runnerCount: runnerCountOf(progress.game.bases),
        hasSecondBaseRunner: progress.game.bases.second,
        // 이 타순 칸의 오늘 타석 결과 링 (팀 객체 + 타순×0x18 + 0x34)
        recentAtBatCodes: progress.opponentEntryRecords[progress.opponentOrderIndex]?.results ?? [],
      },
    },
  )
  const resolution = thrown.resolution
  const foulContact = thrown.foulContact

  const afterPitch: TeamGameProgress = {
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

  // 파울 각 공 — 원본도 판(상태 0x17)을 돈다(맞은 공은 모두 메시지 0x11 → 0x13 → 0x17). 공 도착 판(0x3dfac)은 못 맞힌 공만이다
  if (foulContact !== undefined) {
    const started = startDefensiveFoulPlay(afterPitch, foulContact, random, thrown.buntKind ?? 0)
    if (defer) return started
    const pending = started.pendingDefensePlay
    if (pending === null) return started
    const result = runDefensePlay(pending.input)
    return resolveDefensePlay({ ...started, lastDefensePlay: result }, result, random)
  }

  // 공 도착 0x3dfac — 못 맞힌 공이면 0.1% 폭투·포일(종류 9)이나 CPU 가 건 도루(종류 5) 판을 연다.
  // 우리 수비라 송구는 사람 쪽이다 — 화면이 도는 갈래(`defer`)면 판을 붙들어 키(+0x160)를 받으며 실시간으로 돌린다
  const arrivalPitch: TeamPendingPitchArrival = {
    resolution,
    outcomeAfter: afterPitch.atBat.outcome,
    // CPU 타자의 이 공 번트 종류(`simulateBatter`) — 번트 헛스윙도 0x3445a 가 쓴 종류가 남는다(0x34436~0x34464, 안 휘두르면 0x340dc 가 지운 0)
    buntKind: thrown.buntKind ?? 0,
    batterHand: pitch.stageSide,
    isUncatchable: thrown.isUncatchable,
  }
  // 화면 갈래 — 0x3dfac 은 0x12 진입 틀이다. 공이 나는 동안의 관리자 틱 굴림이 먼저 나도록 그 틀까지 붙든다 (`enterPitchResult`)
  if (holdsArrival && arrivesUnhit(resolution)) return { ...afterPitch, pendingPitchArrival: arrivalPitch }
  return arriveOurPitchThenRest(afterPitch, arrivalPitch, random, defer)
}
