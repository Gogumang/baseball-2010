/**
 * 송구 계획 0xb3444 (플레이 vt 0x8c) 와 송구 도착 틱 (야수 vt 0xbc = 0xa1adc).
 * 설정값은 d_level.dat (cfg = 파일 + 4) 에서 온다 — S7 5-2 에서 실측으로 확정된 값들이다.
 *
 * 공개 이름 모음 — 하위 폴더 (`throwPlan/`): `constants`(cfg 준비 틱 · 중계 문턱 · 중력 배율) ·
 * `flight/`(역사인 0xbfab0 · 도착 틱 0xa1adc · 악송구 0xa1620 a1868~a1908 · 긴 송구 흔들림 a198c · 쏘기 값 · 원바운드 · +0xdc) ·
 * `plan/`(송구 계획 0xb3444 · 중계맨 0xaf4f8 · 루 좌표 중계 0xaf284)
 */
export {
  INFIELD_READY_TICKS,
  OUTFIELD_READY_TICKS,
  readyTicksOf,
  RELAY_DISTANCE,
  THROW_COEFFICIENT_INFIELD,
  THROW_COEFFICIENT_OUTFIELD,
  throwGravityPercentOf,
} from '@/entities/fielding/model/throwPlan/constants'
export { throwTicksTo, throwTicksToFielder } from '@/entities/fielding/model/throwPlan/flight/throwFlight'
export { errantThrowFlight } from '@/entities/fielding/model/throwPlan/flight/errantThrow'
export { rollLongThrowWobble, wobbledThrowFlight } from '@/entities/fielding/model/throwPlan/flight/longThrowWobble'
export {
  bounceThrowLaunchOf,
  LASER_THROW_SPEED,
  throwLaunchOf,
  thrownWith,
  type ThrowLaunch,
} from '@/entities/fielding/model/throwPlan/flight/launch'
export { planThrow, type ThrowPlan } from '@/entities/fielding/model/throwPlan/plan/planThrow'
export { chooseRelaySlot, relayTicksToBase } from '@/entities/fielding/model/throwPlan/plan/relay'
