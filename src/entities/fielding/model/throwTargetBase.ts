/**
 * CPU 송구 목표 루 고르기 **0xafb24** (제어기 vt 0x14) — S7 2·3·4절에서 식까지 확정된 그대로 옮긴다.
 *
 * 루 4칸짜리 후보표(0x30바이트)를 채워 `루 기본 점수 0xd85ac` 에 "확실한 아웃이면 100000 + 여유,
 * 아니면 10000"(홈이면 각각 +10000000 / +1000000)을 얹고, 첫 루 항에 2배 가중을 준 뒤
 * `2×첫 루 항 + 둘째 루 항 + 500` 과 기본 점수 합을 더해 최댓값을 고른다.
 *
 * 인자 하나(S7 이 "난이도" 라 부른 값 — 실제로는 **지금 아웃 수**, `ThrowTargetInput.outs` 주석)는
 * `인자 + 유효 > 2` 한 곳에서만 쓰인다: 크면 "여유가 가장 큰 루"(안전한 아웃), 작으면 점수식(= 앞 루 욕심)으로 간다.
 *
 * 공개 이름 모음 — 하위 폴더 (`throwTargetBase/`): `types`(후보표 · 입력 · 점수판) · `forcedRunner`(vt 0x80 0xb1b54) ·
 * `candidates/`(후보표 채우기 2절 · 수비 틱과 1루 예외 2-4 · 2-6 · 재송구 틱 2-5 B-60) · `score/`(루 항 3-1 · 주자 보정 3-2 ·
 * 병살 상대 3-3) · `chooseBase`(고르기 3-4) · `describe`(0xafb24 차례) · `specialThrow`(홈 특수 송구 0xafa60 · 0xb1268)
 */
export { isForcedRunner } from '@/entities/fielding/model/throwTargetBase/forcedRunner'
export type { ThrowTargetInput } from '@/entities/fielding/model/throwTargetBase/types'
export { chooseThrowTargetBase, describeThrowTarget } from '@/entities/fielding/model/throwTargetBase/describe'
export { baseAtPoint, HOME_SPECIAL_THROW_PERCENT, isSpecialThrow } from '@/entities/fielding/model/throwTargetBase/specialThrow'
