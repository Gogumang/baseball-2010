import type { GameState } from '@/entities/game/model/gameState'
import type { QuickAtBatBatter, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import { drainQuickPitcher, facingPitcherOf, type HalfInningDefense, type HalfInningMound } from '@/entities/game/model/simulateHalfInning'
import type { QuickPlateAppearance } from '@/entities/game/model/quickPlateAppearance'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { rollOpponentCpuPinchHit, rollTeammateCpuPinchHit } from '@/features/play-pitcher-game/model/pitcherGameFlow/atBat/cpuPinchHit'
import { rollOpponentPitcherChange, rollOurPitcherChange } from '@/features/play-pitcher-game/model/pitcherGameFlow/manager/pitcherChange'
import type { PitcherAutoRelayTick, PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/** 그 틱 뒤 경기를 중계 칸에 싣는다 — 사본에는 중계 칸을 안 남긴다 */
export function relayTickOf(after: PitcherGameProgress, before: GameState, atBat: PitcherAutoRelayTick['atBat']): PitcherAutoRelayTick {
  return { progress: { ...after, autoRelay: null }, before, atBat }
}

/** 간이 타석 한 틱 — 친 타자(그 팀 타순 칸)와 타석 끝 카운트를 함께 싣는다 */
export function quickAtBatRelayTickOf(
  after: PitcherGameProgress,
  before: GameState,
  batter: { readonly ours: boolean; readonly orderIndex: number },
  play: QuickPlateAppearance['play'],
): PitcherAutoRelayTick {
  return relayTickOf(after, before, {
    ...batter,
    outcome: play.outcome,
    fouled: play.fouled === true,
    swingingStrikeOutLost: play.swingingStrikeOutLost === true,
    strikes: play.strikes,
    balls: play.balls,
  })
}

/** 타자 스킬 22 압도 — 간이 타석 0xa5e14 소모 ×2 */
const QUICK_INTIMIDATE_SKILL_ID = 22

/**
 * 간이 타석의 공 하나를 던지기 앞 — `0xc262c` 의 공 고리는 c26be 0xa5c2d → **c26c8 0xa5e14(소모)** → c26d4 경로 굴림
 * 차례라, 공 하나가 보는 체력%(0xaebb0)는 그 공의 소모까지 먹은 값이다 (반 이닝 엔진 `beforePitch` 와 같다, d9d376c).
 * 갈고리는 난수를 쓰지 않는다.
 */
export function perPitchDrainOf(
  defense: HalfInningDefense,
  mound: HalfInningMound,
  /** 이 타석 타자 — 0xa5e14 가 `0xb62b4(지금 타자, 22)` 압도면 소모 ×2 */
  batter: Pick<QuickAtBatBatter, 'skillIds'>,
): { readonly beforePitch: () => QuickAtBatPitcher; readonly stamina: () => number } {
  let stamina = mound.stamina
  // 투구 수는 타석이 끝나야 더해지므로 이 타석에서 이미 던진 공을 얹는다 (`drainMoraleOf` 의 첫 공 판정)
  let thrown = 0
  const batterIntimidates = batter.skillIds.includes(QUICK_INTIMIDATE_SKILL_ID)
  return {
    beforePitch: () => {
      stamina = drainQuickPitcher(defense, { ...mound, stamina, pitches: mound.pitches + thrown }, 1, batterIntimidates)
      thrown += 1
      // 0xc11f0 · 0xc1818 은 체력%로 부른 제구 · 구속(피로 0xb58e6)을 세 자리에서 본다 — 반 이닝 엔진과 같은 값
      return facingPitcherOf(defense, mound.pitcherSlot, staminaPercentOf(stamina))
    },
    stamina: () => stamina,
  }
}

/** 한 타석 앞에서 `0xc1ba4` 를 다시 부르는 상한 — 대타 한 번 · 투수 한 번 · 마지막 빈 부름 */
const MAXIMUM_QUICK_SUBSTITUTION_CALLS = 3

/** 투구 처리 `0xa5e14` 의 a5e72 — `state[0xd]`(교체 직후)는 두 팀 공용 한 칸이라 공 하나에 둘 다 내려간다 */
export function withMoundsPitched(progress: PitcherGameProgress): Pick<PitcherGameProgress, 'ourMound' | 'opponentMound'> {
  return {
    ourMound: progress.ourMound.justChanged ? { ...progress.ourMound, justChanged: false } : progress.ourMound,
    opponentMound: progress.opponentMound.justChanged ? { ...progress.opponentMound, justChanged: false } : progress.opponentMound,
  }
}

/**
 * **간이 타석 앞의 `0xc1ba4`** (디스어셈 c1ba4~c1d06) — 자동 타석(0x21: 동료 타석 · 내가 마운드에 없는 수비 타석)마다.
 * ```
 * c1bc6  모드 3 이고 0xb6ded(내 투수) == 2(구원) 이고 수비 팀이 사람 팀이고 수비 팀 지금 투수가 내 선수가 아니면
 *          r7 = 벤치(team+0x33 명)에서 0xb6389 참인 첫 번호
 *          이닝(0-기준) == 7 이고 r7 ≠ −1 → 0xaf09c(수비 팀, r7, 0) · return 1      ; 8회 구원 등판 (`enterAsRelief`)
 * c1c50  r6 = 0xac228(…, 공격 팀, 주자관리, state)                                 ; CPU 대타 — 가림막 없음
 * c1c74  r4 = 0x66864(스킨)                                                          ; 모드 3 은 늘 1
 * c1c8c  [engine+0x94] > 0 && 모드 3 && 수비 팀 지금 투수가 내 선수 → 투수 교체 건너뜀
 * c1ce2  r6 |= 0xac428(…, 수비 팀, …, [sp+4] = (모드 == 3), [sp+8] = 0, [sp+0xc] = max(r7, 0))
 * c1cfe  return r6
 * ```
 * 1 을 돌려주면 `0xc262c` 가 공 없이 돌아가(c266c) 다음 부름에서 **같은 타석**으로 다시 지난다 — 바뀐 쪽은 `state[0xe]`·
 * `state[0xd]` 로 곧장 빠지고 안 바뀐 쪽은 다시 판정(굴림 포함)한다. 그래서 고리로 옮긴다(많아야 세 번 — 팀 경기
 * `runQuickSubstitutions` 와 같은 차례). 8회 구원 갈래는 `advance` 가 이 앞에서 먼저 본다(`isReliefEntryNow`).
 * 간이 엔진 쪽 교체는 연출(0x16)이 없어 소리도 없다.
 */
export function runQuickSubstitutions(
  progress: PitcherGameProgress,
  battingIsOurs: boolean,
  random: RandomPort,
  /** 교체가 난 부름마다 — 그 부름은 0x21 의 한 틱이다(공 없이 돌아감 c266c) */
  onSubstitutionTick?: (after: PitcherGameProgress, before: GameState) => void,
): PitcherGameProgress {
  let current = progress
  for (let call = 0; call < MAXIMUM_QUICK_SUBSTITUTION_CALLS; call += 1) {
    const changed = battingIsOurs ? rollOurOffenseSubstitution(current, random) : rollOpponentOffenseSubstitution(current, random)
    if (changed === current) return current
    onSubstitutionTick?.(changed, current.game)
    current = changed
  }
  return current
}

/** 우리 공격 타석 앞 — 우리 CPU 대타 0xac228(0xc1c50) → 상대 투수 교체 0xac428(0xc1ce2) */
function rollOurOffenseSubstitution(progress: PitcherGameProgress, random: RandomPort): PitcherGameProgress {
  const pinched = rollTeammateCpuPinchHit(progress, random)
  return rollOpponentPitcherChange(pinched, random)
}

/** 상대 공격 타석 앞 — 상대 CPU 대타 → 우리 CPU 투수 교체 */
function rollOpponentOffenseSubstitution(progress: PitcherGameProgress, random: RandomPort): PitcherGameProgress {
  const pinched = rollOpponentCpuPinchHit(progress, random, false)
  return rollOurPitcherChange(pinched, random)
}
