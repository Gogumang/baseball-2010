/**
 * 팀 경기 상태 고리가 쓰는 **다른 조각** — 타석 결과 대기 틱 0x12(`pages/game` — 타자편 화면과 같은 원본 셈 0x4e6d4).
 * 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다(`lint.boundaries-baseline.js` 의 예외는 이 파일 하나).
 */
export { resultWaitTicksOf } from '@/pages/game/lib/batterRecordAlert'
