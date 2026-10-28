import type { FielderRecordSeat } from '@/entities/fielding/model/fielderRecords'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { HolderPlate } from '@/features/defense-play/model/defensePlayView'
import { loadedRunnerAceOf, runnerAceIndexesOf, type RunnerAces } from '@/features/defense-play/model/runnerAces'
import type { DefenseScene } from '@/features/defense-play/model/defenseScene'
import { basePosition, runnerSpeedOf } from '@/entities/fielding/model/fieldGeometry'
import {
  AI_STATE,
  createFielders,
  createRunner,
  initialPlayView,
  type FielderState,
  type PlayView,
  type RunnerState,
} from '@/entities/fielding/model/fieldingState'
import { PICKOFF_COVER_OF_BASE } from '@/entities/fielding/model/pickoff'
import { CATCHER_BALL_POINT, runCoverTick, runnerPlayBallInput } from '@/features/defense-play/model/coverTick'
import { placedAt, withCarriedSlack } from '@/entities/fielding/model/fielderPose'
import { applyRunnerLead, runnerLeadOf } from '@/entities/fielding/model/runnerLead'
import { STEAL_PLAY_KIND, stealTargetBaseOf, type StealBase } from '@/entities/fielding/model/stealStart'
import type { BaseState } from '@/entities/game/model/baseState'
import type { ManualAutoMode } from '@/entities/settings/model/gameSettings'
import type { DefensePlayControls, DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import {
  RUNNER_PLAY_RESULT,
  runRunnerPlay,
  type RunnerPlayEngineInput,
  type RunnerPlayEngineResult,
  type RunnerPlayResultCode,
} from '@/features/defense-play/model/runnerPlayEngine'

/**
 * **도루 한 판** — 플레이 종류 5(주자만)를 틱 단위로 돌린다.
 *
 * 사람 경기의 도루는 표 굴림이 아니다. 도루 메시지 0x583 이 주자를 **출발만** 시키고
 * (`entities/fielding/model/stealStart` — 0xa9bd4), 투구가 끝나면 상태 0x12 진입 0x3dfac 가
 * `state[0x24]`(도루 중)를 보고 **종류 5 · 상태 0x17** 을 연다(0x3e0e4~0x3e116). 그 판에서
 * 포수 송구와 주자 도착이 겨뤄 세이프(결과 9) · 도루사(13)가 갈린다.
 *
 * ## 시작 0xb2950 (플레이 vt 0x18 의 종류 5 가지, 직접 뜬 것)
 * ```
 * b2950: 플레이.vt1c() ; 플레이.vt20(0)
 * b2966: P+0x130 = 1                          ; 공 가진 야수 = 포수
 * b2970: 0xa276c(공, 종류)                     ; 종류 5 면 공 첫 점 = 0xd7c30 = (20000, 0, 29705) = 포수 자리
 * b297a: for b = 0..3: 야수(b+1) → 루 좌표 0xd86b0[b] (0xbef59) ; P+0xf0[b] = b+1   ← 견제(0xb28be)와 같은 고리
 * b29b4: 플레이.vt24(0) ; vt34(=0xb3b38 고르기) ; vt30(=0xb1c90 송구/커버)
 * b29d4: 0xb2710(P, 1, 0)                      ; ★ 포수가 공을 쥔다 — 셋째 인자 0 이라 준비 틱을 안 넣는다
 * b29de: 포수.vt88(0)                           ; 야수+0xc8 = 0 (0xa0ed8) — 곧바로 던질 수 있다
 * ```
 * - 공 쥐기 0xb2710 이 `+0x112 = 1`(이미 잡힘) · `state[0x1e] = 1` 을 세우므로 뜬공 아웃(결과 1)은 없고,
 *   홈에 들어온 주자는 2아웃 보류 규칙을 탄다.
 * - 커버: `0xb1c90` 은 부를 때마다 `+0xf0` 을 표 `0xd8774` = [1, 2, 3, 4] 로 되돌린 뒤 고친다. 2루는
 *   공 첫 점(포수 자리)이 0xd8758 (20000, 1000, 30000) 과 달라 `0xb1e86` 의 "2루에 더 가까운 쪽(2루수 3 ·
 *   유격수 5)" 갈래로 가는데, 2루수가 이 고리에서 이미 2루 위에 서 있어 늘 2루수다. 1·3루는 표 그대로.
 * - **홈 커버 = 포수(1)** (r120 확정 — 아래 차례를 직접 떴다):
 *   ```
 *   b29a2  0xbef58(포수, 0xd86b0[0] = (20000, 0, 29445)) = 0xbee60(위치 +0x20 · 구간 출발 +0x14 = 홈) → 야수 vt14 0xa14c8:
 *          +0xb4 ≤ 0 · vtc8(0xa2118: +0xb1 == 0 && +0xcc ≤ 0) 이고 목표가 다르면 0xbf2cc 로 **목표 +0x2c = 홈 좌표**
 *   b29b4  vt24(0) 예보 0xb12d0 — 공은 0xa276c 가 점 하나(+0x6c = 1, (20000, 0, 29705))만 깔아 표가 빈다
 *   b29c4  vt34 0xb3b38 — 표가 비어 마지막 갈래(낮은 공 점 Q = 마지막 점에 가장 가까운 야수) → 홈 위의 포수(거리 260).
 *          b3e40 +0x130 = 포수 · b3e54 **포수 AI 1**(0xb8dbc). 목표는 안 바꾼다
 *   b29d0  vt30 0xb1c90 — b1d0a k = 0xb1268(포수 목표) = 0 = +0x130 − 1 이지만 포수 AI 1 이라 b1d1a 갈래가 아니고 b1d48 이
 *          +0xf0[0] = 0(투수, 0xb1b88(0) 거짓이면 −1) — 그러나 **b23a4** 가 b = 포수.vt68() = 0(목표가 홈) · AI ≠ 9 라
 *          +0xf0[0] = 포수로 되돌린다. b23dc 는 c == d(1) 이고 투수 목표가 홈이 아니라 지나가고, b2564 는 포수 AI 1 이라 건너뛴다
 *   b29d4  0xb2710(P, 1, 0) — 쥐기는 AI · 목표를 안 건드린다. 쥔 AI 1 야수는 AI 1 처리 0xb4aca 가 +0xe0 == 0 일 때만 움직여 선다
 *   ```
 *   그래서 판 내내(포수가 쥐고 있는 동안) 홈은 포수다 — 표 [1, 2, 3, 4] 그대로. 포수가 던지면 0xb2e38 의 vt34 가 AI 1 을 0 으로
 *   내리고(b3b7a) vt30 의 b2564 가 커버 표의 포수에게 vt14(홈) · AI 2 를 준다(`runnerPlayEngine` 의 던진 야수 처리).
 *   판 시작 b295e 의 vt20(0) = 0xb0fb4 가 아홉 야수마다 b112e vt10(+0xb4 · 자세 워드(+0xb1 포함) = 0 · 목표 = 위치) · AI 0 · +0xe0 = 0 을
 *   하므로(직접 뜬 것, r180) 앞 판의 송구 잠금 · 동작 잠금은 남지 않는다. 남을 수 있는 것은 +0xcc 하나다 — vt20 은 인자가 0 이면
 *   b1144 에서 +0xcc 쓰기(b1156)를 건너뛴다. +0xcc 를 세우는 곳은 vt8c 0xa0ee0 뿐이고 그 vt8c 는 AI 0xf(시작 자리로 돌아가기 b4c2a,
 *   5)뿐 — AI 0xf 는 사건 7 · 0xc 를 받은 0xb2c58 이 아홉 야수에 건다(파울 판 뒤).
 *   **판정(r190 — 직접 뜬 것)**: 남는다. 야수는 경기 장면 초기화 0x3e340 이 한 번 만들어(생성자 a0df0 +0xcc = 0) 판마다 다시 쓰고,
 *   +0xcc 쓰기는 a0df0 · vt8c a0ee0 · vt20 의 b1156 · 목록 틱 a1330(−1) 넷뿐이다(b0fa6 이 든 0xb0f88 은 부르는 곳이 없다 — `adds #0xcc`
 *   전수). 목록 틱은 0x3f060 이 관문 0xb0d28 이 열리고 상태 0x17 일 때만 돈다(3f0b8~3f0da) — 판 사이(정산 · 다음 투구)에는 안 줄어든다.
 *   AI 0xf 는 사건 7 · 12 를 받은 틱부터 판 끝까지 고리마다 5 를 다시 적는다. 판이 닫힐 때 남는 값은 마지막 그림의 관문 차례로
 *   갈린다(r196 — 직접 뜬 것): 한 그림은 G1(0x3f060 3f0b8 — 열리면 목록 틱 a1330 이 하나 줄인다) → G2(슬롯 2 52502 — 열리면 AI 고리가
 *   5 를 다시 적는다) → G3(그리기 46e3a) → G4(0x3f378 3f3b2 — 열리면 3f3c6 0xa2594 가 공+0x68 을 올린다) 차례이고, 관문 0xb0d28 의
 *   파울 갈래(+0x110 — b0d3a~b0db2)는 공 칸(멈춤 · aa0/aa4/+0x68 · z · 각)만 본다. 공은 G4 뒤에만 나아가므로 같은 그림의 G1 · G2 는
 *   늘 같은 답이다 — 파울 판은 **5** 가 남는다(웹 표: 사건 7 판 모드마다 1536 — 씨앗 둘, 키스톤 자리 잡기로 AI 0xa 가 된 한 칸만 0~2).
 *   폴 홈런(12)은 홈런 갈래가 목록 틱이 옮긴 주자(0xaa05c · 0xa990c)를 봐 G1 열림 · G2 닫힘이면 **4** 다(`fielderSlackAtPlayEnd`).
 *   다음 판이 vt20(0)인 폭투 · 포일 0xb284a(b2856) · 견제 0xb28be(b28ca) · 도루 0xb2950(b295e) · 밀어내기(종류 2 · 3) 0xb288c(b2898)이면
 *   b1144 가 b1156 을 건너뛰어 그 값으로 열린다 — 첫 4~5 목록 틱은 vtc8 이 닫혀 아무도 안 걷고(지우기 vt10 이 목표 = 위치), vt14 를
 *   거치는 목표 고치기(판 시작 0xbef58 · 커버 b25b6 · vt48)가 막히며, 판 시작 예보 vt24 의 복제와 vtc0(도착 틱 + +0xcc)도 그 값을
 *   들고 돈다. 타구 판은 vt20(1)이라 지운다.
 *   **웹 반영(r196)**: 진행기는 끝날 때 제 +0xcc 를 `DefenseScene.fielderSlack` 에 적고, vt20(0) 판이 그것을 들고 연다 — 경기 흐름
 *   셋(타자편 · 투수편 · 팀 경기)은 이미 판마다 수비 장면을 넘긴다. 이어하기는 장면을 새로 열어 0 부터다(저장 블록에 야수가 없다).
 *   표(씨앗 1 · 777, +0xcc = 5 를 들고 연 판 ↔ 0): 도루 144 판 중 결과 24(1 · 3루 1루 도루 — vtc0 가 늦어 3루 주자가 판 시작 자동
 *   진루로 홈에 뛰어 태그) · 굴림 수 6, 견제 144 판은 그림만, 폭투 1440 판은 로그 전부(포수 · 줍는 야수가 늦게 쥔다) · 결과 174 ·
 *   굴림 수 12, 밀어내기 48 판은 그대로.
 *
 * ## 판정
 * - 송구 판단·도착·아웃·세이프는 `runnerPlayEngine` (+0x160 b4660 / 0xafa60 → 0xb2c90 · 0xb36d0 · 0xb4292).
 *   도루 주자는 밀린 주자가 아니라 **태그(≤499)** 로만 죽는다.
 * - 세이프 = 커버가 루 위에서 공을 받는 틱에 그 루의 주자가 이미 닿아 있다 → 결과 9 → 콜 17.
 * - 송구가 없으면(키 없는 사람 수비 · 점수식이 −1) 결과 코드 없이 주자가 그대로 간다.
 *
 * - CPU 수비(또는 송구 설정 자동)의 송구 목표는 `throwTargetBase.chooseThrowTargetBase`(0xafb24) — 후보표 칸이
 *   +0x7c(달려가는 루)라 도루 주자는 **다음 루** 칸에 든다. 리드 뒤엔 대개 잡을 루가 없어 던지지 않는다.
 * - 사람 수비·수동 송구가 키를 안 누르면 **던지지 않는다** — 포수가 공을 들고 있다. 0xb1c90 자동 가지에는 송구
 *   호출이 없다(`runDefensePlay` 의 `throwMode` 주석). 홈 도루만 포수가 홈에서 태그한다.
 *
 * ## 1·2루 도루는 원본에서도 (거의) 늘 세이프다 — 수식
 * 같은 단위(틱, 월드 좌표)로 원본 값만 놓고 셈한다.
 * - 루 사이 D = |0xd86b0[1]−0xd86b0[2]| = |0xd86b0[2]−0xd86b0[3]| = 7772.
 * - 주자 한 틱 = 속도 +0x3c = 300 + ⌊주루×7/100⌋(+팀 등급) — 루에 세울 때 0xa93ac(a94a6 vt64 → 0xbec7c)가 넣고,
 *   리드 틱 0xa01cc → 0xbf094 → vt30 0xbf0dc → vt24 0xbf158 이 그 값만큼 옮긴다(가속·대기 없음 — +0xba 흔들기
 *   갈래 a01ea 는 아웃 주자(+0x96) 전용 0xaa008 → 0xa03ac 만 켠다). 그래서 s ≥ 300.
 * - 리드 L = 0xcffa8[b] + max(rand(0,9), 3) — rand(0,9) 는 0xbfa54 로 0~8 → 1루 18~23 · 2루 17~22 틱.
 * - 판이 열린 뒤 주자 도착 T_run = ⌈D/s⌉ − L ≤ ⌈7772/300⌉ − 18 = 8 (1루) · 26 − 17 = 9 (2루, 주루 0 일 때).
 *   주루 500(s = 335)이면 ⌈23.2⌉ = 24 − L → 1루 1~6 · 2루 2~7 틱.
 * - 포수 송구: 공 첫 점 = 포수 자리 (20000, 29705)(0xd7c30), 준비 0(vt88(0)). 송구 틱 0xa1adc 는 공 속도
 *   v = +0xdc(= 940 + 8(등급+1) + 팀 보너스, 특수면 130%)로 쏜 포물선의 수평 성분으로 나눈 값이라
 *   **T_throw ≥ 거리 / v** 다. 2루까지 10535 · 3루까지 8119 → 보통 송구(v ≤ 1004 + 보너스)면 2루 ≥ 10.5 · 3루 ≥ 8.1 틱.
 * → 1루 도루는 T_run ≤ 8 < T_throw 로 **늘 세이프**(v < 1317 인 한). 2루 도루도 주루 ≥ 158(s ≥ 311 → T_run ≤ 8)이면
 *   늘 세이프이고, 그 아래에서만 리드 굴림·포수 등급에 따라 한 틱 안팎으로 겨룬다.
 *   CPU 수비(0xafb24 점수식)는 잡을 루가 없어 송구조차 안 한다. 웹 3000판 결과(1·2루 2996 세이프 · 4 폭투)와 같다.
 * - 홈 도루는 공 쥔 포수가 처음부터 홈 옆에 있어(260) 주자가 닿기 전 태그(≤499)로 잡힌다 — 주루 700 이상에서만 일부 세이프.
 *
 * ## 난수 — 이 판이 굴리는 것
 * 판이 열릴 때 도루 주자마다 리드 덧틱 `rand(0,9)` 한 번(`0x3d7b8`, 주자 목록 차례). 그다음 송구가 나갈 때
 * 악송구 굴림(0xa1828) 한 번(악송구면 +4 — `errantThrowFlight`). CPU 송구가 홈을 고르면 그 앞에 특수 송구 굴림 `rand(0,100)` 한 번.
 *
 * ## 도루 시작 0x583 끝의 0xafa60 한 번 — 옮겼다(r201, `stealStartThrowDecision`)
 * 0x520de(메시지 0x583) 는 0xa9bd4 로 주자를 출발시키고 `state[0x14+루]`·`[0x90+루]` = 1, 0x457cc 뒤 **52222 에서
 * 제어기 0xaf8e0 → vt0xc = 0xafa60 을 한 번** 부른다(투구 중 — 판은 아직 안 열렸다. 수비 조작을 안 본다). 그 순간 플레이 칸 (직접 뜬 것):
 * - +0x128 을 쓰는 곳은 쥐기 b2716 · 자동 진루 afa26 · 결과 메시지 51d9c · 진루 키 520d2 · 귀루 키 52260(모두 1) 과
 *   0xafa60 성공 afafc(0) 뿐이다. 판 시작 vt1c(0xb0edc)는 +0x110~+0x12d 의 다른 바이트만 지우고 +0x128 은 안 건드린다
 * - +0x130 은 판 시작 vt1c(b0f58)가 −1 로 되돌리고 쥐기가 세운다. 투구 시작 0x3d954 는 플레이.vt64·vt68·vt6c(0)만 부른다
 * - 야수 +0xe0 을 지우는 곳은 송구 b2f80 · 튕김 b3362 · 판 시작 vt20(b1140) 뿐이고, +0xc8·위치·AI 를 바꾸는 야수 틱은
 *   상태 0x17 에서만 돈다
 * → 곧 **앞 판이 끝난 그대로**다. 진행기 넷(타구 · 주자 판 · 견제)은 끝날 때 플레이 · 야수를 `DefenseScene.playEnd` 로 남기고, 경기 흐름이
 *   도루가 출발한 **그 자리**에서(`pitchArrivalPlay.stealStartSceneOf` — 사람 키를 받은 때 · CPU 는 `rollCpuStealStart` 바로 뒤, 11번째 틱
 *   CPU 타자 결정 0x34334 앞) 그 상태와 막 출발한 주자로 0xafa60 → 0xafb24 → (홈이면 특수 굴림) → 0xb2c90 → 0xb2e38(악송구 굴림)을
 *   돌리고 바뀐 장면을 경기 장면 칸에 곧바로 적는다(r214). 공은 다음 판 시작이 지우고, 남는 것은 난수 차례와 +0x128 = 0 이다 — 판이 안
 *   열리는 공(2아웃 삼진 · 파울 · 타구)에도 남는다.
 *
 * ## 주자의 출발 시각 — 판이 열릴 때 이미 달려 나가 있다 (확정, `entities/fielding/model/runnerLead`)
 * 도루는 투구 중(상태 0x11, CPU 는 그 10번째 틱)에 걸고 판은 공이 도착한 뒤(0x12 → 0x17) 연다.
 * 그 사이 주자 틱(vt0xc = 0xa01cc)은 **한 번도 안 돈다** — 주자·야수 틱 고리 `[장면+0x1e4].vt8` 은
 * 공용 갱신 0x3f060 이 상태 0x17 에서만 부른다(0x3f0c6). 대신 상태 0x17 진입 `0x46418` 이 플레이 시작
 * (0xb2950) 뒤 주자마다 `0x3d7b8` 을 불러 **틱을 몰아서 돌린다**:
 * - 도루 주자: 루 좌표에서 다음 루로 `0xcffa8`[루] = 15(1루)·14(2·3루) + max(rand(0,9), 3) 틱
 * - 도루 안 한 주자: 다음 루로 `0xcffb0`[루] = 6·13·7 틱(번트 종류가 서 있으면 +3) 간 뒤 **목표를 제 루로 되돌린다**
 *   — 판이 열리면 제 루로 돌아오는 중이라 그 루로 공이 가면 태그될 수 있다.
 */
export interface StealPlayInput {
  /** 투구 때 루 상황 */
  readonly bases: BaseState
  /** 출발한 주자들의 루 — 0xa9bd4 가 받아들인 것만 (`canStartSteal`) */
  readonly stealingFrom: readonly StealBase[]
  /**
   * state[6] — 판이 열릴 때의 아웃 수 = **이 투구 전의 아웃 수**. 0x3dfac 는 투구 판정 v 를 판정 칸
   * `[scene+0x10ac]` 에 적어 둘 뿐 아웃은 올리지 않고 곧장 상태 0x17 로 간다 — 1아웃 이하 삼진이면
   * 그 삼진 아웃은 판이 끝난 뒤 판정 칸을 읽는 쪽이 올린다(읽는 자리는 안 떴다 — 유력).
   */
  readonly outs: number
  /** 수비 9명 능력치 (칸 순서) */
  readonly defenseAbilities?: readonly (number | null)[]
  /**
   * **수비 팀 보너스** (판 시작 0xb0fb4 b10d0 — `defenseTeamBonusOf`): 모드 1·2·8·9 에서 수비 팀 '집중' 등급.
   * 아홉 칸(칸 0 포함) 송구 속도에 더한다. 안 주면 0(모드 3~7 과 같다)
   */
  readonly defenseTeamBonus?: number
  /** 주자 주루 능력치 — 루별로 줄 수 있다. 없으면 `runAbility` */
  readonly runAbilities?: Partial<Record<1 | 2 | 3, number>>
  readonly runAbility?: number
  /** 주자 속도에 더하는 팀 등급 (전역 모드 1·2·8 에서만, R3 4절) */
  readonly runnerTeamGrade?: number
  /** 장면 +0xfdc — 이번 투구의 번트 종류 (도루 안 한 주자의 리드 +3, `0x3d7b8`). 기본 0 */
  readonly buntKind?: number
  /** 주면 악송구(0xa1828)·특수 송구(0xafa60) 굴림이 돈다 */
  readonly random?: RandomPort
  /** 수비 9명의 스킬 번호 (칸 순서) — 레이저 굴림 0x66a8c 의 초감각(21) (`DefensePlayInput.fielderSkillIds`) */
  readonly fielderSkillIds?: readonly (readonly number[])[]
  readonly defenseIsCpu?: boolean
  /** 송구 설정 +0xf4 (기본 수동) */
  readonly throwMode?: ManualAutoMode
  /** 사람이 방향키로 고른 송구 루 (+0x160). 안 주면 자동 규칙 */
  readonly manualThrowBase?: number
  readonly offenseIsCpu?: boolean
  /** 주루 설정 +0xbd (기본 자동) */
  readonly runningMode?: ManualAutoMode
  readonly aceIndexes?: readonly (number | null | undefined)[]
  /** 수비 칸별 이름 판 선수 (0x43cb0 — `DefensePlayInput.fielderPlates`) */
  readonly fielderPlates?: readonly (HolderPlate | null | undefined)[]
  /** 공격 팀 타자 · 루 위 주자의 마선수 번호 (`DefensePlayInput.runnerAces`) */
  readonly runnerAces?: RunnerAces
  readonly defenseTeamIndex?: number
  /** 야수 +0xec — 칸별 선수 레코드(판 시작 뒤 값, `entities/fielding/model/fielderRecords`). 그림이 야수마다 싣는다. 안 주면 싣지 않는다 */
  readonly fielderRecords?: readonly (FielderRecordSeat | null)[]
  readonly offenseTeamIndex?: number
  /** 앞 판에서 넘어온 수비 장면 연출 칸 (`DefensePlayInput.scene`) */
  /**
   * 경기 +0xfd4 — 이 판이 열릴 때 남아 있던 스윙 판정 결과 코드(`sceneResultCode`). 튐 파티클(0x37022 ∉ {9,10,11}) ·
   * 홈런성(0x357e0, 24~26)이 본다. 모르면(헛스윙의 정해지지 않은 값 · 안 줌) null — 두 조건 모두 거르지 않는다
   */
  readonly sceneResultCode?: number | null
  readonly scene?: DefenseScene
  /** 사람 조작 — 틱마다 눌린 키 (`RunnerPlayEngineInput.controls`) */
  readonly controls?: DefensePlayControls
}

export interface StealPlayResult extends RunnerPlayEngineResult {
  readonly stealingFrom: readonly StealBase[]
  /** 루를 옮긴 도루 주자의 출발 루 (정산 0xa8024 @a83c6 — 잡힌 주자가 없을 때만 기록 8) */
  readonly stolenFrom: readonly StealBase[]
  /** 잡힌 도루 주자의 출발 루 (@a83de — 기록 24) */
  readonly caughtFrom: readonly StealBase[]
}

const DEFAULT_ABILITY = 500
const CATCHER_SLOT = 1

/** 판 하나를 끝까지 돌린다 — 시작(리드 굴림) → 진행기 → 정리 */
export function runStealPlay(input: StealPlayInput): StealPlayResult {
  return stealPlayResultOf(input, runRunnerPlay(stealPlayEngineInputOf(input)))
}

/**
 * 판 시작 — 야수 · 주자 · 리드(도루 주자마다 rand(0,9))까지 세운 진행기 입력. 실시간으로 돌릴 때는 이것을
 * `startRunnerPlay` 에 넣고, 다 돈 결과를 `stealPlayResultOf` 로 정리한다(굴림 차례는 `runStealPlay` 와 같다).
 */
export function stealPlayEngineInputOf(input: StealPlayInput): RunnerPlayEngineInput {
  const abilities = input.defenseAbilities ?? Array.from({ length: 9 }, () => DEFAULT_ABILITY)
  const covers = [...PICKOFF_COVER_OF_BASE]

  // ── b297a: 야수 1~4 를 제 루로(위치 · 목표 = 루 좌표) · 커버 = 루 + 1 — 홈은 b23a4 가 포수로 되돌려 표 그대로(머리말) ──
  // b295e vt20(0) — b1144 가 +0xcc 쓰기(b1156)를 건너뛰어 앞 판이 남긴 값을 들고 연다(`DefenseScene.fielderSlack`, r196)
  const fielders: FielderState[] = withCarriedSlack(createFielders(abilities, input.defenseTeamBonus ?? 0), input.scene?.fielderSlack).map(
    (fielder) => {
      const base = covers.indexOf(fielder.slot)
      if (base < 0) return fielder
      return {
        // 0xbef58 = 0xbee60(위치 +0x20 · 구간 출발 +0x14 = 루 좌표) → vt14(루 좌표) — 판이 열리는 순간 **루 위에 서 있다**.
        // 목표는 vt14 관문이 열릴 때만 루 좌표다(+0xcc 가 남은 판은 시작 자리 — `placedAt`, r196)
        ...placedAt(fielder, basePosition(base), base),
        // b2564 가 커버 1·2·3루 야수에게 AI 루 + 2 · 포수는 고르기 0xb3b38 의 b3e54 가 AI 1(쫓기 — 쥐고 있어 안 움직인다)
        aiState: fielder.slot === CATCHER_SLOT ? AI_STATE.CHASE : AI_STATE.COVER_HOME + base,
        // b29d4·b29de: 포수가 공을 쥐고(0xb2710 → 야수+0xe0 = 1) 준비 틱은 0 (vt88(0) → +0xc8 = 0)
        holdingBall: fielder.slot === CATCHER_SLOT,
        actionRemainingTicks: 0,
      }
    },
  )
  const play: PlayView = {
    ...initialPlayView(STEAL_PLAY_KIND),
    coverOfBase: covers,
    ballHolderSlot: CATCHER_SLOT,
    catchFielderSlot: CATCHER_SLOT,
  }

  // ── 주자 목록 — 찬 루 오름차순(0xa9a10), 타자주자 없음(0x46418: state[0x11] · 종류 2·3 · state[0x1a] 가 아님) ──
  const runners: RunnerState[] = []
  /** 판 시작 vt30(b29d0)이 보는 주자 — 리드(0x46418 → 0x3d7b8)는 vt18 **뒤**라 아직 루 위다(목표는 0xa9bd4 가 세운 다음 루) */
  const coverRunners: RunnerState[] = []
  ;([1, 2, 3] as const).forEach((base) => {
    const occupied = base === 1 ? input.bases.first : base === 2 ? input.bases.second : input.bases.third
    if (!occupied) return
    const ability = input.runAbilities?.[base] ?? input.runAbility ?? DEFAULT_ABILITY
    const speed = runnerSpeedOf(ability, input.runnerTeamGrade ?? 0)
    const runner = createRunner(runners.length + 1, base, speed, { isBatterRunner: false })
    // 0xa9bd4 → vt48(0xb6228) — 출발한 주자의 목표 루는 한 루 앞
    const stealing = input.stealingFrom.includes(base)
    const started = stealing ? { ...runner, targetBase: stealTargetBaseOf(base) } : runner
    coverRunners.push(started)
    // 0x46418 → 0x3d7b8: 플레이 시작 뒤 주자 목록 차례로 리드 틱을 몰아서 돌린다 (도루 주자는 rand(0,9) 한 번)
    const lead = runnerLeadOf(started, {
      playKind: STEAL_PLAY_KIND,
      stealing,
      buntKind: input.buntKind,
      random: input.random,
    })
    runners.push(applyRunnerLead(started, lead))
  })

  // ── b29d0 vt30 = 0xb1c90 한 번 (`coverTick.runCoverTick`) — 표는 [1, 2, 3, 4] 그대로(머리말)이고, 2루 커버가 아닌 유격수가
  //    0xb203a 로 자리(0xd8764 — 공 가진 포수는 내야라 기본 자리)를 잡아 AI 0xa 가 된다. 공은 0xa276c 의 점 하나(포수 자리 · 각 0) ──
  const started = runCoverTick({
    context: { play, fielders, runners: coverRunners, currentTick: 0, landingTick: 0 },
    ...runnerPlayBallInput(null, CATCHER_BALL_POINT, 0),
    relayFlag: true,
  })

  return {
    kind: STEAL_PLAY_KIND,
    fielders: started.fielders,
    // b29d4: 0xb2710(P, 1, 0) — 엔진이 첫 틱 앞에서 쥐게 하려고 쥠 칸을 세워 둔다. 쥐기는 +0x128 = 1 도 세운다(b2720)
    play: { ...started.play, held: true, everHeld: true, wantsThrow: true },
    relayFlag: started.relayFlag,
    runners,
    abilities,
    outs: input.outs,
    ballOnGround: true,
    random: input.random,
    fielderSkillIds: input.fielderSkillIds,
    defenseIsCpu: input.defenseIsCpu,
    throwMode: input.throwMode,
    manualThrowBase: input.manualThrowBase,
    offenseIsCpu: input.offenseIsCpu,
    runningMode: input.runningMode,
    aceIndexes: input.aceIndexes,
    defenseTeamIndex: input.defenseTeamIndex,
    fielderRecords: input.fielderRecords,
    offenseTeamIndex: input.offenseTeamIndex,
    fielderPlates: input.fielderPlates,
    runnerAceIndexes: runnerAceIndexesOf(input.runnerAces, input.bases),
    runnerAceSprite: loadedRunnerAceOf(input.runnerAces, input.bases),
    scene: input.scene,
    sceneResultCode: input.sceneResultCode,
    controls: input.controls,
  }
}

export interface StealStartThrowInput {
  /** 앞 판이 남긴 수비 장면 — `playEnd`(앞 판이 끝난 그대로의 플레이 · 야수)가 없으면 아무것도 안 한다 */
  readonly scene: DefenseScene | undefined
  /** 투구 때 루 상황 */
  readonly bases: BaseState
  /** 지금까지 출발한 도루 주자의 루 — 출발한 차례대로(0x583 한 번마다 하나씩 는다). 마지막 것이 이번 키다 */
  readonly stealingFrom: readonly StealBase[]
  /** state[6] — 지금 아웃 수 (0xafb24 가 본다) */
  readonly outs: number
  readonly defenseAbilities?: readonly (number | null)[]
  readonly runAbilities?: Partial<Record<1 | 2 | 3, number>>
  readonly runAbility?: number
  readonly runnerTeamGrade?: number
  readonly random?: RandomPort
}

export interface StealStartThrowResult {
  /** `playEnd` 를 0xafa60 뒤 상태로 바꾼 장면 (던졌으면 +0x128 = 0 · 던진 야수는 공을 놓았다) */
  readonly scene: DefenseScene | undefined
  /** 0xafa60 이 루를 골라 0xb2c90 을 불렀나 */
  readonly decided: boolean
  readonly log: readonly string[]
}

/**
 * **도루 키 0x583 끝의 CPU 송구 결정 0xafa60 한 번** (0x520de 52222 — 직접 뜸, r201).
 * ```
 * 521ea  0xa9bd4(주자관리, 루) — 출발 (`canStartSteal`) ; 루 ≤ 0 이거나 state[0x24](도루 중) == 0 이면 끝
 * 52204  state[0x14 + 루] = state[0x90 + 루] = 1 ; 0x457cc
 * 52222  0xaf8e0(제어기 [장면+0x210]) — 0xaf8b8(state[3]) 뒤 vt0xc = 0xafa60 : 수비 조작이 사람이든 CPU 든 조건 없이 부른다
 * afa60  +0x128 && 공 가진 야수(+0x130) && vtC4(준비) && +0xe0(쥠) && AI ∉ {8, 9} && +0xc8 ≤ 0 → 0xafb24(점수식) → 루 b
 * afad2  b == 0(홈)이면 rand(0, 100) < 20 이면 특수 ; 0xb2c90(b, 특수) 가 참이면 +0x128 = 0 · 0xb0ea0
 * ```
 * 투구 중(상태 0x11)이라 판은 아직 안 열렸다 — 플레이 칸 · 야수는 **앞 판이 끝난 그대로**(`DefenseScene.playEnd`)이고, 주자는 루 위에서
 * 막 출발했다(목표 = 다음 루). 0xb2c90 이 던지면(0xb2e38 — 악송구 굴림 0xa1828 · 흔들림 a198c) 그 공은 다음 판 시작(vt1c · vt20 ·
 * 0xa276c)이 지운다 — 남는 것은 난수 차례와 +0x128 = 0 · 던진 야수가 놓은 공(같은 투구의 다음 도루 키는 더 안 던진다)이다.
 * 진행기는 같은 0xafa60 · 0xb2c90 · 0xb2e38 길을 그대로 쓴다(`RunnerPlayEngineInput.throwDecisionOnly`).
 */
export function stealStartThrowDecision(input: StealStartThrowInput): StealStartThrowResult {
  const carried = input.scene?.playEnd
  if (carried === undefined || !carried.play.wantsThrow) return { scene: input.scene, decided: false, log: [] }
  const abilities = input.defenseAbilities ?? Array.from({ length: 9 }, () => DEFAULT_ABILITY)
  // 0xa9bd4 → vt48(0xb6228) — 출발한 주자의 목표 루는 한 루 앞. 리드(0x3d7b8)는 판이 열릴 때라 아직 루 위다
  const runners: RunnerState[] = []
  ;([1, 2, 3] as const).forEach((base) => {
    const occupied = base === 1 ? input.bases.first : base === 2 ? input.bases.second : input.bases.third
    if (!occupied) return
    const ability = input.runAbilities?.[base] ?? input.runAbility ?? DEFAULT_ABILITY
    const runner = createRunner(runners.length + 1, base, runnerSpeedOf(ability, input.runnerTeamGrade ?? 0), {
      isBatterRunner: false,
    })
    runners.push(input.stealingFrom.includes(base) ? { ...runner, targetBase: stealTargetBaseOf(base) } : runner)
  })
  const result = runRunnerPlay({
    kind: carried.play.kind,
    fielders: carried.fielders,
    play: carried.play,
    runners,
    abilities,
    outs: input.outs,
    ballOnGround: true,
    random: input.random,
    // 0xafa60 은 제어기 vt0xc 를 곧바로 부른다 — 수비 CPU · 송구 설정을 안 본다
    defenseIsCpu: true,
    manualThrowBase: carried.play.manualThrowBase,
    throwDecisionOnly: true,
  })
  const after = result.scene.playEnd
  const decided = result.log.length > 0
  return {
    scene: input.scene === undefined || after === undefined ? input.scene : { ...input.scene, playEnd: after },
    decided,
    log: result.log.map((line) => `도루 키 0x583 · ${line}`),
  }
}

/** 판 끝 정리 — 잡힌 · 루를 옮긴 도루 주자 (정산 0xa8024 @a83c6 · @a83de 가 본다) */
export function stealPlayResultOf(input: StealPlayInput, result: RunnerPlayEngineResult): StealPlayResult {
  const stolenFrom: StealBase[] = []
  const caughtFrom: StealBase[] = []
  result.runnerFates.forEach((fate) => {
    const from = fate.fromBase
    if (from !== 1 && from !== 2 && from !== 3) return
    if (!input.stealingFrom.includes(from)) return
    if (fate.retired && !fate.scored) caughtFrom.push(from)
  })
  // 잡히지 않은 도루 주자는 다음 루 이상에 닿았다 — 목표 루에 닿기 전엔 판이 안 끝난다
  for (const from of input.stealingFrom) {
    if (caughtFrom.includes(from)) continue
    stolenFrom.push(from)
  }
  return { ...result, stealingFrom: [...input.stealingFrom], stolenFrom, caughtFrom }
}

/**
 * 도루 판이 끝난 뒤의 콜 — 결과 9 면 **늘 17**(0x51c14 머리 세 줄이 종류 4·5 를 따로 빼 다른 검사 없이 17),
 * 13 이면 state[0x87](마지막 판정이 태그) 이 서 있으니 62, 아니면 20 (0x51b36). 결과 코드가 없으면 소리도 없다.
 */
export function stealCallSoundIdOf(result: Pick<StealPlayResult, 'resultCode' | 'tagOut'>): number | null {
  if (result.resultCode === RUNNER_PLAY_RESULT.SAFE) return SAFE_CALL
  if (result.resultCode === RUNNER_PLAY_RESULT.OUT) return result.tagOut ? CAUGHT_OUT_CALL : FORCE_OUT_CALL
  return null
}

const SAFE_CALL = 17
const CAUGHT_OUT_CALL = 62
const FORCE_OUT_CALL = 20

/** 재생 칸에 든 결과가 도루 판인가 */
export function isStealPlayResult(result: DefensePlayResult | null): result is StealPlayResult {
  return result !== null && 'stealingFrom' in result && 'resultCode' in result
}

export type { RunnerPlayResultCode as StealResultCode }
