/**
 * **주자 판 진행기** — 타구가 없는 수비 판(플레이 종류 5 도루 · 9 폭투·포일)을 틱 단위로 돈다.
 *
 * 견제(`pickoffPlay`)와 같은 까닭으로 타구 진행기 `runDefensePlay` 와 따로 둔다 — 그쪽은
 * "목록 0번 = 결과 코드가 운명을 정한 타자주자" 를 전제로 짜여 있다. 이 판에는 결과 코드가 없고,
 * 모든 주자의 운명을 원본 판정(0xb36d0 · 0xb4292)이 정한다.
 *
 * ## 한 틱의 차례 (원본 장면 갱신 0x52c50 = 공용 갱신 0x3f060(야수·주자 틱) → 슬롯 2 0x524c0 → 그리기 0x46c88)
 * 웹 판 틱 N = 그림 N 의 슬롯 2(0~4c 절) · 그림 N 그리기(5 · 5b 절) · 그림 N+1 의 목록 틱(6 절 이동)이다(`playGate` 머리글).
 * 0. 야수 틱 0xa1284 — 공 쥔 야수의 준비 틱 +0xc8 −= 1
 * 1. 포구 틱 갈래 0xb401c(플레이 vt48) — 쫓는 공(종류 9 의 폭투 · 포일 공 · 송구공 · 튕긴 공)을 고른 야수가 포구 틱에: 펌블 굴림 b4224
 *    (늘 먹는다) → 움직이는 공이면 펌블(0xbc2 · 틱 끝 0xb3148 튕김) / 아니면 b4292 결과 9 검사 · 쥐기 0xb2710(P, f, 1) · vt90
 * 2. 같은 플레이 틱의 꼬리 — 아웃 판정 b43da → 낙구 틱 포스 요구 루 0xa95e8(b444e~b453c) → 결과 메시지 0xbba(b4562 — 13 이면
 *    0x51d40~0x51db4 가 사람 수비에서도 CPU 송구 결정 한 번) → 튕김 0xb3148(b45a0) → 득점 0xaa0a8 · 보류 풀기 0xaa34c(525fc)
 * 3a. 중계 이어 던지기 — 플레이 vt4c 0xb45dc 머리 b4616: 계획 +0x14c 가 중계고 중계맨이 쥐었으면 최종 받는 야수에게 0xb2e38
 * 3b. 사람 목표 +0x160 — 플레이 vt4c 0xb45dc(52612)의 b4660~b46a8: 쥠 && 준비면 루로 보내기 `0xb2c90`, 그리고 −1 · 3c. AI 9
 * 3d. vt4c 끝 b4c72 — 플레이 vt30 = 0xb1c90: 커버(+0xf0) 다시 고르기 · 키스톤 자리 0xb203a (`coverTick.runCoverTick`, r162).
 *    송구 0xb2e38 꼬리 b3094 도 같은 것을 한 번 부른다(`sendToBase`)
 * 4. 자동 추가 진루 0xaf918 (`0xae690` 갈림, 진루시키면 +0x128 = 1) · 자동 슬라이딩 0xb030c
 * 4c. CPU 송구 결정 `0xafa60 → 0xafb24` — `0xae6c8`(수비 CPU || 송구 자동)일 때 매 틱, +0x128 && 준비일 때만 고르고
 *    0xb2c90 이 성공하면 +0x128 = 0. 받은 야수도 준비 틱이 지나면 이어 던진다.
 *    사람 수비·수동 송구에서 키가 없으면 **던지지 않는다** — 0xb1c90 의 자동 가지에는 송구 호출이 없다.
 * 5. 그림 · 5b. 연출 0x46c88 · 6. 움직이기(다음 그림 목록 틱 — 주자 +0x3b) · 9. 판 진행 관문 0xb0d28
 *
 * ## 송구 — 타구 진행기와 같은 원본 길
 * 0xb2e38 → 0xa1620(악송구 · 긴 송구 흔들림 · 원바운드 갈래) · 세계 0xbfed0 · 받는 점 끼워 넣기 b2f9c(`launchThrow`) →
 * 예보 vt24(0) · 고르기 vt34(`chaseLooseBall`) — 받는 것도 줍는 것도 1 절 포구 틱 갈래다.
 *
 * ## 근사 (지어내지 않은 자리 — 견제 진행기와 같다)
 * - 움직이기(6 절)는 다음 그림의 목록 틱(0x3f060)이라 슬롯 2 뒤에 둔다. 아웃 판정 · 득점은 원본처럼 슬롯 2(이동 앞)다.
 *   쥐기 0xb2710 은 야수를 옮기지 않는다(r176 — 예전 웹은 포구 지점으로 옮겨 쥐었다). 받는 포구 · 줍는 포구도 b4134 의 포구 동작 ·
 *   자세 워드(`fielderPose`)를 건다. ⚠️ AI 고리(b46ae~)는 AI 0 의 시작 자리 되돌리기 · AI 2~5 의 b4814 · AI 9 만 옮겼다.
 * - 중계 이어 던지기 b4616 (3a 절, r214): 0xb2e38 이 적은 송구 계획 +0x14c 가 중계면 중계맨이 쥔 뒤 준비 틱이 지난 틱에 최종 받는
 *   야수에게 던진다. CPU 송구 결정 0xafa60 은 성공하면 계획을 지우므로(afb08 0xb0ea0) CPU 가 정한 송구는 중계맨이 받아도 이 길이
 *   아니라 쥐기의 +0x128 로 CPU 송구 결정이 다시 고른다 — 사람 목표 · 미룬 송구(AI 9)의 0xb2c90 이 낸 중계만 잇는다.
 * - 자동 추가 진루는 결과 코드가 선 뒤에도 판이 닫힐 때까지 매 틱 묻는다 — +0x111 은 "끝" 이 아니라 홈런 코드 8 이다
 *   (`playGate`). 판은 0xb0d28 대로 주자가 다 서고 공을 쥔 채 관문을 51 번 지나면(그림마다 3 번 — 17틱) 닫힌다.
 * - 레이저 송구(0x523bc 굴림 · 0x4e858 반짝임 · 0x400bc 발사 · 경기 멈춤 +0x1993 · b2f06 레이저 송구)는 타구 진행기와 같은
 *   구조로 옮겼다(`laserTick`, r201). 굴림은 공 가진 야수가 외야수일 때만(523e6) 돌아 이 판에서는 송구 · 튕긴 공을 외야수가 쫓을 때만 선다.
 *   ⚠️ 공 가진 야수가 없는 밀어내기 판(+0x130 = −1)의 굴림은 미해결이라 안 굴린다(`laserTick` 주석).
 *
 * ## 사람 공격 키 (2026-10-16 직접 뜸 — `entities/fielding/model/baserunningKey`)
 * 상태 0x17 키 0x53420 은 조작 [+0xc] == 0(사람 공격)이면 판 종류를 안 보고 주루 0x5331c(0x582 진루 · 0x584 귀루) 뒤 OK → 0x585
 * (슬라이딩)를 보낸다. 0x582 · 0x584 → 0x5209e · 0x5222a → 0xa9b04 는 판 종류 {1, 4, 5, 9}(0xae794)에서만 주자를 움직여 도루 ·
 * 폭투 판은 받고 밀어내기(종류 2)는 안 받는다. 성공하면 플레이+0x128 = 1(CPU 송구 결정을 다시 부른다). 슬라이딩 0x518da 는 종류 2 · 3 만
 * 막는다(`slideOnKey`). 굴림 없음.
 */
export {
  RUNNER_PLAY_RESULT,
  type RunnerPlayEngineInput,
  type RunnerPlayEngineResult,
  type RunnerPlayTickSound,
} from '@/features/defense-play/model/runnerPlay/types/runnerPlayTypes'
export { runRunnerPlay, startRunnerPlay } from '@/features/defense-play/model/runnerPlay/stepper'
export { runnerPlayCallSoundIdOf } from '@/features/defense-play/model/runnerPlay/judgement/callSound'
export { slidingRunnerOf } from '@/features/defense-play/model/runnerPlay/runners/playRunners'
