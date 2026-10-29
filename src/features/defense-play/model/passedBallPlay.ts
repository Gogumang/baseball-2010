import { runRunnerPlay } from '@/features/defense-play/model/runnerPlayEngine'
import type { PassedBallPlayInput, PassedBallPlayResult } from '@/features/defense-play/model/passedBallPlay/passedBallTypes'
import { passedBallPlayEngineInputOf } from '@/features/defense-play/model/passedBallPlay/passedBallStart'
import { passedBallPlayResultOf } from '@/features/defense-play/model/passedBallPlay/passedBallResult'

/**
 * **폭투·포일 한 판** — 플레이 종류 9 (S8 5절). 투구마다 0.1% 로 공이 포수 뒤로 빠지고, 포수(또는 가장
 * 먼저 닿는 야수)가 그 공을 쫓아 줍는 동안 주자가 뛴다.
 *
 * ## 길 (전부 직접 뜬 것)
 * ```
 * 0x3e038  r = 0x35034(장면)                 ; rollPassedBall — 모드 7 빼고 10 > rand(0,10000)
 * 0x3e05a  v = 0x9d57c(…)                    ; 투구 판정
 * 0x3e062  r && v ≠ 3 && v ≠ 4:
 *            0x3507c  각 = rand(60,130) · 세기 = rand(160,280) · 수직 −100 → 메시지 0x11(공 쏘기)   ; passedBallShot
 *            0xb0cb8(플레이, 9) ; 포수+0xb8 = 6(놓침 동작) ; 상태 0x17
 *            v == 5 → 낫아웃 갈래 (`passedBallStrikeoutOf`)
 * 0x46418  상태 0x17 진입: 플레이.vt18 → 종류 9 = 0xb284a
 * 0xb284a  vt1c ; vt20(0) ; P+0x130 = 1(포수) ; vt24(1)(=0xb12d0 예보) ; vt34(=0xb3b38 고르기) ;
 *          vt30(=0xb1c90 송구/커버) ; **P+0x112 = 1**(0xb2888 → 0xb28b6 `strb`)
 * ```
 * - **P+0x112 = 1 로 시작한다** — 아웃 판정의 결과 1(뜬공 아웃)은 "+0x112 == 0 에서 처음 쥠" 이라
 *   공을 바운드 전에 잡아도 아웃이 아니다. 타격 기록도 없다(0x9d5bc 가 state[0x19] 면 0).
 * - 종류 9 는 `0xa276c`(공 첫 점 세우기)를 안 부른다 — 공은 메시지 0x11 이 쏜 궤적 그대로다.
 * - 판정 콜: 결과 9 는 0x51c14 의 종류 4·5 갈래 **밖**이라 소리 객체 상태(`[[0x1400058]+5]`·`+0x14`)를 본다 —
 *   +5(기기 예외 바이트)가 서 있으면 곧장 17, 아니면 +0x14(물린 소리 버퍼)가 0 일 때만 17 이다. +5 는 PHONEMODEL 조회가 되면
 *   초기화 0x6e852 가 늘 1 로 쓰므로 실기에서는 늘 17 이다 — 웹도 17 (`judgeCall.SAFE_CALL_SOUND` 주석, 2026-10-16 직접 뜸).
 *
 * ## 판이 끝난 뒤의 진루 — S8 5-5 의 미해결을 닫는다
 * 진루는 판이 **끝난 뒤** 따로 정해지지 않는다. 판이 도는 동안 매 틱 자동 추가 진루 0xaf918 이 돈다:
 * - 0x5261c~0x52668(경기 장면 슬롯 2, 상태 0x17 매 틱): `0xae690` = 공격이 CPU 거나 주루 설정 자동이면 돈다.
 * - 0xaf918 의 종류 거르개는 {2, 3, 8} 뿐이고(0xaf9ac), "잡힐 뜬공" 갈래(0xaf98e)는 `+0x112 == 0` 일 때만인데
 *   종류 9 는 +0x112 = 1 로 시작하므로 **처음부터 틱 비교 갈래**를 탄다: 다음 루에 수비 송구(0xaf284)보다
 *   2틱 넘게 먼저 닿으면 한 루 더 간다 (`autoAdvance.ts`, P2 5a · S7 확정).
 * - 사람이 공격하면서 주루 수동이면 이 진루는 아예 안 돈다 — 사람 주루 키(0x582)로만 간다.
 * 곧 폭투·포일의 진루 = 위 규칙 그대로다. 사람 주루 키는 이 진행기가 받지 않는다(미리 돌려 재생만 한다).
 *
 * ## 공 궤적 · 그 밖의 자리
 * - **공 궤적**은 타구와 같은 쏘기 길이다(r305 다시 뜸): 0x3507c 가 +0xfcc · +0xfce · +0xfd0 에 각 · 세기 · 수직(−100)을 적고
 *   메시지 0x11 의 인자로 +0xfcc 를 넘긴다(350b0~350b8). 받는 쪽 0x50faa 는 덱 갈래([sp+0xa0] · [sp+0x9c])가 서지 않으면
 *   그 칸을 그대로 쓴다 — 공은 늘 0xbef58(공, 0xcfb70 = (20000, 1000, 30000))에 놓이고(51040~51058) 51172~51188 이
 *   vt44(+2 세기, +4 수직, +0 각)로 쏜다. 물리 · 충돌은 `ballPhysics`(원본을 직접 뜬 것)가 그대로 돈다. 각은 0x3507c 가
 *   부호 없이 넣고(+60…+130), 타격 덱은 그 칸에 −a 를 넣으므로 웹 패턴 각으로는 −각 이다(S8 5-4: 홈플레이트 뒤쪽).
 * - **포수 +0xb8 = 6(놓침 동작)** 은 포구 예보·이동에 효과가 없다 — `.text` 를 훑어(`adds rX, #0xb8` · `adds #0x80 + [#0x38]` ·
 *   `movs #0xb8` 레지스터 오프셋) 야수 +0xb8 을 만지는 곳은 쓰기 b4276(펌블) · 3e08e(폭투) · 줄이기 a12da(야수 틱) · 읽기
 *   4381a(그리기 — 29 · 실책 · "!") 넷뿐이다(나머지 `+0xb8` 은 vtable 칸 호출 · 주자 객체 베끼기 af786). 동작 잠금 칸은 +0xb4 라 따로다.
 * - **커버**: 0xb1c90 은 판 시작(b2884)과 vt4c 끝(b4c72)에서 매 틱 다시 고른다(`coverTick.runCoverTick` — r162). 공 첫 점이
 *   웹 폭투 공의 시작점(표준 배팅 지점 = 0xd8758)이라 2루는 b1e12 규칙 — 공 각(+60…+130) + 90 > 0 이라 유격수, 2루수가 2루 위면 맞바꿈.
 *   0xb1b88 의 타자주자 갈래(0xb1bde~0xb1c08, P+0x168 비교)는 P+0x168 을 쓰는 곳이 바이너리에 없어 안 선다(`batterRunnerNeedsCover`).
 * - 낫아웃 타자주자는 0xa93ac 가 세우는 대로 처음부터 1루로 뛴다 — a93f8~a9400 `주자.vt48(1)`(= 0xa07b0 → +0x80 · +0x7c ·
 *   +0x84 = 1)로 목표 루 1, a940a `+0x88 = 1`(요구 루) · a940c `+0x94 = 1` · a940e `+0x98 = 1`(타자주자). 판 시작 목표 0xa9e44 는
 *   목록 1 번부터 돌아(a9e5c `movs r1, #1`) 타자주자(0 번)를 건드리지 않는다.
 *   출발 자리는 홈이 아니라 **타석 자리**다 — 같은 0xa93ac 의 a9446 vt94 0xa0884(주자, 0xb63c0(타자))가 홈 x ±700(좌타 +) · z −100 으로
 *   옮긴다(`batterBoxPosition`, r326). 0x4650e 이 넘기는 타자는 0x464e6 0xae89c(지금 타순의 타자)라 타구 판과 같다.
 */
export type { PassedBallPlayInput, PassedBallPlayResult } from '@/features/defense-play/model/passedBallPlay/passedBallTypes'
export { passedBallPlayEngineInputOf, passedBallTrajectoryOf } from '@/features/defense-play/model/passedBallPlay/passedBallStart'
export {
  isPassedBallPlayResult,
  passedBallCallSoundIdOf,
  passedBallPlayResultOf,
} from '@/features/defense-play/model/passedBallPlay/passedBallResult'

/** 판 하나를 끝까지 돌린다 — 시작 → 진행기 → 정리 */
export function runPassedBallPlay(input: PassedBallPlayInput): PassedBallPlayResult {
  return passedBallPlayResultOf(input, runRunnerPlay(passedBallPlayEngineInputOf(input)))
}
