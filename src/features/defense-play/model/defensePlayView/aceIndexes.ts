import { isBugFixed } from '@/shared/config/bugfixes'

/**
 * 타자 마선수 그림을 **팀당 첫 한 명으로 뭉갠다** — 원본 버그 그대로다 (R3 7-3).
 *
 * 원본 적재(0x3a680~0x3a716)는 팀 선수 목록에서 `+0xa & 0x40` 인 **첫 선수** 하나로만
 * `0x79a5c(obj, 번호)` 를 부르고, 그리는 쪽 `0x79b48` 의 b 갈래는 "그 칸 선수가 마선수인가" 만
 * 본다. 그래서 한 팀에 타자 마선수가 둘 이상이면 **둘째부터도 첫째의 그림**으로 나온다.
 *
 * 칸 0(투수)은 따로 적재되는 그림(`0x79ab0`, 표 0xd4008)이라 **건드리지 않는다** —
 * a 갈래가 b 갈래보다 먼저다.
 *
 * `viewStateOf` 는 이것을 **자동으로 해 주지 않는다**(진행기는 받은 표를 그대로 넘긴다).
 * 버그를 되살리려면 표를 만드는 쪽이 이 함수를 통과시켜야 한다.
 *
 * **고침(bugfixes.json B-83, 기본 켬)**: 뭉개지 않고 칸마다 제 마선수 그림 — 표를 그대로 돌려준다. 굴림 없음(그림만).
 */
export function aceIndexesWithOriginalBug(
  aces: readonly (number | null | undefined)[] | undefined,
): readonly (number | null | undefined)[] | undefined {
  if (aces === undefined) return undefined
  if (isBugFixed('B-83')) return aces
  const first = firstBatterAceOf(aces)
  if (first === null) return aces
  return aces.map((ace, slot) => (slot === 0 || aceIndexOf(aces, slot) === null ? ace : first))
}

/** 칸 1 부터 훑어 첫 타자 마선수를 찾는다 (칸 0 은 투수 마선수라 셈에서 뺀다) */
function firstBatterAceOf(aces: readonly (number | null | undefined)[]): number | null {
  for (let slot = 1; slot < aces.length; slot += 1) {
    const ace = aceIndexOf(aces, slot)
    if (ace !== null) return ace
  }
  return null
}

/** 수비 칸 → 마선수 번호. 표에 없거나 0~4 밖이면 보통 수비수 그림이다 */
export function aceIndexOf(aces: readonly (number | null | undefined)[] | undefined, slot: number): number | null {
  const ace = aces?.[slot]
  if (ace == null || !Number.isInteger(ace) || ace < 0 || ace > 4) return null
  return ace
}
