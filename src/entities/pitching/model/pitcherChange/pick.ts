import type { RandomPort } from '@/shared/api/random/randomPort'
import { chooseReplacementPitcher } from '@/entities/pitching/model/pitcherChange/choose'
import { rollsCloser } from '@/entities/pitching/model/pitcherChange/closer'
import type { ReplacementCandidate, ReplacementPickInput } from '@/entities/pitching/model/pitcherChange/types'

/**
 * ac626 되돌이의 안전망 (원본에는 없다). 원본 되돌이가 끝나는지 따져 본 결과(ac44e~ac640 직접 뜬 것):
 * - 되돌이는 모드 3(`[sp+4]`) 에서 고른 투수가 내 선수(0xb6388)일 때만이다. 0xabfcc 는 모드 3 이면 내 선수를 걸러 그 갈래로는
 *   되돌지 않는다 — 되도는 것은 0xac360 이 참이라 고른 "벤치 마지막" 이 내 선수일 때뿐이고, 0xac360 의 확률은 30~60% 라
 *   언젠가 거짓이 되어 0xabfcc(또는 벤치 ≤ 1 의 r4) 로 빠진다.
 * - ac604~ac608 의 "벤치 ≤ 1 이면 r4 그대로" 는 r4 를 0 으로 다시 세우지 않는다(0 은 ac5d6 에서 한 번만). 되돌아온 뒤 이 갈래면
 *   r4 = 앞 회의 내 선수 → 다시 되돌아 **무한 루프**가 될 수 있는 자리지만, 그 길은 벤치 ≤ 1 · 모드 3 · 앞 회가 내 선수여야 하고
 *   벤치 1 명이 내 선수면 ac458 이 처음부터 막는다(0 반환) — 벤치 1 명이 마선수(0xb8a8d 참)면 그가 곧 벤치 마지막이라 내 선수가
 *   아니다. 곧 **원본에서도 닿을 수 없는 무한 루프**다. 그래서 웹은 원본 차례(r4 를 고리 밖에 한 번 0 으로)를 그대로 두고
 *   안전망은 닿지 않는 자리의 보험으로만 남긴다.
 */
const MAXIMUM_REPLACEMENT_PICKS = 1_000

/**
 * 새 투수 고르기 `0xac5d6~0xac640` — 판정(`judgePitcherChange`)이 "바꾼다" 고 한 뒤의 자리.
 *
 * ```
 * ac5d8  0xb8a8d(team, 0) 참 **그리고** 마무리 상황 아님 → 0xac360 굴림
 *            참   → 벤치 **마지막**(벤치 수 − 1)
 *            거짓 → 벤치 ≤ 1 이면 0번, 아니면 0xabfcc
 *        그 밖 → 0xabfcc(…, inn, [sp+4], [sp] = 마무리 플래그)
 * ac622  −1 이면 0 (안 바꿈)
 * ac626  [sp+4] 이고 고른 투수가 0xb6388(내 선수)면 → ac5d8 로 돌아간다
 * ```
 * `0xb8a8d(team, 0)` (b8a8c~b8b00) = **벤치(team+0x33 명)에 마선수(0xb633c)가 하나라도 있나**. 곧 0xac360 은
 * 벤치에 마선수가 있을 때만 굴리고(그때 "벤치 마지막"은 명부 끝에 붙은 마선수 자리다), 마선수가 없는
 * 팀은 **난수 없이** 늘 0xabfcc 로 간다. 후보의 `isSpecialPitcher` 로 이것을 본다.
 *
 * ⚠️ E-defense-rules 4절 3c 가 이 방향을 **거꾸로**("마무리 상황이면 벤치 마지막") 적었던 것을
 * CORRECTIONS 2절이 정정했다 — "E: 새 투수는 … **방향이 반대**". 여기서는 정정 쪽이다.
 */
export function replacementPitcherSlotOf(bench: readonly ReplacementCandidate[], input: ReplacementPickInput, random: RandomPort): number {
  const benchHasSpecialPitcher = bench.some((candidate) => candidate.isSpecialPitcher === true)
  // ac5d6 r4 = 0 — 고리(ac5d8) **밖에서 한 번만** 세운다. 아래 "벤치 ≤ 1" 갈래는 r4 를 건드리지 않는다(ac604~ac608 → ac622)
  let picked = bench[0]?.index ?? -1
  for (let attempt = 0; attempt < MAXIMUM_REPLACEMENT_PICKS; attempt += 1) {
    picked = rollPickedSlot(bench, input, random, picked, benchHasSpecialPitcher)
    if (picked < 0) return -1
    if (input.excludeOwnPlayers === true && isOwnPick(bench, picked)) continue
    return picked
  }
  return -1
}

/** 0xabfcc(…, inn, [sp+4], [sp] = 마무리 플래그) — 다섯째 인자가 마무리 플래그다 (V3-E) */
function chooseFromBench(bench: readonly ReplacementCandidate[], input: ReplacementPickInput): number {
  return chooseReplacementPitcher(bench, {
    inningIndex: input.inningIndex,
    lateInningFlag: input.saveSituation,
    currentStamina: input.currentStamina,
    excludeOwnPlayers: input.excludeOwnPlayers,
  })
}

/**
 * ac5d8 한 번 — 벤치에 마선수가 있고 마무리 상황이 아니면 0xac360 을 굴려 참이면 벤치 마지막, 거짓이면 벤치 ≤ 1 은 r4 그대로
 * (`previous` — 첫 회는 0 = 벤치 0번, 되돌아온 회는 앞 회 값, 위 안전망 주석) · 아니면 0xabfcc. 그 밖은 굴리지 않고 0xabfcc
 */
function rollPickedSlot(
  bench: readonly ReplacementCandidate[],
  input: ReplacementPickInput,
  random: RandomPort,
  previous: number,
  benchHasSpecialPitcher: boolean,
): number {
  if (!benchHasSpecialPitcher || input.saveSituation) return chooseFromBench(bench, input)
  const closer = rollsCloser(
    { inningIndex: input.inningIndex, lead: input.lead, runnerCount: input.runnerCount, bothTeamsAreCpu: input.bothTeamsAreCpu },
    random,
  )
  if (closer) return bench[bench.length - 1]?.index ?? -1
  return bench.length > 1 ? chooseFromBench(bench, input) : previous
}

/** ac626 — 고른 투수가 0xb6388(내 선수)인가 */
function isOwnPick(bench: readonly ReplacementCandidate[], picked: number): boolean {
  return bench.find((candidate) => candidate.index === picked)?.isOwnPlayer === true
}
