import { BASE_DEFAULT_FIELDER } from '@/entities/fielding/model/fieldGeometry'
import { AI_STATE, NONE } from '@/entities/fielding/model/fieldingState'
import { coverStatesOf } from '@/entities/fielding/model/coverAssignment/assign/coverStates'
import type { CoverDraft } from '@/entities/fielding/model/coverAssignment/assign/draft'
import { claimHolderTargetBase, handOffHolderBase } from '@/entities/fielding/model/coverAssignment/assign/holderBase'
import { reclaimDefaultCovers } from '@/entities/fielding/model/coverAssignment/assign/reclaim'
import { chooseKeystone } from '@/entities/fielding/model/coverAssignment/assign/secondBase'
import type { CoverAssignment, CoverAssignmentInput } from '@/entities/fielding/model/coverAssignment/types'

/**
 * **루 커버 매 틱 다시 고르기** — 플레이 vt30 = `0xb1c90` 의 커버 부분 (직접 뜬 것).
 *
 * `0xb1c90` 은 매 틱(그리고 송구 0xb2e38 끝 b3094 에서) 돈다. 2루 커버가 아닌 키스톤 야수의 자리 잡기(0xb203a)는
 * `throwArrival.secondBaseHelperPlacement` 이고, 여기는 그 앞뒤의 커버(+0xf0) 정하기다.
 * ```
 * b1c96  어느 야수든 AI 8 이면 끝(이번 틱 +0xf0 은 지난 틱 그대로)
 * b1cd6  +0xf0[0..3] = 표 0xd8774 = [1, 2, 3, 4]
 * b1d0a  H = 공 가진 야수(+0x130) ; k = 0xb1268(H 목표점) = 목표점이 루 k 좌표(0xd86b0)와 같은 k
 * b1d1a  k ≠ −1 && k == +0x130 − 1 && H AI ∉ {1, 9} → 투수 AI 0          ; 제 루에 선 기본 야수 — 넘기기 없음
 * b1d48  아니면 +0x130 == 1 → +0xf0[0] = 0 (투수) · 2 → +0xf0[1] = 0 · 4 → +0xf0[3] = 0
 *          그리고 0xb1b88(그 루) 가 거짓이면 그 칸 = −1
 * b1d96  막힘 = 2루수 AI == 1 || (유격수 AI == 1 && !H.vtcc())
 * b1dca  !0xb1b88(2) → b1e12 규칙(b1dd4 `beq`) · 막힘 → b1e12 규칙(b1dd8 `bne`) — 둘 다 아니면(커버가 필요하고 안 막힘)
 *        공.vt68(0)(공 첫 점) == 0xd8758(20000,1000,30000) 이면(0xbc0f4 = 세 좌표 같으면 1) b1e12 규칙,
 *        아니면 b1e86: 2루(0xd86c8)까지 거리가 먼 쪽이 돕는다 — 2루수가 멀면 (커버 5, 도움 3), 아니면 (3, 5)
 *        (r162 정정: 예전 웹은 "필요 && !막힘 → 규칙" 으로 거꾸로 읽었다. 타구 판은 공 첫 점이 늘 0xd8758 이라 차이가 없었다)
 * b1e12  +0x130 == 3 → (커버 5, 도움 3) · == 5 → (3, 5) · 아니면 공 각 + 90 > 0 ? (5, 3) : (3, 5)
 * b1e66    도움 야수의 발밑 루(vt58 = 0xa0ae4)가 2 면 둘을 맞바꾼다
 * b1f06  +0xf0[2] = 커버 ; +0x138 = 도움 → (0xb203a 자리 잡기)
 * b23a4  b = H.vt68()(목표점이 루 b) ≠ −1 && H AI ≠ 9 → +0xf0[b] = H
 * b23dc  루 j 마다 c = +0xf0[j] ≠ −1, d = 0xd8774[j]:
 *          c == d → 투수.vt68() == j 일 때만 대신 S = 투수 · +0xf0[j] = 0, 아니면 다음 루
 *          c ≠ d → S = c
 *          S.vt18()(목표점에 있음) && d AI == 0 이고, 주자 하나라도 "d 가 먼저 닿는다"(아래)면
 *          S AI ≠ 8 이면 S AI 0 · +0xf0[j] = d
 * b2440  주자 R 마다: nb = 0xb6228(R) = R+0x8c ≤ 3 ? R+0x8c + 1 : R+0x8c
 *          nb == j: R 아웃이면 건너뜀 ; R.vt18() 면 R.vt1c(루 j 좌표) > d.vtc0() · 아니면 0xbefec(R) > d.vtc0()
 *          nb ≠ j: R+0x7c == (j + 3) & 3 이면 R.vta0() > d.vtc0()
 * b2564  루 j 마다 c = +0xf0[j] ≠ −1 이고 c AI ∉ {8, 1, 9} 이고 +0x110 == 0 이면 c.vt14(루 j 좌표) · AI j + 2
 * ```
 * 0xb1b88(P, b) "그 루에 커버가 필요한가" (직접 뜬 것):
 * ```
 * b1b9e  state[7] == 0 → 0 ; 어느 야수든 AI 8 → 1
 * b1bae  주자 R 마다 +0x94 && +0x88 == b && 아웃 아님 → 1
 * b1bde  타자주자(목록 0)가 살아 있고 P+0x168 ∈ {6,7,8} ∪ {12,13,14} → 1
 * b1c0a  r = b == 0 ? 4 : b ; 루 r 의 주자(0xa97a0: 아웃 아닌 +0x8c == r 첫 주자)가 있으면 1
 *        아니면 루 r−1 의 주자가 있으면 1 · 아니면 루 r−2 의 주자가 있고 그 +0x7c == r−1 이면 1 · 그 밖 0
 * ```
 * 남은 것 (지어내지 않고 둔 것):
 * - P+0x168 을 쓰는 곳이 바이너리에 없다(2026-10 r87 다시 훑음) — 읽는 곳은 b1b8a 하나다. 플레이 객체를 만드는 new(0x1fc)
 *   (0x3e756 → 0x1238 → 0x2ac4)는 0x28b8 로 받은 칸을 `memset(p, 0, 크기)`(0x2ad4 → 0x1400428)로 지우므로 늘 0 이다.
 *   상수 훑기(movs/lsls/adds · 리터럴 풀 · `adds rX, #i` + `[rX, #o]` · Thumb-2 `#0x168]`)로 플레이 쪽(0xa0000~0xb8000)
 *   에서 +0x168 에 쓰는 자리를 찾지 못했고, 플레이 객체(new(0x1fc) 0x3e756, 생성자 0xb0b68)도 이 칸을 안 적는다.
 *   그래서 갈래는 그대로 옮기되(`batterRunnerNeedsCover`) 칸 값은 생성 때 값 0 으로 둔다 → 안 선다.
 *   타자주자는 +0x8c == 0 이라 루 1 은 "루 r−1 의 주자" 로 어차피 선다
 * - 머리 관문 state[7] · 홈런(+0x111 · +0x129 && 공 틱 > 담장 틱, b1ca2)은 `coverTick.runCoverTick` 의 `gateClosed` 로 본다(r164).
 *   +0x110 은 b1c90 머리 관문이 아니다(b2564 줄의 +0x110 == 0 만 — 아래)
 * - b1d96 의 H.vtcc()(0xa2138 = +0xb0 워드 == 0 && +0xb4 ≤ 0 && +0xcc ≤ 0, 직접 뜬 것)는 `fielderPose.isFreeToRetarget` 로 다 본다(r171).
 *   vt30 은 AI 고리 vt4c 0xb45dc 끝(b4c72)이라 이 틱 머리 야수 틱이 줄이고 지운 값이다. 워드를 세우는 곳은 포구 동작 시작 b4134~b419c
 *   (표 0xd87f4 — 모든 포구 종류) · 뜬공 기다리기 vt9c(b4130) · 던지기(+0xb1)이고, 지우는 규칙은 야수 틱 a137a~a1456 이다
 *   (`fielderPose` 머리말). 곧 공 쫓는 유격수가 포구 동작을 시작한(또는 뜬공 밑에서 기다리는) 동안 2루가 막힌다.
 *   정정(r171): 예전 주석의 "vtc8 이 참이면 지운다"는 거꾸로다 — a1412 `bl vtc8` · a141a `beq a143e` 라 **거짓**(+0xb1 · +0xcc)일 때
 *   지운다(U-78 에뮬 확인과 같다). 가슴 높이 포구(7)의 +0xb0 은 프레임 5 까지 남는다
 * - +0x94 는 웹의 `requiredBase ≠ −1` 로 읽는다(0xa95e8 · 0xa9620 이 둘을 함께 세우고 지운다)
 */
