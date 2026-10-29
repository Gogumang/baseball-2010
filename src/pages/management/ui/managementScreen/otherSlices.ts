/**
 * 관리 화면이 쓰는 **다른 조각** — 기록실 팝업 · 124 목록(`pages/nari-record-room`) · 공 무늬 바탕(`pages/special`).
 * 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다(`lint.boundaries-baseline.js` 의 예외는 이 파일 하나).
 */
export { NariRecordPickPopup, NariRecordView, type RecordRoomPick } from '@/pages/nari-record-room'
export { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
