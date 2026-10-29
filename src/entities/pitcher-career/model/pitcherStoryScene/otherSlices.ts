/**
 * 투수편 이벤트 고르기가 쓰는 **다른 조각**(`entities/story` — 질병 확률 · 쿨다운 · 장소 trigger · 선행 이벤트 · 오프닝 · 연초 이벤트)의 값 —
 * 판정 0xacfbc 가 두 편 공용이라 같은 함수를 쓴다. 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다
 * (`lint.boundaries-baseline.js` 의 cross-slice 예외는 이 파일 하나).
 */
export {
  illnessChanceOf,
  isIllnessCooldownBlocked,
  NARI_YEAR_START_EVENT,
  NARI_YEAR_START_EVENT_ID,
  OPENING_EVENT_ID,
  placeTriggerOf,
  requiredEventIdOf,
} from '@/entities/story/model/storyScene'
