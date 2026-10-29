/**
 * 원본 파티클 이미터 — `ptc/%03d.ptc` 51바이트 한 벌 (R5 8절 확정).
 *
 * 옮긴 코드: 입자 만들기 `0x6d56c` · 입자 갱신 `0x6d878` · 이미터 틱 `0x6dad0` · 정리 `0x6dc08` · 공용 풀 `0x6d07c`(512).
 * 파일 51바이트는 `0x6d2b4` 가 이미터 `+0x24..` 에 그대로 memcpy 하므로 칸 이름은 파일 배치 그대로다.
 *
 * 단위 (R5 8절):
 *   - `spd`·`spdR`·`ax`·`ay` 와 속도·누적 오프셋은 **1/512 px** 눈금이다 (px = 값/512).
 *   - `a0`·`a1` 과 A 는 16.16 고정소수. 그리기에는 `A >> 8` (0~256) 으로 넘어간다.
 *   - `ang`·`spread` 는 도(°)이고 화면 y 가 아래라 0=오른쪽·90=아래·180=왼쪽·270=위.
 *
 * 공개 이름 모음 — 하위 폴더 (`particleEmitter/`): `types`(설정 51바이트 · 입자 · 풀 0x6d07c · 이미터) · `spawn`(세우기 0x6d32c ·
 * 입자 만들기 0x6d56c) · `tick`(갱신 0x6d878 · 틱 0x6dad0 · 정리 0x6dc08 · 그리기 값 0x6dc4c)
 */
export {
  createParticlePool,
  type EmitterState,
  type ParticleConfig,
  type ParticleEmitter,
  type ParticlePool,
} from '@/entities/particle/model/particleEmitter/types'
export { createEmitter } from '@/entities/particle/model/particleEmitter/spawn'
export { drawStrengthOf, particlePixelOf, releaseEmitter, tickEmitter } from '@/entities/particle/model/particleEmitter/tick'