export function assignCoversForTick(input: CoverAssignmentInput): CoverAssignment {
  const { play, fielders, runners } = input.context
  // b1c96 — 어느 야수든 AI 8 이면 끝(이번 틱 +0xf0 은 지난 틱 그대로)
  if (fielders.some((fielder) => fielder.aiState === AI_STATE.RUNDOWN)) {
    return { ran: false, covers: play.coverOfBase, secondBaseHelper: NONE, secondBaseCover: NONE, idleSlots: [], coverStates: [], fielders }
  }
  const draft: CoverDraft = { covers: [...BASE_DEFAULT_FIELDER], idleSlots: [], working: fielders }
  const holder = fielders[play.ballHolderSlot]
  handOffHolderBase(draft, input.context, holder)
  const { cover, helper } = chooseKeystone(input, holder)
  draft.covers[2] = cover
  // b1f06 → 0xb203a: 2루 커버가 아닌 키스톤 야수의 자리 잡기 (b23a4 앞 — 공 가진 야수가 도움 야수면 그 목표점도 바뀐다)
  if (input.placeHelper !== undefined) draft.working = input.placeHelper(draft.working, cover)
  claimHolderTargetBase(draft, play.ballHolderSlot)
  reclaimDefaultCovers(draft, runners)
  const coverStates = coverStatesOf(draft.covers, draft.working, input.foulFlag)
  return {
    ran: true,
    covers: draft.covers,
    secondBaseHelper: helper,
    secondBaseCover: cover,
    idleSlots: draft.idleSlots,
    coverStates,
    fielders: draft.working,
  }
}
