import { withFightingSpirit } from '@/entities/pitching/model/pitcherGameStats'
import { runnerCountOf } from '@/entities/game/model/baseState'
import { isMistakePitch } from '@/entities/pitching/model/mistakePitch'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { QuickAtBatBatter } from '@/entities/game/model/quickAtBat'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { ballMagicNumberOfPitch, MAGIC_PITCH_TYPE_NUMBER } from '@/entities/pitcher-career/model/magicPitch'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import {
  buildHumanPitch,
  drainStamina,
  fatiguedStatsOf,
  mistakeHumanPitchOf,
  pitchGradeOf,
  type PitcherStats,
} from '@/features/play-pitcher-game/model/pitcherPitch'
import { myFightingSpiritOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/auto/fightingSpirit'
import { opponentQuickBatterOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/opponentBatters'
import { startsToday } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/pitcherOrder'
import { INTIMIDATE_SKILL_ID } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/constants'
import type { PitchInput } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/pitchStateTypes'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/** 화면 배치 side 를 안 넘겼을 때 (투영 원점 표 0xcfb18 의 칸) */
const DEFAULT_STAGE_SIDE = 1

/** 사람이 놓은 공 하나 — 소모 · 등급 · 궤적 · 실투까지 굴린 값 */
export interface MyRolledPitch {
  readonly stamina: number
  readonly staminaPercent: number
  readonly fatigued: PitcherStats
  readonly grade: number
  readonly magicRemaining: number
  readonly ballMagicNumber: number
  readonly pitch: Pitch
  readonly isMistake: boolean
  /** 지금 상대 타자 레코드 — 0xa5e14 · 실투 0x33cbc 가 +0x14 의 압도 22 를, 0xab214 스킬 갈래가 +0x14 · 칸 0xb6394 를 읽는다 */
  readonly opponentBatter: QuickAtBatBatter
}

/**
 * 내 공 하나의 굴림 — 등급 0x4dbac → 궤적(제구 흩어짐) → 실투 0x33cbc 차례.
 *
 * 스태미나 소모 0xa5e14 — 상태 0x11 **진입** 0x3de10 의 0x3dec6 이다. 놓기 0x4dc78(0x11 의 틱 10)보다 앞이라
 * 등급 굴림 0x4dbac(4dcba) · 피로 능력치 0x34968(4dcc2) · CPU 타자 스윙 0xab214(ab548 · ab582 · ab838)가 모두
 * **이번 공을 깎은 뒤**의 체력을 본다. 스태미나는 게이지 결과와 무관하다 — 인자가 (game, 구질) 뿐이다 (P1 3-1 확정).
 * 상대 타자 레코드는 붙박이 줄이면 Xls 행 그대로, 마타자는 XlsACE_BAT 행 — 모드 갈래 없음.
 */
export function rollMyPitch(progress: PitcherGameProgress, input: PitchInput, random: RandomPort): MyRolledPitch {
  const { options } = progress
  const opponentBatter = opponentQuickBatterOf(progress)
  const opponentIntimidates = opponentBatter.skillIds.includes(INTIMIDATE_SKILL_ID)
  const stamina = myStaminaAfterPitchOf(progress, input, opponentIntimidates)
  const staminaPercent = staminaPercentOf(stamina)
  // 0xb570c 스킬 14 갈래 — 내 투수 장착 비트 14 ∧ 지금 판의 경기 상태 (`myFightingSpiritOf`). 등급 · 피로 능력치 · CPU 스윙이 함께 본다
  const myFightingSpirit = myFightingSpiritOf(progress)
  const fatigued = fatiguedStatsOf(options.stats, stamina, myFightingSpirit)
  const gradeInput = { gaugeSettingOn: options.gaugeSettingOn, typeNumber: input.typeNumber, gaugeCell: input.gaugeCell }
  const grade = pitchGradeOf({ ...gradeInput, effectiveControl: fatigued.control, staminaPercent }, random)
  const magic = magicAfterPitchOf(progress, input)
  const aimedPitch = rollAimedPitch(progress, input, { grade, fatigued, ballMagicNumber: magic.ballMagicNumber }, random)
  const isMistake = rollMistake(progress, input, { grade, myFightingSpirit, opponentIntimidates }, random)
  // 실투면 0x4dec0~0x4df5e 가 곡선 0x9e3c9 앞에서 공을 존 한가운데 · N 18/20 으로 다시 놓는다 (굴림 없음)
  const pitch = isMistake ? mistakePitchOf(progress, input, aimedPitch, { grade, fatigued }) : aimedPitch
  return { stamina, staminaPercent, fatigued, grade, ...magic, pitch, isMistake, opponentBatter }
}

function myStaminaAfterPitchOf(progress: PitcherGameProgress, input: PitchInput, batterIntimidates: boolean): number {
  const { options } = progress
  return drainStamina({
    stamina: progress.stamina,
    typeNumber: input.typeNumber,
    staminaAbility: options.staminaAbility,
    teamMorale: options.teamMorale,
    // 선발로 나왔으면 아직 교체가 없는 "첫 투수" 다. 구원으로 올라오면 +200 이 없다
    isFirstPitcher: startsToday(options),
    // 0xa5e14 a5f0e — `0xb62b4(공격 팀 지금 타자, 22)` 압도면 ×2
    batterIntimidates,
    pitcherIsCoward: options.pitcherIsCoward === true,
    pitcherEndures: options.pitcherEndures === true,
  })
}

/** 0x50e9c(코스 확정) 마구 소모 → 0x3de10(0x11 진입) 공+0x10 싣기 차례 — 소모 뒤 남은 > 0 일 때만 싣는다. 고침(B-01)이면 마구로 던진 이 공에만 */
function magicAfterPitchOf(progress: PitcherGameProgress, input: PitchInput) {
  const magicRemaining = input.typeNumber === MAGIC_PITCH_TYPE_NUMBER ? progress.magicRemaining - 1 : progress.magicRemaining
  const ballMagicNumber = ballMagicNumberOfPitch({
    previous: progress.ballMagicNumber,
    pitchTypeNumber: input.typeNumber,
    pitcherMagicNumber: progress.options.repertoire.magicNumber,
    remainingBefore: progress.magicRemaining,
    remainingAfter: magicRemaining,
  })
  return { magicRemaining, ballMagicNumber }
}

function rollAimedPitch(
  progress: PitcherGameProgress,
  input: PitchInput,
  rolled: { readonly grade: number; readonly fatigued: PitcherStats; readonly ballMagicNumber: number },
  random: RandomPort,
): Pitch {
  const { options } = progress
  const aim = input.aim === undefined ? {} : { aim: input.aim }
  const built = buildHumanPitch(
    {
      typeNumber: input.typeNumber,
      ...aim,
      grade: rolled.grade,
      gaugeCell: input.gaugeCell,
      stats: rolled.fatigued,
      repertoire: options.repertoire,
      side: options.stageSide ?? DEFAULT_STAGE_SIDE,
    },
    random,
  )
  // P+0x10 — 0x34d6c 투수 쪽 번호. 내 투수는 육성(비트7)이라 1~4 면 표 칸 n = 번호 − 1 (pitcherBoostSideOf). 던진 투수 레코드 +0x18
  return { ...built, magicNumber: rolled.ballMagicNumber, pitcherMagicNumber: options.repertoire.magicNumber }
}

/**
 * 실투 판정 0x33cbc — 투구 순간 0x4dc78 이 궤적 준비 0x9e669 **뒤**(0x4dea0)에 부른다.
 * 등급 뽑기(0x4dbac)·제구 흩어짐 굴림이 다 끝난 뒤이고, CPU 타자 결정 0x34334 보다 앞이다. 마구가 아니면 rand(0,100) 을 늘 한 번 굴린다.
 */
function rollMistake(
  progress: PitcherGameProgress,
  input: PitchInput,
  rolled: { readonly grade: number; readonly myFightingSpirit: boolean; readonly opponentIntimidates: boolean },
  random: RandomPort,
): boolean {
  const { options } = progress
  // 0xb570d(ctx, 1, 투수, 1, 90, 1) — 칸 1 구속, 체력 인자 90 이라 피로 감소가 없다.
  // `options.stats` 가 곧 장비·스킬·컨디션을 먹인 실효값이다 (`fatiguedStatsOf` 주석). 스킬 14 갈래는 피로 없는 값에도 선다
  const velocity = options.stats.velocity
  return isMistakePitch(
    {
      isMagicPitch: input.typeNumber === MAGIC_PITCH_TYPE_NUMBER,
      grade: rolled.grade,
      effectiveVelocity: rolled.myFightingSpirit ? withFightingSpirit(velocity) : velocity,
      runnerCount: runnerCountOf(progress.game.bases),
      hasSecondBaseRunner: progress.game.bases.second,
      // 지금 상대 타자의 압도 22 (+5) — drainStamina 와 같은 값
      batterIntimidates: rolled.opponentIntimidates,
      pitcherIsSteady: options.pitcherIsSteady === true,
      pitcherIsTimid: options.pitcherIsTimid === true,
      pitcherIsCool: options.pitcherIsCool === true,
    },
    random,
  )
}

function mistakePitchOf(
  progress: PitcherGameProgress,
  input: PitchInput,
  aimed: Pitch,
  rolled: { readonly grade: number; readonly fatigued: PitcherStats },
): Pitch {
  const { options } = progress
  return mistakeHumanPitchOf(aimed, {
    typeNumber: input.typeNumber,
    grade: rolled.grade,
    stats: rolled.fatigued,
    repertoire: options.repertoire,
    side: options.stageSide ?? DEFAULT_STAGE_SIDE,
  })
}
