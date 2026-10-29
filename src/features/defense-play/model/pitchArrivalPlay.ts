/**
 * **투구 하나에 붙는 주자 판** — 사람 경기에서 공이 날아가는 동안(상태 0x11) 출발한 도루와, 공이 도착한
 * 순간(상태 0x12 진입 `0x3dfac`) 여는 폭투·포일(종류 9)·도루(종류 5) 판을 한 줄로 잇는다.
 * 진행기(타자편·팀 경기·투수편·미션)가 같은 차례로 부르도록 모아 둔 것이다.
 *
 * ## 출발 — 상태 0x11 (메시지 0x583 → `0xa9bd4`)
 * - 사람 공격: 키 '3' → 1루 · '2' → 2루 · '1' → 3루 주자 (`0x53610`). `canStartSteal` 이 받으면 `stealingFrom` 에 넣는다.
 *   **난수 없음** (`startHumanSteal`).
 * - CPU 공격(사람 수비): `0x537dc` 가 상태 0x11 의 10번째 틱에 메시지 0x583(−1) → `0x520de` 가 루를 고른다.
 *   같은 상태의 11번째 틱이 CPU 타자 결정 `0x34334` 다 — 곧 **타자 결정 굴림 바로 앞**에서 후보가 있을 때만
 *   `rand(0,1000)` 한 번 (`rollCpuStealStart`). 이어서 `canStartSteal`(0xa9bd4).
 *
 * ## 공 도착 — `0x3dfac` (못 맞힌 투구만: 볼 · 스트라이크(헛스윙 포함) · 사구)
 * ```
 * 0x3e038  r = 0x35034                 ; rollPassedBall — 모드 7 빼고 매 투구 rand(0,10000) 한 번
 * 0x3e05a  v = 0x9d57c                 ; 투구 판정 (1 스트라이크 · 2 볼 · 3 볼넷 · 4 사구 · 5 삼진)
 * 0x3e062  r && v ≠ 3·4 → 0x3507c(rand 두 번) · 종류 9 ; v == 5 면 낫아웃 갈래 (passedBallStrikeoutOf)
 * 0x3e0e4  아니고 도루 중 && !(아웃 > 1 && v == 5) → 종류 5
 * 0x3e11a  switch [scene+0x10ac](v) — 표 0xcffb4 (직접 뜬 것, 판 종류를 정한 **뒤** 같은 진입에서 곧장 돈다)
 *          1 → 0x3e134 state[4](스트라이크)++ · 2 → 0x3e156 state[5](볼)++
 *          3 → 0x3e1ae state[5]++ 뒤 4 와 같이 · 4 → 0x3e1b4 0xaf020 · **0xb0cb8(플레이, 2)** ; 종류를 2(밀어내기)로 덮어쓴다
 *          5 → 0x3e15e 삼진 기록 칸 · **state[6](아웃)++**  · 그 밖(0 = 낫아웃이 지운 칸) → 건너뜀
 * 0x3e1d4  v ≠ 0 이면 state[0xc] = v · 메시지 0xbba(v) ; 0x3e1f4 0xa5fdc (연속 파울 지우기)
 * ```
 * 맞힌 공(파울·인플레이)은 `0x3dfac` 가 아니라 타격 갈래로 가서 이 굴림이 없다.
 *
 * ## 판정 칸은 판 **앞**에서 먹는다 — 판 뒤에 `[scene+0x10ac]` 를 읽는 자리는 없다
 * `0x10ac` 상수를 읽는 곳은 5곳뿐이다(xval): 0x35108 · 0x39504(그림) · 0x3dfac(여기 둘) · 0x46844(수비 화면) ·
 * 0x51408(판 끝 메시지가 **판정 결과로 덮어쓴다**). 판 끝 판정 B 0xae3e8 은 v 를 안 읽고 state[0xc] 만 본다:
 * 종류 4·5 → state[0xc] == 5 && 종류 5 면 0xd(새 타석) 아니면 0xf · 종류 9 → state[0xc] == 5 면 0xd 아니면 0xf(정산 0xa8024
 * 건너뜀) · 아웃 > 2 → 0x18. 그래서:
 * - **볼넷·사구**: 0x3e0e4 가 종류 5 를 세웠든 9 굴림(v ≠ 3·4 라 안 선다)이든 스위치 0x3e1cc 가 종류 2(밀어내기 판)로 덮어쓴다
 *   — 판정 A 0xae24c 가 그 판(상태 0x17)으로 보낸다(`walkPlay`). 출발한 주자는 그 판에서 리드(0x3d7b8 — 종류 2 의 도루 주자는
 *   틱 0)를 타고, 밀리지 않으면 제 루로 돌아간다(0x46664).
 * - **삼진 + 도루(1아웃 이하)**: 삼진 아웃이 판 앞에서 붙어 판은 **아웃 + 1** 로 열린다(`playOutsOf`). 판에서 셋째 아웃이 나도
 *   삼진은 그대로다(이미 센 아웃). 종류 9 에서 삼진이 선(1루 주자 && 아웃 ≤ 1) 판도 같다. 낫아웃은 판정 칸을 0 으로 지워 아웃이 없다.
 * - **볼·스트라이크 + 판에서 3아웃**: 카운트는 이미 올랐고 판정 B 가 0x18(공수 교대)로 보낸다 — 그 타석은 끊긴다.
 *
 * ## 판 뒤
 * - 진루·아웃·득점은 `result.advance` (판 안의 자동 진루 0xaf918 까지 다 돈 값, 아웃은 판을 연 아웃 수에 더할 값).
 * - 콜: 도루 판 `stealCallSoundIdOf` · 폭투 판 `passedBallCallSoundIdOf`.
 * - 기록: 도루 판만 정산 0xa8024 @a83c6·@a83de(state[0x26] == 5) → `stealPlayRecordIdsOf` (8 도루 · 24 도루 저지).
 *   0xa77f0 게이트(8 은 사람 공격 · 24 는 사람 수비)는 부르는 쪽이 건다.
 * - `PitchArrivalPlayInput.outs` 는 **이 투구 전의 아웃 수**(종류 고르기 0x3e0ee 가 읽는 값)다. 부르는 쪽은 판의 advance 를
 *   이 아웃 수 위에 주자 판으로 먼저 먹이고, 타석이 끝났으면(삼진) 그 뒤 보통 길로 삼진 아웃을 더한다 — 판을 연 아웃 수
 *   (투구 전 + 1)에 판 아웃을 더한 것과 합이 같다. 판 아웃은 셋째 아웃에서 멈추므로 이 순서로 3아웃을 넘지 않는다.
 * - 밀어내기 판(종류 2)은 `walkPlay` 가 돈다 — 난수가 없고 진루 결과는 보통 길(밀어내기)과 같아, 부르는 쪽은 경기 상태를
 *   보통 길로 먹이고 이 판은 재생 칸에만 넣는다(`arrivalApplicationOf` 가 `'freePass'`). 사구 벤치 클리어링(0x1e)이 서면 그 뒤에 재생한다.
 */
export { arrivesUnhit, clearsPitchJudgement, PITCH_JUDGEMENT, pitchJudgementOf } from '@/features/defense-play/model/pitchArrival/pitchJudgement'
export { rollCpuStealStart, startHumanSteal, stealBaseOfKey, stealStartSceneOf } from '@/features/defense-play/model/pitchArrival/stealStartKeys'
export type { OpenedPitchArrivalPlay, PitchArrivalPlay, PitchArrivalPlayInput } from '@/features/defense-play/model/pitchArrival/pitchArrivalTypes'
export {
  finishPitchArrivalPlay,
  openPitchArrivalPlay,
  runOpenedPitchArrivalPlay,
  runPitchArrivalPlay,
} from '@/features/defense-play/model/pitchArrival/openPitchArrival'
export { arrivalApplicationOf, stealRecordIdsOf } from '@/features/defense-play/model/pitchArrival/arrivalRecords'
