import { listTickFielder } from '@/entities/fielding/model/fielderPose'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'
import { tickMarkCounter } from '@/features/defense-play/model/playerEffects'

// ── 0'. 야수 틱 0xa1284 의 준비 틱 줄이기 (직접 뜬 것) ──
// ```
// 52c50: 장면 갱신 — 52e16 공용 갱신 0x3f060 → (상태 0x17 이면) 52e94 0x524c0(슬롯 2: 플레이 틱 · 자동 진루 · CPU 송구)
// 3f0d2: 0x3f060 은 플레이가 돌고 상태 0x17 이면 장면+0x1e4 객체 목록.vt8 = 원소마다 vt0xc — 야수 9명(3e660, new(0xf4)
//        + 0xa0e08)·주자가 이 목록에 들어 있다(0xc0104)
// a1312: 야수 vt0xc = 0xa1284: (+0xb4 동작 잠금이 0 일 때) +0xc8 > 0 && +0xe0(공 쥠) 이면 +0xc8 −= 1 (0 아래로 안 감)
// ```
// 곧 **야수 틱이 플레이 틱보다 먼저** 돈다 — 포구 틱에 쥐기(0xb2710)가 넣은 준비 틱 R 은 다음 틱부터 줄어
// 포구 R 틱 뒤에 0 이 된다. 쥔 동안만 줄고, +0xc8 을 넣는 곳은 쥐기(vt88, b27aa·b27be)뿐이다.
// a12b4: 동작 잠금 +0xb4 > 0 이면 −1 만 하고(0 이 되면 a12c8 +0xbd = 1 · vt10) a12c6/a12d6 에서 끝 — 그 틱은 +0xb8 · +0xc0 ·
// +0xc8 · +0xcc 줄이기도 이동(a1376 0xbf094)도 없다. 이동을 막는 쪽은 6 절이 그때의 +0xb4 로 본다(그 걸음은 다음 야수 틱 몫)
// a12c8 의 vt10(0xa124c: 0xbf2b0 목표 = 위치 · +0xa8 · +0xb0~+0xb3 · +0xbc · +0xb4 · +0xe8 = 0) — r176 부터 목표 = 위치도 옮긴다
// (`fielderPose.withPoseCleared`). 아래 r158 의 "다시 세운다" 는 AI 가 목표를 고치는 칸에서만 맞다 — 쥔 AI 1 야수(b4ae6)는 안 고쳐
// 포구 동작을 지운 vt10 에서 선다(쥐기가 야수를 옮기지 않게 되며 드러났다). r158 기록: 같은 틱 슬롯 2 0x524c0 의 차례가 vt48 0xb401c(525e8) → vt18(525fc) → vt4c AI 고리 0xb45dc(52612) → 그 끝 vt30 0xb1c90(b4c72)라,
// 다음 야수 틱 걸음 전에 AI 가 목표를 다시 세운다 — AI 0 b476a(vtcc 면 목표 ≠ 시작 자리 → vt50) · 1 b4aca(0xa100c 포구점) ·
// 2~5 b47f2 → b482c vt14(루) · 0xb b4b5c vt14(+0x90) · 키스톤 자리 b203a vt14. 맞은 야수는 다시 쏘기의 고르기(b3b38 머리 b3b7a)가
// AI 1 → 0 으로 내려 이 밖의 상태(6 · 7 · 9 · 0xd · 0xe — 목표를 안 고치는 칸)에 있을 수 없고, 웹 6 절은 AI 상태로 목표를 다시
// 고르므로 걸음이 같다. 그 사이 목표를 읽는 b1268(H 목표, b1d10)도 AI 고리 뒤다. +0xe8 · +0xbc 는 웹 판에 칸이 없다.
// 동작 번호 +0xa8 · 프레임 +0xac · 자세 워드 +0xb0 는 r171 부터 든다(`fielderPose` — 지우기 a137a~a1456 도 이 야수 틱이다)
// 잠긴 야수(+0xb4 > 0)는 6 절 걸음이 없고 vt14 도 목표를 안 받는다 — AI 0xc(백업 b4b78)는 1c 절이 같은 관문으로 고친다(r180).
// 키스톤 자리 잡기 b203a 의 목표도 vt14 관문(잠금 · vtc8)을 지난다 — AI 0xa 만 관문 없이 건다(`coverTick`, r190 — 예전 웹은 관문 없이
// 적었다. 표 전체에서 관문에 막힌 호출 5932 번이 결과 · 로그 · 그림 어느 것도 바꾸지 않았다: 막힌 동안은 안 걷고 지우기 vt10 이 목표 =
// 위치로 되돌려 다음 b203a 가 다시 적는다)
// 키 건너뛰기가 풀린 그림 다음 그림의 목록 틱(아래 9 절 `extraListTick`)도 같은 몫을 돈다
export function listTickHead(s: DefensePlayState): void {
  const lockedThisTick = s.fielders.map((fielder) => fielder.actionLockTicks > 0)
  // a12da · a12e6 — 잠금이 없는 틱에만 +0xb8 · +0xc0 을 −1 (그림의 "!" 표시만 본다)
  s.fumbleMarks = s.fumbleMarks.map((value, slot) => tickMarkCounter(value, lockedThisTick[slot] === true))
  s.throwErrorMarks = s.throwErrorMarks.map((value, slot) => tickMarkCounter(value, lockedThisTick[slot] === true))
  // a1286 프레임 +1 · 잠금 · 준비 틱 · 자세 워드 지우기 a137a~a1456 (`fielderPose.listTickFielder`, r171)
  s.fielders = s.fielders.map(listTickFielder)
}
