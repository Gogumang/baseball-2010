import type { RandomPort } from '@/shared/api/random/randomPort'
import { rollOpponentAceIndex } from '@/entities/game/model/aceOpponent'
import type { GameAceSetup } from '@/features/play-game/model/gameAces'

/** 마선수 번호가 없을 때 — 표 0xd7638[0] = −1 */
export const NO_NARI_ACE = -1

/** 마선수 한 역할의 칸 수 — 저장 +0x30..+0x34 · +0x35..+0x39 */
export const ACE_SLOTS = 5

/** 열린 마선수 로컬 번호 0~4 (전역 저장 +0x30.. 마투수 · +0x35.. 마타자) */
export interface NariOpenedAces {
  readonly pitcherIds: readonly number[]
  readonly batterIds: readonly number[]
}

/** 142 진입이 두 팀에 넣은 마선수 번호 0~4 (없으면 −1) */
export interface NariMatchAces {
  readonly myBatter: number
  readonly myPitcher: number
  readonly opponentPitcher: number
  readonly opponentBatter: number
}

/** `0x9f604` / `0x9f650` — 칸 0..4 를 차례로 보며 열린 것만 쌓고 `bfa55(0, 개수)` 로 하나. 없으면 −1 */
function rollOpenedAce(random: RandomPort, opened: readonly number[]): number {
  const list = Array.from({ length: ACE_SLOTS }, (_unused, slot) => slot).filter((slot) => opened.includes(slot))
  const index = random.rand(0, list.length)
  return list.length === 0 ? NO_NARI_ACE : list[index]
}

/** 진입 0x1c46c 의 굴림 넷 — 내 마타자 → 내 마투수 → 상대 마투수 → 상대 마타자 (1c60c · 1c61a · 1c640 · 1c656) */
export function rollNariMatchAces(random: RandomPort, opened: NariOpenedAces): NariMatchAces {
  const myBatter = rollOpenedAce(random, opened.batterIds)
  const myPitcher = rollOpenedAce(random, opened.pitcherIds)
  const opponentPitcher = rollOpponentAceIndex(myPitcher, random)
  const opponentBatter = rollOpponentAceIndex(myBatter, random)
  return { myBatter, myPitcher, opponentPitcher, opponentBatter }
}

/**
 * 굴린 넷을 경기 팀에 싣는 꼴로 — 1c62e `0xb88c8(내 팀, p)` · `0xb8870(내 팀, b)` · 1c64e `0xb88c8(상대, …)` ·
 * 1c660 `0xb8870(상대, …)`. 마선수는 저장의 나리 팀 레코드(명부)에 들어가 경기 장면이 세우는 팀에 그대로 실린다
 * (`features/play-game/model/gameAces` 머리말). 레벨 배율은 전역 레벨 칸(`mgr[0x13a..]`)을 본다.
 */
export function nariGameAcesOf(aces: NariMatchAces, levels?: Readonly<Record<number, number>>): GameAceSetup {
  return {
    ours: { batter: aces.myBatter, pitcher: aces.myPitcher },
    opponent: { batter: aces.opponentBatter, pitcher: aces.opponentPitcher },
    ...(levels === undefined ? {} : { levels }),
  }
}
