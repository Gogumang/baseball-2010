import type { PitcherAbility } from '@/entities/pitching/model/pitch'
import { heldCpuMagicAfterPitch, FRESH_HELD_CPU_MAGIC, cpuMagicStateOf } from '@/entities/pitching/model/magicPitchGame'
import { withPitcherFightingSpirit } from '@/entities/pitching/model/pitcherGameStats'
import { pitcherAbilityOf } from '@/entities/game/model/aceOpponent'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { drainPitcherForPitch } from '@/entities/game/model/simulateHalfInning'
import { gameFightingSpiritOf } from '@/features/play-game/model/gameFlow/context/fightingSpirit'
import { opponentQuickDefenseOf } from '@/features/play-game/model/gameFlow/quick/quickDefense'
import { withOpponentRecordTouched } from '@/features/play-game/model/gameFlow/records/gameRecords'
import { opponentPitcherAbilityOf } from '@/features/play-game/model/gameFlow/roster/opponentPitcher'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

export function throwOpponentPitch(
  progress: GameProgress,
  pitchTypeNumber: number,
  options: {
    readonly batterIntimidates: boolean
    /**
     * 던진 마운드 투수(`stageOpponentPitcherAbilityOf`)와 마선수 레벨 — 주면 마구 두 칸(+0x28 · 공+0x10)을 0x345fc · 0x3de10
     * 차례로 고친다(`opponentCpuMagic`). 안 주면 그대로
     */
    readonly magic?: { readonly pitcher: PitcherAbility; readonly aceLevels?: Readonly<Record<number, number>> }
  },
): GameProgress {
  if (progress.game.isFinished) return progress
  const mound = progress.opponentMound
  // 소모(0x11 진입 3dec6 0xa5e14) 뒤 틱 10 놓기 0x4dc78 의 0x4dbac · 0x34968 이 상대(수비) 레코드 +2 를 덮는다
  return withOpponentRecordTouched({
    ...progress,
    ...(options.magic === undefined
      ? {}
      : {
          opponentCpuMagic: heldCpuMagicAfterPitch(
            progress.opponentCpuMagic ?? FRESH_HELD_CPU_MAGIC,
            options.magic.pitcher,
            options.magic.aceLevels,
            pitchTypeNumber,
          ),
        }),
    opponentMound: {
      ...mound,
      stamina: opponentStaminaAfterPitch(progress, pitchTypeNumber, options),
      pitches: mound.pitches + 1,
      justChanged: false,
    },
    // 같은 0xa5e14 가 state[0xe](CPU 대타 막음)도 내린다 (a5e7c)
    pinchHitUsed: false,
    // 같은 0xa5e14 가 정산 사건 목록을 비운다 (a5e80 ctx+0x2c = 0)
    pendingSettlementEvents: undefined,
  })
}

/**
 * **내 타석 마운드 상대 투수의 타석 화면 능력치** — 마선수 대결 투수(`aceOpponent`)면 `pitcherAbilityOf`(부르는 쪽 레벨), 아니면
 * `opponentPitcherAbilityOf`. 타석 화면(`app/ui/GameRoute`)과 마구 두 칸 고치기(`throwOpponentPitch` 의 `magic`)가 함께 쓴다
 */
export function stageOpponentPitcherAbilityOf(progress: GameProgress, aceLevels: Readonly<Record<number, number>> | undefined): PitcherAbility {
  return progress.aceOpponent === null
    ? opponentPitcherAbilityOf(progress)
    : withPitcherFightingSpirit(
        pitcherAbilityOf(progress.aceOpponent, aceLevels, staminaPercentOf(progress.opponentMound.stamina)),
        gameFightingSpiritOf(progress, progress.opponentTeamId),
      )
}

/** 타석 화면에 넘길 CPU 마구 두 칸(`BattingStage.cpuMagic`) — 안 채웠으면 지금 마운드 투수로 채운 값(0xaebe4 aeea8) */
export function opponentCpuMagicStateOf(
  progress: GameProgress,
  pitcher: PitcherAbility,
  aceLevels: Readonly<Record<number, number>> | undefined,
): { readonly remaining: number; readonly ballMagicNumber: number } {
  return cpuMagicStateOf(progress.opponentCpuMagic ?? FRESH_HELD_CPU_MAGIC, pitcher, aceLevels)
}

/** 상대 투수가 이 구질을 던져 깎은 뒤의 +0x2c (0xa5e14 → 0xaeb08) — `throwOpponentPitch` 와 타석 화면의 투구 AI 가 함께 쓴다 */
function opponentStaminaAfterPitch(progress: GameProgress, pitchTypeNumber: number, options: { readonly batterIntimidates: boolean }): number {
  return drainPitcherForPitch(opponentQuickDefenseOf(progress), progress.opponentMound, pitchTypeNumber, options.batterIntimidates)
}

/**
 * **이 구질을 던져 깎은 뒤의 상대 투수 체력%** — `PitcherAbility.staminaPercentAfterPitch` 로 타석 화면에 넘긴다.
 * 원본은 공이 손을 떠나는 0x11 진입(0x3dec6 → 0xa5e14)에서 깎고, 놓기 0x4dc78 의 제구 등급 0x4dbac · 피로 0x34968 과
 * 스윙 판정 0xab214 가 그 **깎은 뒤** 체력을 본다. 깎는 셈은 `throwOpponentPitch` 와 같다(같은 `batterIntimidates` 를 넘긴다).
 */
export function opponentStaminaPercentAfterPitchOf(
  progress: GameProgress,
  options: { readonly batterIntimidates: boolean },
): (pitchTypeNumber: number) => number {
  return (pitchTypeNumber) => staminaPercentOf(opponentStaminaAfterPitch(progress, pitchTypeNumber, options))
}
