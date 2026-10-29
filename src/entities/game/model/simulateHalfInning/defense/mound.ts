import { FULL_STAMINA } from '@/entities/game/model/simulateHalfInning/otherSlices'
import type { HalfInningDefense, HalfInningMound } from '@/entities/game/model/simulateHalfInning/types/defense'

/** 선발이 막 올라온 마운드 — 스태미나는 가득이다 (시즌 시작 0xb6cc4 가 10000) */
export function startingMoundOf(pitcherSlot: number, stamina: number = FULL_STAMINA): HalfInningMound {
  return {
    pitcherSlot,
    stamina,
    runsAllowed: 0,
    pitches: 0,
    usedSlots: [],
    justChanged: false,
  }
}

/**
 * 교체 0xaec64 는 카운터(+0x27c·+0x280·+0x284)를 한꺼번에 0 으로 민다.
 * 올라온 투수의 스태미나는 **제 레코드 값**(+0x2c)이다 — 교체 실행 0xaebe4 에 +0x2c 쓰기가 없다.
 * 나리 타자편(`gameFlow`) · 투수편(`pitcherGameFlow`) · CPU 리그 경기(`leagueDay`)는 리그 표의 칸별 값을 `staminaAt` 으로 넘긴다 —
 * 원본 레코드 +0x2c 는 경기 사이에 이어지고 하루 끝 `0xb617c` 가 +20% 회복한다.
 * ⚠️ 부르는 쪽이 `staminaAt` 을 안 넘기면(투수별 스태미나를 안 드는 길) 가득으로 본다.
 * `state[0xd]` 는 0xac428 끝(ac652)이 1 로 세운다.
 */
export function moundAfterChange(defense: HalfInningDefense, mound: HalfInningMound, next: number): HalfInningMound {
  return {
    pitcherSlot: next,
    stamina: defense.staminaAt?.(next) ?? FULL_STAMINA,
    runsAllowed: 0,
    pitches: 0,
    usedSlots: [...mound.usedSlots, mound.pitcherSlot],
    justChanged: true,
  }
}
