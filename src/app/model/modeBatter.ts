import type { BatterAbility } from '@/entities/batting/model/batter'
import { ROOKIE_BATTER_ABILITY } from '@/entities/batting/model/batter'
import { equippedAbilityOf } from '@/entities/career/model/condition'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'

/**
 * **미션(모드 5·6)·홈런더비(모드 7)에서 치는 육성 타자.**
 *
 * 원본은 이 모드로 들어갈 때 `0x213c0(앱, 4, 0)` 으로 나만의리그 **타자편 저장**(칸 4)을 올린다
 * (모드 6 은 0x213c0 안에서 4 로 바뀐다 — H-modes · Q2 1-0). 그래서 지금 진행 중인 커리어가 없어도
 * 저장된 선수가 친다 — 부르는 쪽은 `career ?? savedCareer` 를 넘긴다.
 *
 * 능력치는 **0xb6414 = `equippedAbilityOf`** (장비·스킬까지) 다. 경기 능력치 `0xb570c` 의
 * 질병·부상·사기 감소(0xb574a~0xb5802)는 **모드 3·4 에서만** 돈다 —
 *   0xb5734~0xb5748: `[0x1552d10]`(모드) == 2 → 0xb5804(모드 2 갈래) · 3·4 → 0xb574a(감소) ·
 *   < 2 또는 > 4 → 곧장 0xb58e6 (피로 단계)
 * 모드 5·6·7 은 감소 없이 피로로 건너뛰고, 타자 쪽 피로 인자는 54 를 넘어 그대로이며,
 * 팀 능력치(0xb592c)는 모드 1·2·8·9 만이라 결과가 0xb6414 와 같다.
 * 앞서 웹은 `effectiveAbilityOf`(감소 포함)를 써서 아프거나 사기가 낮은 선수가 미션·홈런더비에서 약해졌다.
 *
 * 스킬은 선수 기록 +0x14 의 **장착** 비트(0xb62b4)를 그대로 본다 — 저장을 올리니 장착 스킬이 그대로 산다
 * (압도 22: 실투율 +5 0x33d52 · 투구 소모 ×2 0xa5f0e, 스윙 스킬 등). 모드를 가리는 갈래는 없다.
 *
 * 선수가 없으면(저장을 불러오는 짧은 순간) 신인 능력치·스킬 없음 — 원본에는 이 대체가 없다
 * (미션·홈런더비 진입은 선수가 있을 때만 열린다, EntryRoutes · Q2 3-1).
 */
export interface ModeBatter {
  readonly ability: BatterAbility
  /** 장착 스킬 id (`career.equippedSkillIds`) — 타석 화면 `batterSkillIds` 로 간다 */
  readonly skillIds: readonly number[]
}

export function modeBatterOf(career: PlayerCareer | null): ModeBatter {
  if (career === null) return { ability: ROOKIE_BATTER_ABILITY, skillIds: [] }
  return { ability: equippedAbilityOf(career), skillIds: career.equippedSkillIds }
}
