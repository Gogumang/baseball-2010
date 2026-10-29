/**
 * 투수편 경기 상태 고리가 쓰는 **다른 조각** — 타석 결과 대기 틱 0x12(`pages/game` — 타자편과 같은 원본 셈 0x4e6d4)와 진행 소리
 * (`pages/team-game` — 공수 교대 13 · 돌발 42/36/37 · CPU 대타 22 → 등판음. 같은 경기 장면 0x104 라 규칙이 하나다 — 팀경기 쪽 것을
 * 그대로 빌린다). 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다(`lint.boundaries-baseline.js` 의 예외는 이 파일 하나).
 */
export { resultWaitTicksOf } from '@/pages/game/lib/batterRecordAlert'
export { pinchHitSoundIdsOf, stepSoundIdsOf } from '@/pages/team-game/model/teamGameSounds'
