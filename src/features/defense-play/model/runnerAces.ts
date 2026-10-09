import type { BaseState } from '@/entities/game/model/baseState'

/**
 * 주자 마선수 그림 (그리기 0x43aa8 · 주자 그림 0x79d10 · 적재 0x483a0~0x48400, 직접 뜬 것).
 *
 * 주자 그리기 0x43a0c 는 주자 +0x9c(만들 때 0xa94ca 가 적는 선수 0xb63a0 마선수 번호, 아니면 −1)가 −1 이 아니면
 * 0x79d10(주자 그림판 [+0xf24], **참**, 그림 = vt40 날값, …)을 부른다. 0x79d10 은 참이면 그림판 +0x1c(팔레트 없음),
 * 아니면 +0xc(팀 팔레트 +0x10)로 그린다. +0x1c 에 그림을 싣는 곳은 타석 교대 적재 0x47cc8 의 한 자리뿐이다:
 * ```
 * 483a0  지금 타자가 마선수(0xb633d)면 0x79cbd([+0xf24], 0xb63a1(타자))
 * 483c0  아니면 i = 0 .. 주자 수 − 1 : 주자[i]+0x9c ≠ −1 이면 0x79cbd([+0xf24], 주자[i]+0x9c)   ; 덮어쓴다
 * 79cbc  +0x24 = 번호 ; 번호 ≤ 4 면 +0x1c = 표 0xd3f0c[번호](20바이트 간격 — defender_medica … tiger)
 * ```
 * 주자 목록은 0 번이 가장 최근 주자 · 끝 칸이 가장 앞선 주자라(0xa93ac) 끝까지 덮어쓰면 **가장 앞선 마선수 주자**가 남는다.
 * ⚠️ **원본 그대로**: 그림은 장면에 하나뿐이라 마선수 주자가 둘이면(또는 타자와 루 위 주자가 다른 마선수면) 모두
 * 실린 하나의 그림으로 그린다. 고치지 않는다.
 */
export interface RunnerAces {
  /** 이 타석 타자의 마선수 번호(타자 마선수 0~4), 아니면 null */
  readonly batter?: number | null
  readonly first?: number | null
  readonly second?: number | null
  readonly third?: number | null
}

function aceOf(value: number | null | undefined): number | null {
  if (value == null || !Number.isInteger(value) || value < 0 || value > 4) return null
  return value
}

/** 진행기 주자 칸(0 = 타자주자, 그 뒤 찬 루 오름차순 — `runnersFromBases`) → 마선수 번호 */
export function runnerAceIndexesOf(aces: RunnerAces | undefined, bases: BaseState): (number | null)[] {
  const list = [aceOf(aces?.batter)]
  if (bases.first) list.push(aceOf(aces?.first))
  if (bases.second) list.push(aceOf(aces?.second))
  if (bases.third) list.push(aceOf(aces?.third))
  return list
}

/** 타석 교대 0x483a0 이 실어 둔 주자 마선수 그림 번호 — 없으면 null */
export function loadedRunnerAceOf(aces: RunnerAces | undefined, bases: BaseState): number | null {
  const batter = aceOf(aces?.batter)
  if (batter !== null) return batter
  let loaded: number | null = null
  // 목록 차례 = 뒤 주자 → 앞선 주자 (1 → 2 → 3루), 덮어쓴다
  if (bases.first && aceOf(aces?.first) !== null) loaded = aceOf(aces?.first)
  if (bases.second && aceOf(aces?.second) !== null) loaded = aceOf(aces?.second)
  if (bases.third && aceOf(aces?.third) !== null) loaded = aceOf(aces?.third)
  return loaded
}
