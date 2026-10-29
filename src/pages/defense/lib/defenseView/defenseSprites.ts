/** 주자 · 공 보임 · 팔레트 · 번쩍임 · 레이저 · 카메라 · 야수 그림 고르기 */
import type { DefenseFielder, DefenseRunner } from '@/entities/fielding/model/defenseView/defenseFigures'
import type { DefenseBall, DefenseFlash, DefenseViewState } from '@/entities/fielding/model/defenseView/defenseViewState'
import type { WorldPoint } from '@/pages/defense/lib/defenseCamera'
import { RUNNER_ACTION } from '@/shared/config/original/defenseAnimations'
import { TEAM_COUNT } from '@/shared/lib/sprite/paletteSwap'
import {
  ACE_BATTER_DEFENDER_FRAMES,
  ACE_PITCHER_DEFENDER_FRAMES,
  DEFENDER_FRAMES,
  FIELDER_FRAME_OFFSET,
  RUN_STEPS,
  fielderActionFrameOf,
} from '@/pages/defense/lib/defenseView/fielderFrames'

/** 슬라이딩 프레임 표 0xd7818 / 0xd7814 — 어느 쪽이 진루/귀루인지는 미확정(R3 8-1) */
const RUNNER_SLIDE_ADVANCE = [2, 3, 0, 1] as const
const RUNNER_SLIDE_RETURN = [3, 0, 1, 2] as const

/**
 * 주자 동작 → 프레임 (R3 8-1, 주자 vt40 = 0xa0070 의 식 그대로).
 *
 * 주자 전용 그림판은 **없다(확정, S12 4-1)** — 적재 `0x4831e`(야수)·`0x48394`(주자)가 같은
 * `defender.pzx`·`defender.mpl` 을 그림 객체 둘(게임+0xf20 · +0xf24)에 넣는다.
 * 주자 그리기 `0x79d10` 은 vt40 값을 **그대로** 쓰므로 주자 칸은 `defender.pzx` 앞 17장(000~016)이고,
 * 야수 쪽만 +17 이 붙어 017~086 을 쓴다 — 두 구역은 겹치지 않는다.
 */
export function runnerFrameOf(action: number, tick: number, base: number, isAdvancing: boolean): number {
  const step = ((tick % 4) + 4) % 4
  if (action === RUNNER_ACTION.stand) return 0
  if (action === RUNNER_ACTION.run) return [0, 1][((tick % 2) + 2) % 2]
  if (action >= RUNNER_ACTION.run2 && action <= RUNNER_ACTION.run5) {
    return [1, 4, 7, 10][action - RUNNER_ACTION.run2] + RUN_STEPS[step]
  }
  if (action === RUNNER_ACTION.slide) {
    const table = isAdvancing ? RUNNER_SLIDE_ADVANCE : RUNNER_SLIDE_RETURN
    return 13 + table[((base % 4) + 4) % 4]
  }
  return 0
}

/**
 * 0x36dfc 가 공(과 그림자)을 그리는가 — 36e24 재생 틱 > 0 이고, 36e86~36ea4: 홈런 뒤 · 담장 뒤가 아니고 쥔 공(+0x12c)이 아닐 때.
 * 두 번째 비거리 판(37388)은 첫 판(46cb6)과 같은 자리 · 같은 층(그리기 목록 앞)에 다시 칠할 뿐이라 따로 그리지 않는다.
 */
export function isBallDrawn(ball: DefenseBall): boolean {
  return ball.isPlaybackStart !== true && ball.isHeld !== true && ball.isBeyondFence !== true
}

/**
 * 수비수 그림이 쓸 팔레트 번호 — `defender.mpl` 은 **피부가 없어 팀 번호가 곧 벌 번호**다
 * (`palette.json` 의 `select: "팀"`, 15벌 · 적재 0x48658). 몸통처럼 `피부 × 15 + 팀` 을
 * 쓰는 것은 batter/pitcher 뿐이라 여기서는 `outfitPaletteIndex` 를 쓰지 않는다.
 * 팀 번호가 없거나 범위를 벗어나면 null — 구운 벌(2번)을 그대로 쓴다.
 */
export function defenderPaletteIndexOf(teamIndex: number | null | undefined): number | null {
  if (teamIndex == null || !Number.isInteger(teamIndex)) return null
  if (teamIndex < 0 || teamIndex >= TEAM_COUNT) return null
  return teamIndex
}

/** 번쩍임을 기준점에서 얼마나 옮겨 그리나 (R2 2절 표) */
export function flashOffsetOf(flash: DefenseFlash): { readonly x: number; readonly y: number } {
  if (flash.kind === 'b') return { x: 0, y: -50 }
  switch (flash.direction) {
    case 0xf:
      return { x: 0, y: 10 }
    case 0x10:
      return { x: 0, y: -10 }
    case 0x11:
      return { x: -10, y: 0 }
    case 0x12:
      return { x: 10, y: 0 }
    default:
      return { x: 0, y: 0 }
  }
}

