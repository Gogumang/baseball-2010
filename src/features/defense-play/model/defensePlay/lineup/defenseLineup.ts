import { FIELDER_COUNT } from '@/entities/fielding/model/fieldGeometry'
import { DEFAULT_ABILITY } from '@/features/defense-play/model/defensePlay/constants'
import type { HolderPlate } from '@/features/defense-play/model/defensePlayView'

/** `defenseAbilitiesOf` 가 받는 수비 한 명 */
export interface DefenseLineupPlayer {
  /**
   * 수비 자리 코드 = 선수 레코드 `+0x1c & 0xf` (1 지명 · 2 포수 · 3 1루 · 4 2루 · 5 3루 ·
   * 6 유격 · 7 1루 쪽 외야 · 8 3루 쪽 외야 · 9 중견). **수비 칸 = 코드 − 1** 이고
   * 칸 0(투수)은 이 표에서 빠진다 (0xb103e~0xb105e · 0xb1048).
   */
  readonly position?: number
  /** 경기용 능력치 칸 2 — 타자 레코드면 수비 (0xb570c(팀, 2, 선수, 90, 1), I-controls 1a) */
  readonly defense: number
}

/**
 * 타순에 선 선수들을 **수비 칸 9개**(0 투수 … 8 중견)의 능력치 배열로 옮긴다.
 *
 * 칸 0(투수)은 판 시작 0xb0fb4 가 **선수를 찾지 않는다**(b1032 — `fielderAbilityOf` 주석). 그래서 송구 속도 g = 2 ·
 * 악송구 보정 8 로 고정이고 송구 쪽은 이 칸의 값을 읽지 않는다. 대신 공수 교대 판 0x3fac4 가 칸 0 의 +0xec 에 **지명타자**
 * (니블 1)를 넣어 펌블 · 레이저 굴림이 그 수비를 본다 — 칸 0 에는 지명타자의 수비를 넣는다(`recordPlayerAbilityOf`). 진행기는 이 값을
 * 장면이 든 +0xec(마지막 교대 판의 레코드, 판이 없었으면 null — `entities/fielding/model/fielderRecords`)로 덮어 넘긴다.
 * (예전 웹은 마운드 투수의 능력치 칸 2(투수 레코드에서는 변화)를 넣었다 — 원본에 없는 길이라 걷었다.)
 *
 * 자리 코드가 없거나 겹치는 칸은 원본 평균대(등급 3 = 500)로 둔다.
 */
export function defenseAbilitiesOf(lineup: readonly DefenseLineupPlayer[]): number[] {
  const abilities = Array.from({ length: FIELDER_COUNT }, () => DEFAULT_ABILITY)
  const filled = Array.from({ length: FIELDER_COUNT }, () => false)
  for (const player of lineup) {
    const code = (player.position ?? 0) & 0xf
    // 칸 0 은 니블 1(지명타자) — 공수 교대 판 0x3fac4 의 고리(3fe28~3fe4c)는 칸 0 도 같은 식으로 찾는다
    const slot = code - 1
    if (slot < 0 || slot >= FIELDER_COUNT) continue
    if (filled[slot]) continue
    abilities[slot] = player.defense
    filled[slot] = true
  }
  return abilities
}

/**
 * 수비 아홉 칸의 **스킬 번호** (`fielderSkillIds`) — 칸을 고르는 법은 `defenseAbilitiesOf` 와 같다(자리 코드 − 1 칸, 겹치면 앞 선수,
 * 칸 0 은 니블 1 = 지명타자). 레이저 굴림 0x66a8c(66ad4~66aee)와 필살수비 0x66b30 · 0x66be4 는 야수 +0xec 레코드에
 * `0xb62b4(선수, 0x15)`(초감각)를 묻는다 — 그 레코드가 이 칸 고르기로 앉은 선수다. 선수가 없는 칸은 빈 목록이다
 * (0x66a8c 는 +0xec 가 비면 굴리지 않는다 — 66aa6).
 */
export function defenseSkillIdsOf(lineup: readonly { readonly position?: number; readonly skillIds: readonly number[] }[]): (readonly number[])[] {
  const skills: (readonly number[])[] = Array.from({ length: FIELDER_COUNT }, () => [])
  const filled = Array.from({ length: FIELDER_COUNT }, () => false)
  for (const player of lineup) {
    const slot = ((player.position ?? 0) & 0xf) - 1
    if (slot < 0 || slot >= FIELDER_COUNT || filled[slot]) continue
    skills[slot] = player.skillIds
    filled[slot] = true
  }
  return skills
}

/**
 * 수비 아홉 칸의 **이름 판 선수** (`fielderPlates`) — 칸을 고르는 법은 `defenseAbilitiesOf` 와 같다
 * (자리 코드 − 1 칸, 겹치면 앞 선수). 칸 0 은 지금 마운드 투수다.
 */
export function defenseFielderPlatesOf(
  lineup: readonly { readonly name: string; readonly position?: number }[],
  pitcher: { readonly name: string; readonly role?: number } | undefined,
): (HolderPlate | null)[] {
  const plates: (HolderPlate | null)[] = Array.from({ length: FIELDER_COUNT }, () => null)
  if (pitcher !== undefined) plates[0] = { name: pitcher.name, pitcherRole: pitcher.role }
  for (const player of lineup) {
    const code = (player.position ?? 0) & 0xf
    const slot = code - 1
    if (slot < 1 || slot >= FIELDER_COUNT) continue
    if (plates[slot] !== null) continue
    plates[slot] = { name: player.name, positionCode: code }
  }
  return plates
}
