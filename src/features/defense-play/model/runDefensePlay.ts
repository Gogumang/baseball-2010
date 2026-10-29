/**
 * 타구 하나를 **틱 단위로 돌리는 진행기**.
 *
 * ## 틱 스테퍼 — 사람이 실시간으로 끼어들 수 있게
 * 예전에는 타구 하나를 통째로 미리 계산해 `ticks` 배열을 뱉는 한 덩이 함수였다. 그러면
 * **사람이 아직 안 누른 키를 알 수 없어** 실시간 조작이 원리적으로 불가능하다. 그래서 넷으로 쪼갰다:
 *   `startDefensePlay` → `stepDefensePlay`(한 갱신 = 한 틱, 0xc2198) → `isDefensePlayFinished` →
 *   `defensePlayResultOf`
 * `runDefensePlay` 는 그 넷을 끝까지 돌리는 **얇은 껍데기**로 남아 있다 — 미리 다 계산해도 되는
 * 자리(CPU 경기·미션)는 그대로 부르면 되고, 결과는 쪼개기 전과 **한 톨도 다르지 않다**.
 *
 * `entities/fielding` 에 따로따로 들어와 있는 조각들을 여기서 한 줄로 잇는다:
 *   포구 예보(0xb12d0 · 0xb3b38) → 송구 목표 루(0xafb24) → 송구 도착 틱(0xaf284) →
 *   자동 추가 진루(0xaf918) → 2아웃 득점 보류(state[0]).
 *
 * ## 무엇이 무엇을 정하는가 (중요)
 * **원본처럼 이 판이 다 정한다.** 타석 판정(0x51408)은 덱에서 뽑은 패턴을 그대로 쏠 뿐이고(메시지 0x11 → 51188),
 * 타자주자도 다른 주자처럼 포구 예보 · 아웃 판정 0xb36d0(1루 포스 · 태그 · 쥐는 순간의 뜬공 아웃) · 자동 진루 0xaf918 로
 * 움직인다. 판이 끝나면 판 끝 정산 0xa8024 의 타자 갈래(`playOutcome`)가 사건(6 안타 · 8 홈런 · 0xd 아웃)과 타자주자 칸
 * (+0x7c · +0x84 · +0x8c)으로 기록할 결과를 낸다 — `DefensePlayResult.outcome`.
 * (예전 웹은 타석 결과 코드를 먼저 정하고 그에 맞춰 예보 구간 자르기 · 타자주자 최소 루 · 1루 송구 도착 틱 아웃 ·
 * 타자주자 판정 빼기 같은 다리를 걸었다. 2026-10-07 에 모두 걷었다.)
 *
 * 타구 궤적은 `entities/batting/model/battedBallFlight` 가 원본 물리 세계 0xbfed0 대로 미리 깐 점이다
 * (점마다 속도·수직 속도·각·바운드 표시, 사건 틱 aa0 · aa4 · aa8 · ab0).
 */
export type { DefensePlayInput } from '@/features/defense-play/model/defensePlay/types/defensePlayInput'
export { framePressesOf, type DefenseKeyPress, type DefensePlayControls } from '@/features/defense-play/model/defensePlay/types/defenseKeyPress'
export type { DefensePlayResult } from '@/features/defense-play/model/defensePlay/types/defensePlayResult'
export type { DefensePlayState, DefenseTickSound } from '@/features/defense-play/model/defensePlay/types/defensePlayState'
export { defenseAbilitiesOf, defenseFielderPlatesOf, defenseSkillIdsOf } from '@/features/defense-play/model/defensePlay/lineup/defenseLineup'
export { isBattedBallInPlay } from '@/features/defense-play/model/defensePlay/result/battedBallInPlay'
export { isBallBeyondFence } from '@/features/defense-play/model/defensePlay/ball/ballPoint'
export { preRollContactMessage, type ContactMessageRoll } from '@/features/defense-play/model/defensePlay/start/contactMessage'
export { startDefensePlay } from '@/features/defense-play/model/defensePlay/start/startDefensePlay'
export { acceptsFastForwardKey, isDefensePlayFinished } from '@/features/defense-play/model/defensePlay/step/playFinished'
export { stepDefensePlay } from '@/features/defense-play/model/defensePlay/step/stepDefensePlay'
export { defensePlayResultOf } from '@/features/defense-play/model/defensePlay/result/defensePlayResultOf'
export { recordedOutcomeOf, runDefensePlay, withPredictedOutcome } from '@/features/defense-play/model/defensePlay/result/runDefensePlay'
export { cpuSpecialThrowOf } from '@/features/defense-play/model/defensePlay/throw/cpuSpecialThrow'
