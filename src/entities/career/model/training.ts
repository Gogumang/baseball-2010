/**
 * 타자 훈련 (binary.mod 0x17f5c — 누락 탐색 4·5차).
 * 능력치 칸 0~3 (0xa3bac 종류 0~3):
 *   난수는 원본 bfa55(a, b) = [a, b) 정수다 (점검 10차) — 표기 4~7 은 실제로 4·5·6
 *   상승   bfa55(4,7), 수비·주루는 bfa55(5,8) (0x186e0) + 타입 보너스 +1 (StrMODE[194])
 *          스킬 0 병아리 +1 (사기 −1, StrMODE[201]) · 스킬 3 몹쓸몸 −2 (사기 +2, StrMODE[202]) — 0x1891c·0x1898e
 *   사기   bfa55(5,8) 만큼 떨어진다 (0x186c4). G포인트·소지금은 들지 않는다
 *   막힘   사기 0 (StrMODE[193]) · 능력치가 타입 한계치 이상 (StrMODE[192], 0x12e40 — 장비·스킬 보정 전 값)
 *          실제 상승은 999 로만 자르므로 한계 직전이면 한 번은 넘을 수 있다 (원본 동작)
 * 필살타법 칸 4 (0xa3bac 종류 4):
 *   레벨마다 필요 횟수 4/5/6/7 (0xd7e92) · 한 번에 G포인트 500/700/900/1200 (0xd80e1)
 *   사기 bfa55(9,13), 병아리(스킬 0) −1 · 몹쓸몸(스킬 3) +2
 * 서브 아이템: 표적판 등 훈련 +2 (StrITEM[148]) · 자동안마기 사기 감소 −1 (StrITEM[149], +0x5c)
 *
 * 공개 이름 모음 — 하위 폴더 (`training/`): `types`(메뉴 · 결과 꼴) · `specialSwingSlots`(필살타법 창 0x17828 · 비용 0xcc3e6 · 인기도 0xcc3ea) ·
 * `modifiers`(병아리 · 몹쓸몸 · 자동안마기) · `abilityTraining`(능력치 칸 0~3) · `specialSwingTraining`(필살타법 칸 4) · `run`(막힘 · 실행) ·
 * `otherSlices`(다른 조각)
 */
export { type TrainingBlockReason, type TrainingMenu, type TrainingOutcome } from '@/entities/career/model/training/types'
export {
  SPECIAL_SWING_MAXIMUM_LEVEL,
  SPECIAL_SWING_REQUIRED_POPULARITY,
  specialSwingCostOf,
  specialSwingSlotBlockOf,
  specialSwingSlotCostOf,
} from '@/entities/career/model/training/specialSwingSlots'
export { blockReasonOf, runTraining } from '@/entities/career/model/training/run'
