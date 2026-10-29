/**
 * 투수편 **관리 주기·훈련** — 타자편과 다른 점만 모았다.
 *
 * **같은 것** (한 코드가 모드 3·4 를 함께 돈다):
 *   - 관리 화면은 **2경기마다** 열린다 (StrHOWTO[11] · 관리 장면 상태 116, R9 요약).
 *   - 한 주기에 트레이닝·휴식·외출 중 **한 가지**만 (r_event_txt[176]).
 *   - 훈련 함수 `0x17f5c` 하나가 두 모드를 돈다. 칸 0~3 은 0x186c4 로 가서 **사기 감소 bfa55(5,8) 를 먼저**
 *     ([sp+0x38]) 굴리고 **상승을 다음**([sp+0x34], 0x18704) 굴린다 — 타자편과 같은 차례다.
 *   - 사기 0 이면 막힘 StrMODE[193] · 능력치가 한계면 StrMODE[192] (0x12e40).
 *
 * **다른 것** (0x17f5c 안의 `[장면+0xcc] == 4` 갈림, 디스어셈 확정):
 *   - 능력 칸이 제구·구속·변화·체력이고, **한계 표를 보직으로 고른다** (0xa44f4, R7 3절).
 *   - 상승 범위 (0x186d6~0x18702): 타자는 칸 2·3(수비·주루)이 bfa55(5,8) 인데, 투수는 **칸 3(체력)만** (5,8) 이고
 *     칸 0·1·2 는 (4,7) 이다.
 *   - 타입 보너스 +1 (0x18786~0x187a6): 투수는 칸 0(제구)·타입 1 · 칸 1(구속)·타입 0 · 칸 2(변화)·타입 2.
 *     타입 = 기록 `+0xb >> 5` (등록 시작 보너스 `PITCHER_TYPE_BONUS_ABILITY` 와 같은 짝). 글은 "[타입 이름] 타입 보너스 +1"
 *     (이름 = 표 0x1400080 [2 + 타입] 오버핸드·사이드암·언더스로, StrMODE[194]).
 *   - 훈련 **칸 4** 가 필살타법 창(상태 0x6c)이 아니라 **상태 0x78** 을 연다 (0x12dc0, R7 4절 149행) —
 *     그 창에 마구(필살 창 탭 0·1 의 투수 쪽)와 **구질 훈련**(`pitchTraining.ts`)이 함께 있다.
 *
 * 공개 이름 모음 — 하위 폴더 (`pitcherManagement/`): `menus`(훈련 칸 · 타입 이름) · `magic/`(108 마구 창 칸 0x17828) · `block`(막힘) ·
 * `training/`(결과 꼴 · 사기 보정 · 능력치 · 마구 · 구질 훈련 · 고르기) · `text/`(알림 글) · `counts/`(훈련 수 0x18a80 · 해제 카운터 0x18b5a) ·
 * `cycle`(2경기 주기) · `otherSlices`(다른 조각)
 */
export { PITCHER_TRAINING_MENUS, type PitcherTrainingMenu } from '@/entities/pitcher-career/model/pitcherManagement/menus'
export {
  MAGIC_MAXIMUM_LEVEL,
  MAGIC_REQUIRED_POPULARITY,
  magicTrainingCellBlockOf,
  magicTrainingCellCostOf,
  magicTrainingCursorOf,
} from '@/entities/pitcher-career/model/pitcherManagement/magic/magicCells'
export { pitcherTrainingBlockReasonOf, type PitcherTrainingBlockReason } from '@/entities/pitcher-career/model/pitcherManagement/block'
export type { PitcherTrainingOutcome } from '@/entities/pitcher-career/model/pitcherManagement/training/types'
export { runPitcherTraining } from '@/entities/pitcher-career/model/pitcherManagement/training/runPitcherTraining'
export { runPitchTypeTraining } from '@/entities/pitcher-career/model/pitcherManagement/training/pitchTypeTraining'
export {
  magicTrainingLinesOf,
  pitchTypeTrainingLinesOf,
  pitcherAbilityTrainingLinesOf,
} from '@/entities/pitcher-career/model/pitcherManagement/text/trainingLines'
export {
  countPitcherTraining,
  seasonPitcherTrainingCountOf,
  seasonPitcherTrainingTotalOf,
} from '@/entities/pitcher-career/model/pitcherManagement/counts/trainingCounts'
export { countReleaseTrainingStreak } from '@/entities/pitcher-career/model/pitcherManagement/counts/releaseStreak'
export { gamesUntilManagementOf } from '@/entities/pitcher-career/model/pitcherManagement/cycle'
