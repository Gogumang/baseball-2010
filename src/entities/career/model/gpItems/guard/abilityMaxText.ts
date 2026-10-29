import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'

/** 줄 구분 `0xcc330` */
export const LINE_BREAK = '!N'

/**
 * StrMODE[192] "[%s] 능력치가 최대입니다" — R12 1b: 칸 0~3 은 한 줄, 엄마의도시락은 최대인 칸마다 이 줄을
 * "!N"(0xcc330) 으로 잇는다. %s 는 능력치 이름 StrMODE[35+k](투수 40+k)
 */
export const abilityMaxTextOf = (name: string): string => (ORIGINAL_MODE_TEXT[192] ?? '').replace('%s', name)

/** 한계에 닿은 능력치 이름들 */
export function maxedAbilityNamesOf(view: {
  readonly abilities: readonly number[]
  readonly limits: readonly number[]
  readonly abilityNames: readonly string[]
}): string[] {
  return view.abilityNames.filter((_name, i) => view.abilities[i] >= view.limits[i])
}
