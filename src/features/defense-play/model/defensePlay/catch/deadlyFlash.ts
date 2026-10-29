import { isCatchGateOpen } from '@/features/defense-play/model/defensePlay/catch/catchGate'
import { DEADLY_FLASH_BLOCKED_PLAY_KINDS } from '@/features/defense-play/model/defensePlay/constants'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'
import { turnOnDeadlyFlash } from '@/features/defense-play/model/defenseScene'

/**
 * **0d. 필살 포구 연출 켜기** — 슬롯 2 머리 5256c~525dc (관문 G2 52502 가 열리고 판 종류가 마스크 0x58c 밖일 때).
 * 플레이+0x1f7 이면 +0x1994(B), 아니고 +0x1f8 이면 +0x1995(C) — 단계가 −1 이면 0. 켜짐 칸은 앞 그림 플레이 틱의 동작 시작이 세웠다.
 * 5254c — +0x1991(레이저 잔상) && 0xb4c9d(포구 대기 · 동작 시작 틱 − 1 == 공 틱)면 +0x1991 = 0 · 이 그림의 켜기를 건너뛴다(525de).
 * 0xb4c9c = 플레이 vt50(`isCatchGateOpen` — 포구 관문과 같은 다섯 칸) && 공 틱 == +0x176 − 1
 */
export function turnOnDeadlyFlashAtSlotHead(s: DefensePlayState, t: TickFrame): void {
  if (isLaserTrailBeforeCatch(s, t)) {
    s.laserTrailOn = false
    return
  }
  if (!s.play.finished && !DEADLY_FLASH_BLOCKED_PLAY_KINDS.includes(s.play.kind)) {
    s.scene = turnOnDeadlyFlash(s.scene, { jump: s.deadlyJumpArmed, slide: s.deadlySlideArmed })
  }
}

/** 5254c — 레이저 잔상이 켜진 채 포구 동작 시작 바로 앞 틱인가 (0xb4c9d) */
function isLaserTrailBeforeCatch(s: DefensePlayState, t: TickFrame): boolean {
  return s.laserTrailOn && isCatchGateOpen(s) && t.tick === s.play.actionStartTick - 1
}
