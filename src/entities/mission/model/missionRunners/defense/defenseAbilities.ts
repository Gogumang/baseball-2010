import { masterGameAbilityOf } from '@/entities/mission/model/missionCpuTeam'
import { missionDefenseFieldersOf } from '@/entities/mission/model/missionRunners/defense/fielders'
import { skillIdsOfBits } from '@/entities/mission/model/missionRunners/otherSlices'
import { DEFAULT_RUN_ABILITY, FIELDER_COUNT, type MissionDefenseSituation } from '@/entities/mission/model/missionRunners/types'

/** 경기용 칸 2 = 수비 */
const DEFENSE_SLOT = 2

/**
 * **수비 판의 아홉 칸 수비 능력치** — 플레이 vt20 `0xb0fb4` (상태 0x17 판 시작, 직접 재역어셈):
 * ```
 * b1018  칸 i = 0..8:
 * b1032    i == 0 → 선수 찾기를 건너뛴다(r5 = 0)
 * b103e    j = 0..팀+0x10 − 1:  레코드 = 0xb8a35(수비 팀, j) ; (레코드+0x1c & 0xf) − 1 == i 인 **첫** 레코드 (b1184 → 야수+0xec)
 * b106a    g = 선수 있으면 0xbbe98(0xb570d(ctx, 2, 선수, 90, 1)) + 1, 없으면 2
 * b10d0    팀 보너스는 전역 모드 1 · 2 · 8 · 9 만 — 미션(5 · 6)은 없다
 * ```
 * 수비 팀은 `팀[st[0xa]]` — 타자 미션(모드 6)은 CPU 팀(`game.cpuAutoBatting`), 투수 미션(모드 5)은 사람 칸 팀(`game.humanBatting`,
 * 0xaa57c 의 aa7f2 갈래라 미션 선수를 타자 명부에 안 넣는다). 두 팀 다 레코드 배열은 마스터 줄 그대로다.
 * 능력치는 `0xb570c` 첫머리 b5728 의 `0xb6415(선수, 2, 1)`(장비 니블 · 장착 스킬) — 모드 5 · 6 은 모드 갈래 · 팀 능력치 마스크를 안 타고
 * 체력 인자 90 은 피로 감소가 없다(`masterGameAbilityOf`, `missionRunnerRunAt` 과 같은 길).
 *
 * 레코드의 자리 니블은 대타 확정 0xaebe4(aecac~, R4 1c)가 **새 타자 ↔ 옛 타자** 로 맞바꾼다 — 벤치 줄은 니블이 0 이라
 * 지금 타순 칸 s 에 선 레코드가 시작 때 칸 s 레코드의 자리를 갖고, 타순 밖 레코드는 0(어느 칸에도 안 맞는다)이 된다.
 * 대타는 명단(`lineup`)만 바꾸므로 명단에서 그대로 읽는다.
 *
 * **칸 0(투수)**: 판 시작은 선수를 찾지 않아 g = 2 · 악송구 보정 8 고정이다(송구 쪽은 이 칸을 안 읽는다 — `fielderAbilityOf`).
 * 공수 교대 판 0x3fac4 가 칸 0 의 +0xec 에 니블 1(지명타자)을 넣어 펌블 · 레이저가 그 수비를 보므로 칸 0 에는 **첫 0x18 판이 적은**
 * 지명타자 레코드(`fielderZeroRecord`) 값을, 판이 안 섰으면 null 을 넣는다(`recordPlayerAbilityOf` · `entities/fielding/model/fielderRecords`).
 * ⚠️ 찾는 레코드가 미션 타자 · 마타자 표지면(수비 팀에는 안 생긴다) 진행기 기본값이다.
 */
export function missionDefenseAbilitiesOf(run: MissionDefenseSituation): (number | null)[] {
  const abilities: (number | null)[] = Array.from({ length: FIELDER_COUNT }, () => DEFAULT_RUN_ABILITY)
  // 칸 0 의 +0xec 가 0(판이 안 섰다) — 펌블 표 대신 0 · 레이저 굴림 없음 (`recordPlayerAbilityOf`)
  if (run.fielderZeroRecord === null) abilities[0] = null
  for (const { slot, player } of missionDefenseFieldersOf(run, true)) {
    if (player !== undefined) abilities[slot] = masterGameAbilityOf(player, false, DEFENSE_SLOT)
  }
  return abilities
}

/**
 * 수비 아홉 칸의 **스킬 번호** — `missionDefenseAbilitiesOf` 와 같은 레코드(칸 0 은 지명타자). 레이저 0x66a8c · 필살수비 0x66b30 이
 * 야수 +0xec 에 `0xb62b4(선수, 0x15)`(초감각)를 묻는다 — 레코드 +0x14 는 마스터 줄 Xls 행 그대로다. 표지 레코드 · 빈 칸은 빈 목록.
 */
export function missionFielderSkillIdsOf(run: MissionDefenseSituation): (readonly number[])[] {
  const skills: (readonly number[])[] = Array.from({ length: FIELDER_COUNT }, () => [])
  for (const { slot, player } of missionDefenseFieldersOf(run, true)) {
    if (player !== undefined) skills[slot] = skillIdsOfBits(player.skillBits, false)
  }
  return skills
}
