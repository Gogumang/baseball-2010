import type { PlayerCareer } from '@/entities/career/model/playerCareer/types/playerCareer'

/** 보유 비트(+0x1b8) — 0xa3a74. 칭호·엔딩·연속 기록·경기 뒤 카운터처럼 **보유** 를 보는 곳이 쓴다 */
export function hasSkill(career: PlayerCareer, skillId: number): boolean {
  return career.skillIds.includes(skillId)
}

/**
 * 장착 비트(선수기록 +0x14) — 0xa4bf8 / 0xb62b4. 경기 스킬 효과(0xab214·0xb6414)·훈련 상승(0x17f5c 의 0)·
 * 행운(6: 부상 0x1b4c4 · 질병 0xadbb8 · 사기 0xa741c) 처럼 **장착** 을 보는 곳이 쓴다.
 */
export function isSkillEquipped(career: Pick<PlayerCareer, 'equippedSkillIds'>, skillId: number): boolean {
  return career.equippedSkillIds.includes(skillId)
}

/** 플러스 스킬 장착 상한 표 0xd7e8e (= UI 쪽 0xcc4f4) — 슬롯 단계 L 0·1·2 */
export const PLUS_SKILL_SLOT_LIMITS: readonly number[] = [6, 8, 10]
/** 장착 수 세기 0xa4aa4 가 도는 번호 범위 0~23 (`cmp r4,#0x17`) */
const LAST_COUNTED_SKILL_ID = 23

/**
 * 마이너스 스킬인가 — 0x5f350(표, s) 비트1. 디스어셈(확정):
 *   s ≤ 1 → 1 · s−8 ≤ 8(8~16) → 1 · s−2 ≤ 3(2~5) → **2** · s−17 ≤ 3(17~20) → **2** · 나머지(6·7·21~) → 4
 *   (여기에 s ≤ 7 이면 0x10, 아니면 0x20 을 OR). 그래서 19·20 도 마이너스다 — 표 0xd7e10 = [2,3,4,5,17,18,19,20] 과 같은 묶음.
 * 쓰는 곳이 둘로 갈리지만 묶음은 같다:
 *   0x5f350 비트1 — 장착 수 0xa4aa4 · 장착 동작 0xa4b04(상한 건너뜀) · 최면요법 효과 0xa4970 · 장착 창 해제불가(H-modes 6절)
 *   표 0xd7e10 — 해제 플래그 0xa43fc/0xa4f30(+0x1d0+k) · 최면요법 가드 0xa4f00(보유 수)
 * 모드 3(투수편)도 같은 함수들을 탄다(0x5f350 에 모드 갈림이 없다).
 */
export function isMinusSkill(skillId: number): boolean {
  return MINUS_SKILL_IDS.includes(skillId)
}

/** 지금 단계의 플러스 스킬 장착 상한 (0xd7e8e[+0x1c6]) */
export function plusSkillSlotLimitOf(career: Pick<PlayerCareer, 'skillSlotLevel'>): number {
  return PLUS_SKILL_SLOT_LIMITS[career.skillSlotLevel] ?? PLUS_SKILL_SLOT_LIMITS[0]
}

/** 장착한 플러스 스킬 수 — 0xa4aa4: 번호 0~23 중 장착이고 마이너스가 아닌 것만 센다 */
export function equippedPlusSkillCountOf(career: Pick<PlayerCareer, 'equippedSkillIds'>): number {
  return career.equippedSkillIds.filter((id) => id <= LAST_COUNTED_SKILL_ID && !isMinusSkill(id)).length
}

