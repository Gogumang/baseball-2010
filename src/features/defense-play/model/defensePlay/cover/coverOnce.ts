import { basePosition } from '@/entities/fielding/model/fieldGeometry'
import { runCoverTick } from '@/features/defense-play/model/coverTick'
import { contextAt } from '@/features/defense-play/model/defensePlay/step/defenseContext'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'

/**
 * **플레이 vt30 = 0xb1c90 한 번** (`coverTick.runCoverTick`) — vt4c 끝 b4c72(1d 절, 매 틱) · 송구 0xb2e38 꼬리 b3094(예보 vt24(0) ·
 * 고르기 vt34 뒤) · 다시 쏘기 0xb3148 꼬리 b32b0(예보 vt24(1) · 고르기 vt34 뒤). 꼬리 둘은 판 종류(마스크 0x58c)를 안 본다.
 * 머리 관문: (+0x111 || +0x129) && 공+0x68 > 공+0xaa4 · state[7] == 0
 */
export function runCoverOnce(s: DefensePlayState, t: TickFrame): void {
  const covered = runCoverTick({
    context: contextAt(s, t.tick),
    ballToFirstSide: s.catchPoint.x > basePosition(0).x,
    // b1ddc 공.vt68(0) — **지금** 공 궤적의 첫 점: 타구는 0xd8758, 송구 · 다시 쏘기(0xb3148)는 새로 깐 궤적의 첫 점(r162)
    ballStartPoint: s.ballSegmentStart,
    relayFlag: s.relayFlag,
    gateClosed: !s.wideFair || ((s.homeRunFlag || s.play.suppressed) && t.tick - s.ballLaunchTick > s.trajectory.fenceTick),
    foulFlag: s.foulFlag,
  })
  s.play = covered.play
  s.fielders = covered.fielders
  s.relayFlag = covered.relayFlag
}
