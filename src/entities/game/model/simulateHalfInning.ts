/**
 * 연출 없는 반 이닝 (원본 0xc2a48 이 하루치 다른 팀 경기를 돌릴 때 쓰는 길) — 공개 이름 모음.
 * 원본은 점수를 뽑는 공식을 두지 않고 **사람 경기와 같은 타석 엔진**을 3아웃까지 돌려 점수를 읽는다.
 * 여기서도 그렇게 한다 — 이닝 득점 확률표 같은 것은 원본에 없다. 하위 폴더 (`simulateHalfInning/`):
 *   - `types/` — 결과(0xa8024 재료) · 공격 명단(0xac228) · 수비 마운드(+0x27c 묶음) · 갈고리(0x8f158 · 0x8f414 · 0xb68fc) · 틱(0xc262c 한 번)
 *   - `defense/` — 마운드 투수의 체력% 능력(0xaebb0 · 0xb58e6) · 투수 교체(0xc1ba4 → 0xac428 → 0xabfcc → 0xaec64) · 공 하나 소모(0xa5e14)
 *   - `engine/` — 반 이닝 틱 고리: 교체 부름(0xc1ba4) → 타석 굴림(c26be~c271c) → 셈 · 투수 줄(0xa8ea4~)
 *   - `otherSlices` — 다른 조각(투수 · 투수편 · 타석 결과)에서 꺼내 쓰는 값을 한 곳에
 */
export type { HalfInningPlateAppearance, HalfInningResult } from '@/entities/game/model/simulateHalfInning/types/result'
export type { HalfInningDefense, HalfInningMound, HalfInningPitcherChange } from '@/entities/game/model/simulateHalfInning/types/defense'
export type { HalfInningTick } from '@/entities/game/model/simulateHalfInning/types/tick'
export { startingMoundOf } from '@/entities/game/model/simulateHalfInning/defense/mound'
export { facingPitcherOf, withQuickFightingSpirit } from '@/entities/game/model/simulateHalfInning/defense/facingPitcher'
export { changePitcherIfNeeded } from '@/entities/game/model/simulateHalfInning/defense/pitcherChange'
export { drainMoraleOf, drainPitcherForPitch, drainQuickPitcher } from '@/entities/game/model/simulateHalfInning/defense/stamina'
export { simulateHalfInning, simulateHalfInningTicks } from '@/entities/game/model/simulateHalfInning/engine/halfInning'
