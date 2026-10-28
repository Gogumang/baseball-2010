import { aceLeveledAbility } from '@/features/play-team-game/model/teamGameRoster'
import { FULL_STAMINA, staminaCapacityOf, staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { ourTeamMoraleOf } from '@/features/play-team-game/model/teamGameFlow/context/abilityContext'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * **교체 화면 상세 창의 능력치 네 칸** — 원본은 교체 목록이 아니라 '0' 키로 여는 **상세 창**에서만
 * 능력치를 적는다. 그 값은 **`0xb6414(레코드, 칸, 1)`** 이고 경기용 `0xb570c` 를 거치지 않는다 (직접 떴다):
 * ```
 * 0x384b8 그리기 → 0x37e5c 벤치 목록 끝 (0x38420~0x38468):
 *   투수 교체면 rec = 0xb8b09(scene[0x224], 커서), 종류 3 · 대타면 rec = 0xb8b19(scene[0x220], 커서), 종류 2
 *   0x5b798(skin, 종류, rec)              ; skin+0x424('0' 키 상세 창)가 꺼져 있으면 바로 빠진다 (5b7a8)
 * 0x5b798 → 0x5aefc(…, [sp]=종류, [sp+4]=rec, …, [sp+0x18]=0)   ; 5b86a(종류 2) · 5bfbe(종류 3)
 * 0x5aefc 종류 2 (5b1aa) · 종류 3 (5b294): 칸 0..3 마다
 *   ctx([sp+0x198]) ≠ 0 이면 0xb570c(ctx, 칸, rec, 0x5a, 1) — **교체 창은 늘 0 을 넘긴다**
 *   그 밖 0xb6414(rec, 칸, 1) → 막대 값 · 0xb6414(rec, 칸, 0) → 기본 값
 * ```
 * 곧 마선수 레벨 배율(0xd88aa) → 장비(+0x19 니블) → 장착 스킬 보정까지이고, 시즌 질병·보직·사기·
 * 팀 능력치·코치(0xb570c 쪽)는 **안 먹는다**. 웹 팀 경기 명단에는 장비 니블도 스킬 비트(+0x14)도 없어
 * (`TeamEntryBatter` · `TeamEntryPitcher`) 남는 것은 **레벨 배율 하나**다 — 마선수가 아니면 명단 값 그대로.
 *
 * 목록 줄(`0x37904` 현재 선수 · `0x37e5c` 벤치)에는 능력치가 없다: 이름 · 보직/수비 아이콘 ·
 * 방어율(0xb6ce9)/타율(0xb8e3d) · 탈삼진(+0x26)/홈런(+0x28) 넷이고 두 함수 모두 0xb570c·0xb6414 를 안 부른다 (R4 1b).
 *
 * @param kind '투수' 면 우리 투수 명단 칸, '대타' 면 우리 타자 명단 칸
 * @returns 제구·구속·변화·체력 / 히트·파워·수비·주루. 칸이 없으면 null
 */
export function substitutionDetailAbilities(
  progress: TeamGameProgress,
  kind: '투수' | '대타',
  index: number,
): readonly [number, number, number, number] | null {
  const player = kind === '투수' ? progress.ourPitcherEntry[index] : progress.ourEntry[index]
  if (player === undefined) return null
  return aceLeveledAbility(player.ability, kind === '투수' ? '투수' : '타자', player.aceIndex, progress.options.aceLevels)
}

/**
 * **교체 창 이름 칸의 체력 줄 재료** — `0x571d8(skin, 0xb8680(팀), rec, 칸, 투수)`(37a7a · 381c6, 직접 떴다):
 * ```
 * M = 0x66e44(팀 레코드, rec, 0)             ; 첫 투수 보너스 없이 — 사기 보정 체력 + 250
 * S = 모드 ∈ {1,2,3,4,8,9}(0x31e) ? trunc(rec+0x2c / 100) : 100
 * ```
 * 우리 팀 투수 명단 칸 `index` 의 체력 칸(`0xb6414(rec, 3, 1)` — 상세 창과 같은 값)과 그 칸의 +0x2c 다 —
 * 지금 마운드 칸은 `stamina`, 그 밖은 `ourPitcherStaminas`(없으면 가득).
 */
export function substitutionStaminaOf(progress: TeamGameProgress, index: number): { readonly capacity: number; readonly percent: number } | null {
  const ability = substitutionDetailAbilities(progress, '투수', index)
  if (ability === null) return null
  const stamina = index === progress.ourPitcherIndex ? progress.stamina : (progress.ourPitcherStaminas[index] ?? FULL_STAMINA)
  return {
    capacity: staminaCapacityOf(ability[3], ourTeamMoraleOf(progress.options), false),
    percent: staminaPercentOf(stamina),
  }
}
