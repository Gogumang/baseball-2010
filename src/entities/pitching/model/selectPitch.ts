/**
 * **CPU 투구** — 상태 0xf 틱 0~8 의 구질 0x344dc · 0x10 틱 6 의 목표 0x345fc(또는 견제 0x34848) · 0x11 틱 10 의 놓기 0x4dc78.
 *
 * 공개 이름 모음 — 하위 폴더 (`selectPitch/`): `types`(상황 · 투구 · 견제 · 재료 꼴) · `select`(한 번에 고르기) ·
 * `tickRolls`(틱마다 구질 · 목표 · 교체 틱 굴림) · `release`(놓기 0x4dc78 · 곡선 0x9e3c9) · `releaseStats`(체력 0xa5e14 · 제구 등급
 * 0x4dbac · 실투 0x33cbc) · `windUp`(와인드업 공 자리) · `pitchFace`(기본 레퍼토리 · 공 이름 · 존 자리) · `flight`(사람 투구 비행 시간) ·
 * `otherSlices`(다른 조각)
 */
export type { CpuPitchArgs, CpuPitchChoice, PitchSituation } from '@/entities/pitching/model/selectPitch/types'
export { DEFAULT_REPERTOIRE } from '@/entities/pitching/model/selectPitch/pitchFace'
export { selectPitch } from '@/entities/pitching/model/selectPitch/select'
export {
  CPU_PITCH_TYPE_TICKS,
  cpuPitchAimOf,
  cpuPitchTypeTickOf,
  rollCpuPitchTypeOnPitcherChangeTick,
} from '@/entities/pitching/model/selectPitch/tickRolls'
export { releaseCpuPitch } from '@/entities/pitching/model/selectPitch/release'
export { windUpCpuPitchOf } from '@/entities/pitching/model/selectPitch/windUp'
export { flightMillisecondsOf } from '@/entities/pitching/model/selectPitch/flight'