/**
 * 레이저 송구 **반짝임**(경기+0x19ad)을 칠하는 색 — `0x1400748` = RGB(255,0,0) (I-controls 1c 끝).
 * `deadly_effect` 번쩍임(B·C)과는 **다른 표시**다. 그쪽은 공 자리에 그림을 겹치고,
 * 이쪽은 **공을 쥔 야수의 몸**을 빨갛게 그린다.
 */
export const LASER_SHINE_COLOR = { r: 255, g: 0, b: 0 } as const
/**
 * 그 야수를 그릴 때 쓰는 그리기 효과 번호 — `0x79b48` 에 넘기는 **12** (I-controls 1c 끝 0x43406~0x4342c).
 * 0xbb91d 의 종류가 아니라 프레임 그리기 효과 번호다(0x79b48 → 0xbe8d5 → 0xbe810). 효과 0xc 의 픽셀 함수
 * 0x98351 · 0x9af71 은 그림 픽셀과 인자 색을 565 채널마다 반반 섞는다 — 식과 그리기는 `lib/laserShine`.
 */
export const LASER_SHINE_EFFECT_KIND = 12

/**
 * 카메라가 볼 점 (0x3f060 — 3f0f0~3f1be, 직접 뜸).
 * ```
 * 3f0f0  P = [장면+0x200] ; P+0x111(홈런) || P+0x129(폴 홈런) 이 아니면 → 3f194
 * 3f106  [장면+0x204](공).vt18()(멈춤) 거짓이면 → 3f194
 * 3f11c  주자 = 0xa9564([장면+0x20c], 0)(목록 0번 = 타자주자) ; 대상 = (주자+0x20 x, 주자+0x28 z)   ; 높이를 안 뺀다
 * 3f194  공 점 0xa25d4(공) ; 대상 = (x, z − y)
 * 3f1c0  카메라 vt20(대상) · vt28(따라가기)
 * ```
 * 곧 **홈런 · 폴 홈런 판에서 공이 멈췄을 때만** 타자주자를 보고, 그 밖은 늘 공 (x, z − 높이) 다 —
 * 보통 타구는 공이 멈춰도(포구 · 송구가 끝나도) 공을 본다.
 */
export function cameraTargetOf(state: DefenseViewState): WorldPoint {
  if (state.cameraTarget != null) return state.cameraTarget
  if ((state.homeRunFlag === true || state.poleHomeRunFlag === true) && state.ball.isStopped === true) {
    const batterRunner = state.runners.find((runner) => runner.index === 0)
    if (batterRunner !== undefined) return { x: batterRunner.x, z: batterRunner.z }
  }
  return { x: state.ball.x, z: state.ball.z - state.ball.height }
}

/**
 * 주자 한 명을 그릴 그림판 (0x79d10) — 마선수 주자(+0x9c ≠ −1)는 실린 마선수 그림(팔레트 없음), 아니면 `defender.pzx`.
 * 마선수 주자인데 실린 그림이 없으면(웹에서만 나는 경우) 보통 그림으로 둔다.
 */
export function runnerSpriteFolderOf(
  runner: DefenseRunner,
  loadedAce: number | null | undefined,
): {
  readonly folder: string
  readonly isAce: boolean
} {
  if (runner.isAce === true && loadedAce != null && loadedAce >= 0 && loadedAce <= 4) {
    return { folder: ACE_BATTER_DEFENDER_FRAMES[loadedAce], isAce: true }
  }
  return { folder: DEFENDER_FRAMES, isAce: false }
}

/** 야수 한 명을 그릴 그림판과 프레임 (0x79b48 의 a 갈래 + 프레임 +17) */
export interface FielderSprite {
  readonly folder: string
  readonly frame: number
}

/**
 * 야수가 쓸 그림판과 프레임 (R3 7-3 의 a 갈래 · S12 8-2).
 *
 * | 그림 | 프레임 |
 * |---|---|
 * | 보통 `defender` · 타자 마선수 (125장) | 날값 **+17** (야수 칸 017~086) |
 * | 투수 마선수 (38장, `a != 0`) | 날값 그대로 (0~37) |
 */
export function fielderSpriteOf(fielder: DefenseFielder): FielderSprite {
  const raw = fielderActionFrameOf(fielder.action, fielder.actionTick)
  const ace = fielder.aceIndex
  if (ace == null || ace < 0 || ace > 4) {
    return { folder: DEFENDER_FRAMES, frame: raw + FIELDER_FRAME_OFFSET }
  }
  if (fielder.slot === 0) return { folder: ACE_PITCHER_DEFENDER_FRAMES[ace], frame: raw }
  return { folder: ACE_BATTER_DEFENDER_FRAMES[ace], frame: raw + FIELDER_FRAME_OFFSET }
}