/**
 * 장착 동작 0xa4b04(P, s, on) — **켜기는 이 함수에서만** 일어난다 (0xb663c 호출지는 여기 둘뿐).
 *   on = false → 0xb66dc: 장착만 끈다 (보유는 그대로)
 *   on = true  → 플러스 스킬이고 `상한 ≤ 장착 수` 면 아무 일도 안 한다(못 낌).
 *                **마이너스 스킬은 상한을 안 본다** — 늘 장착된다. 이미 켜져 있으면 그대로(0xb663c 가 0 반환).
 * 보유 여부는 보지 않는다 — 부르는 쪽(획득 0xa4bd8 · 창 0x147b0)이 맞춘다.
 * 모드 3(투수편)도 같은 함수를 탄다 — 갈림은 팀 칸 고르기(모드 4 0xb53d1 · 모드 3 0xb51fd(팀, 0))뿐이라 칸 꼴만 받는다.
 *
 * 원본은 켤 때 통계 기록 `[mgr+0xc8]` 의 +0xf4(모드 4)·+0xf8(모드 3) 에도 같은 비트를 OR 한다 — "한 번이라도 켠 스킬",
 *    읽는 곳은 전부 수집 보상 k=5(0x28f8a)와 기록연감 스킬 탭 표 0x58a3c 둘이다. 저장 칸·함수는 `collection/model/annalsStats.ts`
 *    (`markSkillEquipped`), 부르는 자리는 세션의 장착 비교 효과 · 등록(`skillEquipStatEventsOf`)이다.
 * ⚠️ 모드 4 면 팀 로스터 칸(0xb53d1)에도 켠다(같은 칸인지 유력).
 */
export function setSkillEquipped<T extends Pick<PlayerCareer, 'equippedSkillIds' | 'skillSlotLevel'>>(career: T, skillId: number, on: boolean): T {
  if (!on) {
    if (!isSkillEquipped(career, skillId)) return career
    return { ...career, equippedSkillIds: career.equippedSkillIds.filter((id) => id !== skillId) }
  }
  if (!isMinusSkill(skillId) && plusSkillSlotLimitOf(career) <= equippedPlusSkillCountOf(career)) return career
  if (isSkillEquipped(career, skillId)) return career
  return { ...career, equippedSkillIds: [...career.equippedSkillIds, skillId] }
}

/**
 * 장착 칸이 없는 옛 저장의 장착 칸 다시 세우기 — 웹에는 장착 창이 없었으므로 그동안의 장착은 **모두
 * 획득 때의 자동 장착(0xa4bd8 → 0xa4b04(P,s,1))** 뿐이었다. 그래서 보유 목록(얻은 차례)을 슬롯 단계 0 에서
 * 차례로 다시 자동 장착하면 원본이 그 선수에게 남겼을 장착과 같다.
 * 이사가 되살릴 수 없는 한 경우(옛 저장에 이력이 없다, r278 다시 봤다): 플러스 스킬이 상한을 넘겨 못 낀 뒤 앞선 플러스 스킬이 보상으로 지워진 경우 —
 *    원본은 빈자리를 다시 채우지 않지만 이 재구성은 채운다. r244 에서 원본을 다시 떴다: 제거 0xa4430 은 보유 비트 S+0x1b8 을
 *    끄고(a4440~a444e) `0xb66dd(레코드, s)` 로 그 스킬 장착만 끈 뒤 `0xa43fc(P, s, 1)` 해제 기록을 남길 뿐, 못 낀 스킬을 다시
 *    켜는 곳이 없다 — 살아 있는 길(`applySkillReward` → `setSkillEquipped`)은 그대로 원본과 같다. 어긋남은 장착 칸(+0x14)이 없던
 *    옛 저장을 불러올 때 한 번뿐이고, 그 저장에는 "어느 스킬이 상한에 막혔다가 앞 스킬이 지워졌는가" 가 남아 있지 않아 되살릴 수 없다.
 */
export function rebuildEquippedSkillIds(skillIds: readonly number[]): readonly number[] {
  let equipped: Pick<PlayerCareer, 'equippedSkillIds' | 'skillSlotLevel'> = { equippedSkillIds: [], skillSlotLevel: 0 }
  for (const id of skillIds) {
    if (!isMinusSkill(id) && plusSkillSlotLimitOf(equipped) <= equippedPlusSkillCountOf(equipped)) continue
    if (!equipped.equippedSkillIds.includes(id)) equipped = { ...equipped, equippedSkillIds: [...equipped.equippedSkillIds, id] }
  }
  return equipped.equippedSkillIds
}

/** 마이너스 스킬 (표 0xd7e10) — 한 번 해제하면 다시 얻을 수 없다 */
export const MINUS_SKILL_IDS: readonly number[] = [2, 3, 4, 5, 17, 18, 19, 20]
