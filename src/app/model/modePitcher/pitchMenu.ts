import { magicPitchCountOf } from '@/entities/pitcher-career/model/magicPitch'
import { pitchSlotsOf } from '@/features/play-pitcher-game/model/pitcherPitch'
import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'
import type { PitchTypeInfo } from '@/shared/config/original/pitchTypes'
import type { ModePitcher } from '@/app/model/modePitcher/modePitcherTypes'

/**
 * **미션 투수의 한 경기 마구 횟수** — 팀+0x28 (0xaea10). 미션도 보통 경기 장면이라 팀 new 0xb891c 가 칸을 −1 로 두고
 * 첫 타석 준비(상태 0xd 0x48d50 → 0xaebe4 aee9a~aef24)가 마운드 투수로 채운다:
 * `+0x18 == 0 → 0`, 마선수가 아니므로(미션 투수는 비트7 — 0xb633d 거짓) u8 0xd84ff[+0x18] = 0·4·5·6·7, 혼신(23 장착) +2.
 * 미션은 투수가 바뀌지 않아 한 판에 한 번 주어진다. `stored` 가 0 이상이면(이미 채워 줄인 값) 그대로다.
 */
export function modePitcherMagicRemainingOf(stored: number, pitcher: ModePitcher): number {
  if (stored >= 0) return stored
  return magicPitchCountOf({
    number: pitcher.repertoire.magicNumber,
    isAce: false,
    aceLevel: 0,
    hasSpiritSkill: pitcher.hasSpiritSkill,
  })
}

/** `modePitchMenuOf` 가 만든 마구 칸 — 화면이 돌려준 항목이 마구인지 가른다 (구질 표에 마구 자리가 없어서) */
const MAGIC_MENU_ITEMS = new WeakSet<PitchTypeInfo>()

/** 화면이 돌려준 구질이 `modePitchMenuOf` 의 마구 칸(구질 22)인가 */
export function isModeMagicPitchType(type: PitchTypeInfo): boolean {
  return MAGIC_MENU_ITEMS.has(type)
}

/**
 * 투구 화면 구질 메뉴 — 구질 칸 6개 `0xb6d2c`(`pitchSlotsOf`) 중 빈 칸이 아닌 것을 칸 차례대로.
 * 예전에는 미션 투수가 늘 `PITCH_TYPES` 앞 다섯(FASTBALL~SHOOT)을 던졌다.
 *
 * 마구 칸(칸 5, `+0x18 ≠ 0` 이면 0xb6d6a 가 22 를 넣는다)도 넣는다 — 키 '0' → 메시지 7 → 0x50da8 은 모드를 안 보고,
 * `구질 == 22` 면 남은 횟수(0xaea10) > 0 일 때만 받는다(0x50db8). 이름은 번호·폼으로 고른 StrCOMMON 이름에
 * 남은 횟수를 붙인다. 구질 표(`PitchTypeInfo`)에 마구 자리가 없어 구속·변화 칸은 0 이다 — 고른 뒤 무엇을 던질지는
 * 부르는 쪽이 `isModeMagicPitchType` 으로 가른다.
 * 남은 0 일 때 칸을 막는 것(0x50db8)은 투구 화면(`PitchingScreen` 의 `isBlockedMagic`)이 `magicRemaining` 으로 하고,
 * 세션 `handleThrow` 도 한 번 더 거른다.
 */
export function modePitchMenuOf(pitcher: ModePitcher, magicRemaining = 0): readonly PitchTypeInfo[] {
  return pitchSlotsOf(pitcher.repertoire)
    .filter((slot) => slot.typeNumber !== 0)
    .map((slot) => {
      if (!slot.isMagic) return PITCH_TYPES[slot.typeNumber - 1]
      const item: PitchTypeInfo = {
        name: `${slot.name} (남은 ${magicRemaining}회)`,
        horizontalBreak: 0,
        verticalBreak: 0,
        speed: 0,
        flightSteps: [],
      }
      MAGIC_MENU_ITEMS.add(item)
      return item
    })
    .filter((type): type is PitchTypeInfo => type !== undefined)
}

/**
 * `modePitchMenuOf` 의 항목마다 구질 칸 번호 0~5 (0xb6d2c) — 빈 칸을 걸러 낸 메뉴라 칸과 차례가 어긋날 수 있다.
 * 구질 키 0x534d8(OK → 0 · '2' → 1 · '4' → 2 · '6' → 3 · '8' → 4 · '0' → 5)가 이 칸을 고른다.
 */
export function modePitchSlotNumbersOf(pitcher: ModePitcher): readonly number[] {
  return pitchSlotsOf(pitcher.repertoire)
    .filter((slot) => slot.typeNumber !== 0)
    .map((slot) => slot.slot)
}
