import { rotationSlotOf, ROTATION_SIZE } from '@/entities/pitcher-career/model/pitcherRotation'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { startingMoundOf, type HalfInningMound } from '@/entities/game/model/simulateHalfInning'
import { type GameAceSetup, NO_GAME_ACES, withAcePitcherOrder, withAcePitcherStamina } from '@/features/play-game/model/gameAces'
import { ALL_PITCHER_SLOTS } from '@/features/play-game/model/gameFlow/types/constants'

/** 리그 경기의 양 팀 투수 차례·칸별 레코드 스태미나 (`startGame` 마지막 인자) */
export interface GamePitcherSetup {
  /** 내 팀 투수 레코드 차례 — 0번이 선발 */
  readonly ourOrder?: readonly number[]
  readonly opponentOrder?: readonly number[]
  /** 붙박이 표 칸(0~7)별 레코드 `+0x2c`. 빠진 칸은 10000 */
  readonly ourStaminas?: readonly number[]
  readonly opponentStaminas?: readonly number[]
}

/** 한 팀의 투수 차례 · 칸별 스태미나 · 선발 마운드 */
export interface SidePitching {
  readonly order: readonly number[]
  readonly staminas: readonly number[]
  readonly starter: number
  readonly mound: HalfInningMound
}

/** 날짜만큼 돈 4인 로테이션 차례 (0xb5ca8 을 g 번 — 0~3 칸은 `(g + i) % 4`, 4번 뒤는 그대로). 첫 시즌 정규시즌에서만 원본과 같다 */
function rotatedRosterOrderOf(dayCounter: number): readonly number[] {
  const first = rotationSlotOf(dayCounter)
  return ALL_PITCHER_SLOTS.map((slot) => (slot < ROTATION_SIZE ? (first + slot) % ROTATION_SIZE : slot))
}

/** 칸별 스태미나 표 — 빠진 칸은 10000 */
function staminaTableOf(given: readonly number[] | undefined): readonly number[] {
  return ALL_PITCHER_SLOTS.map((slot) => given?.[slot] ?? FULL_STAMINA)
}

/** 한 팀 — 리그가 넘긴 차례(없으면 날짜 g 의 4인 로테이션) · 마투수는 저장 레코드째(+0x2c = 10000) 8번 칸에 복사된다 (0xb521c) */
function sidePitchingOf(
  givenOrder: readonly number[] | undefined,
  givenStaminas: readonly number[] | undefined,
  acePitcher: number,
  dayCounter: number,
): SidePitching {
  const order = withAcePitcherOrder(givenOrder ?? rotatedRosterOrderOf(dayCounter), acePitcher)
  const staminas = withAcePitcherStamina(staminaTableOf(givenStaminas), acePitcher)
  const starter = order[0] ?? 0
  // 선발이 막 올라온 마운드 — 레코드 +0x2c 그대로 선다 (부르는 쪽이 리그 표를 안 넘기면 10000)
  return { order, staminas, starter, mound: startingMoundOf(starter, staminas[starter] ?? FULL_STAMINA) }
}

/** 두 팀의 투수 준비 — 내 팀 · 상대 팀 차례로 */
export function gamePitchingOf(
  pitchers: GamePitcherSetup | undefined,
  aces: GameAceSetup | undefined,
  dayCounter: number,
): { readonly ours: SidePitching; readonly opponent: SidePitching } {
  const setup = pitchers ?? {}
  const ourAces = aces?.ours ?? NO_GAME_ACES
  const opponentAces = aces?.opponent ?? NO_GAME_ACES
  return {
    ours: sidePitchingOf(setup.ourOrder, setup.ourStaminas, ourAces.pitcher, dayCounter),
    opponent: sidePitchingOf(setup.opponentOrder, setup.opponentStaminas, opponentAces.pitcher, dayCounter),
  }
}
