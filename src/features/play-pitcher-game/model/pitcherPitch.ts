/**
 * 투수편에서 **사람이 던지는 한 개의 공** (P1 3절 스태미나 · 4절 게이지, 궤적은 원본 표 그대로).
 *
 * 원본 순서(0x50da8 구질 → 0x50e9c 코스 확정 → 0x50e08 게이지 OK → 0x4dc78 투구)를 따른다.
 *   1. 구질 칸 6개 중 하나 (칸 5 = 마구, 남은 횟수가 0 이면 못 고른다 — 0x50db8)
 *   2. 조준점 (0x10 — 방향키로 흐르는 점, `pitchAim`)
 *   3. 게이지 등급 t (0~5). 게이지를 끄면 제구·체력 확률표 0xd896c 로 뽑는다 (0x4dbac)
 *   4. t 로 능력치 배율(70~110%)과 제구 흩어짐 표 0xcfd60 을 먹인 뒤 궤적 레코드를 고른다
 *
 * ⚠️ 궤적 물리 루프(0xb3b38·0xb401c)는 이 저장소에서 해독하지 않는 주제다. 여기서는 원본
 * `pitch.zt1` 레코드를 읽는 기존 `entities/pitching/model/pitchCurve` 를 그대로 부른다.
 *
 * 하위 폴더 (`pitcherPitch/`): `types` · `slots`(구질 칸 0xb6d2c) · `grade`(등급 t 0x4dbac · 게이지) · `zone`(존 표 0xcfb7c · 0xcfb54) ·
 * `pitchPath`(궤적 레코드 0x9e669) · `humanPitch`(사람 투구 0x4dc78) · `mistakePitch`(실투 0x4dec0) · `stamina`(소모 0xa5e14 · 피로 0xb58e6)
 */
export type { PitcherRepertoire, PitcherStats, PitchSlot } from '@/features/play-pitcher-game/model/pitcherPitch/types'
export { canSelectSlot, PITCH_SLOT_COUNT, pitchSlotsOf } from '@/features/play-pitcher-game/model/pitcherPitch/slots'
export { GAUGE_CELL_COUNT, pitchGradeOf } from '@/features/play-pitcher-game/model/pitcherPitch/grade'
export { buildHumanPitch } from '@/features/play-pitcher-game/model/pitcherPitch/humanPitch'
export { mistakeHumanPitchOf } from '@/features/play-pitcher-game/model/pitcherPitch/mistakePitch'
export { drainStamina, fatiguedStatsOf } from '@/features/play-pitcher-game/model/pitcherPitch/stamina'
