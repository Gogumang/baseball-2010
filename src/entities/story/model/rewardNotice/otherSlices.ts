/**
 * 보상 알림이 쓰는 **다른 조각**(질병 이름 · 연봉 제시 · 구질 이름 · 히든 오픈 글)의 값 — 조각 경계를 넘는 import 를 이 파일 한 곳에
 * 모은다(`lint.boundaries-baseline.js` 의 cross-slice 예외는 이 파일 하나).
 */
export { ILLNESS_NAMES } from '@/entities/career/model/condition'
export { salaryOfferOf, type SalaryHolder } from '@/entities/career/model/seasonFlow'
export { pitchTypeNameOf } from '@/entities/pitcher-career/model/pitchTraining'
export { hiddenOpenNoticeTextOf as hiddenOpenWindowTextOf } from '@/entities/collection/model/hiddenOpenNotice'
