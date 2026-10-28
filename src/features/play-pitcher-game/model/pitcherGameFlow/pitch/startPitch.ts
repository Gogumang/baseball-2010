import { withFightingSpirit } from '@/entities/pitching/model/pitcherGameStats'
import { runnerCountOf } from '@/entities/game/model/baseState'
import { pitchAgainstBatterDetailed } from '@/entities/pitching/model/simulateBatter'
import { isMistakePitch } from '@/entities/pitching/model/mistakePitch'
import { rollCpuStealStart, stealStartSceneOf } from '@/features/defense-play/model/pitchArrivalPlay'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { ballMagicNumberOfPitch, MAGIC_PITCH_TYPE_NUMBER } from '@/entities/pitcher-career/model/magicPitch'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { buildHumanPitch, drainStamina, fatiguedStatsOf, mistakeHumanPitchOf, pitchGradeOf } from '@/features/play-pitcher-game/model/pitcherPitch'
import { myFightingSpiritOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/auto/fightingSpirit'
import { myDefenseAbilitiesOf, runAbilitiesOnBaseOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/fielding/fielderInputs'
import { isPitchTurn } from '@/features/play-pitcher-game/model/pitcherGameFlow/pitch/pitchTurn'
import { afterPitchOf, cpuBatterTraitsOf, startedPitchRestOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/pitch/startPitchRest'
import {
  opponentBatterAbility,
  opponentQuickBatterOf,
  opponentRosterSlotOf,
} from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/opponentBatters'
import { startsToday } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/pitcherOrder'
import { INTIMIDATE_SKILL_ID } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/constants'
import type { PitchInput } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/pitchStateTypes'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/**
 * 공 하나를 던지고 **인플레이 타구면 거기서 멈춘다** — 주자 처리를 뒤로 미룬다.
 *
 * 인플레이 타구는 진행기에 넘길 `DefensePlayInput` 만 만들어 `pendingDefensePlay` 에 얹고
 * 경기 상태(루·아웃·점수·기록)는 **한 톨도 건드리지 않은 채** 돌려준다. 그 동안 다음 공이
 * 나가지 않는 것이 이 칸의 뜻이다 (원본 상태 0x17 이 도는 동안 0xf 로 안 가는 것과 같은 자리).
 * 주자 처리·기록·돌발 판정은 화면이 다 돌고 `resolveDefensePlay` 를 부를 때 한 번에 한다.
 *
 * 삼진·볼넷·홈런은 수비가 개입할 것이 없어 여기서 곧장 끝낸다 (타자편 `startPlayerOutcome` 과 같다).
 */
export function startPitch(
  progress: PitcherGameProgress,
  input: PitchInput,
  random: RandomPort,
  /**
   * 화면이 도는 갈래 — 공 도착의 도루 · 폭투 판을 붙들어(`pendingRunnerPlay`) 화면이 키(+0x160)를 받으며 실시간으로 돌리게 한다.
   * 안 주면 예전처럼 키 없이 미리 돌린다(`throwPitch` · 시험)
   */
  live = false,
  /**
   * 화면 갈래 — 못 맞힌 공의 공 도착 0x3dfac 을 0x12 진입 틀까지 붙든다(`pendingPitchArrival`). 부르는 쪽이 그 틀
   * (놓은 틀에서 `pitchResultEntryDelayTicksOf` 뒤)에 `enterPitchResult` 를 부른다. 안 주면 예전처럼 놓는 걸음에 다 돌린다
   */
  holdsArrival = false,
): PitcherGameProgress {
  if (!isPitchTurn(progress) || progress.pendingPitchArrival != null) return progress
  const { options } = progress
  const isMagic = input.typeNumber === MAGIC_PITCH_TYPE_NUMBER
  if (isMagic && progress.magicRemaining <= 0) return progress

  // 스태미나 소모 0xa5e14 — 상태 0x11 **진입** 0x3de10 의 0x3dec6 이다. 놓기 0x4dc78(0x11 의 틱 10)보다 앞이라
  // 등급 굴림 0x4dbac(4dcba) · 피로 능력치 0x34968(4dcc2) · CPU 타자 스윙 0xab214(ab548 · ab582 · ab838)가 모두
  // **이번 공을 깎은 뒤**의 체력을 본다. 스태미나는 게이지 결과와 무관하다 — 인자가 (game, 구질) 뿐이다 (P1 3-1 확정)
  // 지금 상대 타자 레코드 — 0xa5e14 · 실투 0x33cbc 가 +0x14 의 압도 22 를, 0xab214 스킬 갈래가 +0x14 · 칸 0xb6394 를 읽는다
  // (붙박이 줄은 Xls 행 그대로, 마타자는 XlsACE_BAT 행 — 모드 갈래 없음)
  const opponentBatter = opponentQuickBatterOf(progress)
  const opponentIntimidates = opponentBatter.skillIds.includes(INTIMIDATE_SKILL_ID)
  const stamina = drainStamina({
    stamina: progress.stamina,
    typeNumber: input.typeNumber,
    staminaAbility: options.staminaAbility,
    teamMorale: options.teamMorale,
    // 선발로 나왔으면 아직 교체가 없는 "첫 투수" 다. 구원으로 올라오면 +200 이 없다
    isFirstPitcher: startsToday(options),
    // 0xa5e14 a5f0e — `0xb62b4(공격 팀 지금 타자, 22)` 압도면 ×2
    batterIntimidates: opponentIntimidates,
    pitcherIsCoward: options.pitcherIsCoward === true,
    pitcherEndures: options.pitcherEndures === true,
  })
  const staminaPercent = staminaPercentOf(stamina)
  // 0xb570c 스킬 14 갈래 — 내 투수 장착 비트 14 ∧ 지금 판의 경기 상태 (`myFightingSpiritOf`). 등급 · 피로 능력치 · CPU 스윙이 함께 본다
  const myFightingSpirit = myFightingSpiritOf(progress)
  const fatigued = fatiguedStatsOf(options.stats, stamina, myFightingSpirit)
  const grade = pitchGradeOf(
    {
      gaugeSettingOn: options.gaugeSettingOn,
      typeNumber: input.typeNumber,
      gaugeCell: input.gaugeCell,
      effectiveControl: fatigued.control,
      staminaPercent,
    },
    random,
  )
  // 0x50e9c(코스 확정) 마구 소모 → 0x3de10(0x11 진입) 공+0x10 싣기 차례 — 소모 뒤 남은 > 0 일 때만 싣는다
  const magicRemaining = isMagic ? progress.magicRemaining - 1 : progress.magicRemaining
  // 고침(B-01)이면 마구로 던진 이 공에만 싣는다 — `ballMagicNumberOfPitch`
  const ballMagicNumber = ballMagicNumberOfPitch({
    previous: progress.ballMagicNumber,
    pitchTypeNumber: input.typeNumber,
    pitcherMagicNumber: options.repertoire.magicNumber,
    remainingBefore: progress.magicRemaining,
    remainingAfter: magicRemaining,
  })
  const builtPitch = buildHumanPitch(
    {
      typeNumber: input.typeNumber,
      ...(input.aim === undefined ? {} : { aim: input.aim }),
      grade,
      gaugeCell: input.gaugeCell,
      stats: fatigued,
      repertoire: options.repertoire,
      side: options.stageSide ?? 1,
    },
    random,
  )
  const aimedPitch: Pitch = {
    ...builtPitch,
    // P+0x10 — 0x34d6c 투수 쪽 번호. 내 투수는 육성(비트7)이라 1~4 면 표 칸 n = 번호 − 1 (pitcherBoostSideOf)
    magicNumber: ballMagicNumber,
    // 던진 투수 레코드 +0x18
    pitcherMagicNumber: options.repertoire.magicNumber,
  }

  // 실투 판정 0x33cbc — 투구 순간 0x4dc78 이 궤적 준비 0x9e669 **뒤**(0x4dea0)에 부른다.
  // 등급 뽑기(0x4dbac)·제구 흩어짐 굴림이 다 끝난 뒤이고, CPU 타자 결정 0x34334 보다 앞이다.
  // 마구가 아니면 rand(0,100) 을 늘 한 번 굴린다.
  const isMistake = isMistakePitch(
    {
      isMagicPitch: isMagic,
      grade,
      // 0xb570d(ctx, 1, 투수, 1, 90, 1) — 칸 1 구속, 체력 인자 90 이라 피로 감소가 없다.
      // `options.stats` 가 곧 장비·스킬·컨디션을 먹인 실효값이다 (`fatiguedStatsOf` 주석). 스킬 14 갈래는 피로 없는 값에도 선다
      effectiveVelocity: myFightingSpirit ? withFightingSpirit(options.stats.velocity) : options.stats.velocity,
      runnerCount: runnerCountOf(progress.game.bases),
      hasSecondBaseRunner: progress.game.bases.second,
      // 지금 상대 타자의 압도 22 (+5) — drainStamina 와 같은 값
      batterIntimidates: opponentIntimidates,
      pitcherIsSteady: options.pitcherIsSteady === true,
      pitcherIsTimid: options.pitcherIsTimid === true,
      pitcherIsCool: options.pitcherIsCool === true,
    },
    random,
  )
  // 실투면 0x4dec0~0x4df5e 가 곡선 0x9e3c9 앞에서 공을 존 한가운데 · N 18/20 으로 다시 놓는다 (굴림 없음)
  const pitch = isMistake
    ? mistakeHumanPitchOf(aimedPitch, {
        typeNumber: input.typeNumber,
        grade,
        stats: fatigued,
        repertoire: options.repertoire,
        side: options.stageSide ?? 1,
      })
    : aimedPitch

  const batter = opponentBatterAbility(options, opponentRosterSlotOf(progress))
  // CPU 도루 0x520de — 상태 0x11 의 10번째 틱(0x537dc → 메시지 0x583)이라 실투 판정(0x4dea0) 뒤, CPU 타자 결정
  // (11번째 틱 0x34334) **바로 앞**이다. 후보가 있을 때만 rand(0,1000) 한 번 → 0xa9bd4 출발 (`rollCpuStealStart`)
  const stealingFrom = rollCpuStealStart(
    {
      bases: progress.game.bases,
      offenseIsCpu: true,
      runAbilityOf: (base) => runAbilitiesOnBaseOf(progress)[base] ?? 0,
    },
    random,
  )
  // 같은 메시지 0x583 의 52222 — CPU 송구 결정 0xafa60 한 번(앞 판이 끝난 그대로의 우리 수비). 11번째 틱 CPU 타자 결정보다 먼저다
  // (`stealStartSceneOf`, r214 — 예전 웹은 공 도착 판 맨 앞에서 굴렸다). 수비 · 주자 칸은 공 도착 판(`arrivePitcherPitch`)과 같다
  const stealScene = stealStartSceneOf(
    {
      scene: progress.defenseScene,
      bases: progress.game.bases,
      outs: progress.game.outs,
      defenseAbilities: myDefenseAbilitiesOf(progress),
      runAbilities: runAbilitiesOnBaseOf(progress),
    },
    stealingFrom,
    random,
  )
  const thrown = pitchAgainstBatterDetailed(
    pitch,
    batter,
    random,
    { control: fatigued.control, velocity: fatigued.velocity },
    // 원본 0x34334 가 보는 상황 — state 의 볼카운트·아웃과 주자 유무(0xa9599)
    {
      strikes: progress.atBat.strikes,
      balls: progress.atBat.balls,
      outs: progress.game.outs,
      hasRunner: runnerCountOf(progress.game.bases) > 0,
    },
    cpuBatterTraitsOf(progress, isMistake, staminaPercent, opponentBatter),
  )
  const afterPitch = afterPitchOf(progress, { stamina, magicRemaining, ballMagicNumber, pitch, isMistake, thrown, stealingFrom, stealScene })

  return startedPitchRestOf(progress, afterPitch, thrown, pitch, grade, live, holdsArrival, random)
}
