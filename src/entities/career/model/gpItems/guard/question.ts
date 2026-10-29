import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { BATTER_GP_ITEMS } from '@/entities/career/model/gpItems/catalog'
import { abilityMaxTextOf, LINE_BREAK, maxedAbilityNamesOf } from '@/entities/career/model/gpItems/guard/abilityMaxText'
import { batterGpGuardViewOf, type GpGuardView } from '@/entities/career/model/gpItems/guard/guard'
import { ITEM } from '@/entities/career/model/gpItems/types'

/**
 * GP 칸 구매 확인 글 — 0x13460 kind 2 의 끝(가드를 다 지난 뒤, 직접 떴다). 두 모드 공용이고 머리만 칸으로 갈린다:
 * ```
 * 칸 4(엄마의도시락) 0x138ca~0x13998  글 = ""(0xda908) · 한계에 닿은 칸마다 += [192](이름) + "!N"
 *                                      닿은 칸이 3 이하면 += "!N" + [82](가격) → 0xbbef9(글, 2, 3, 1)   ; 0 칸이어도 "!N" 이 앞에 선다
 * 타자 칸 9(이글아이) 0x13ab4~0x13afc  글 = [224] + "!N" + "!N" + [82](가격)                               ; 모드 4 일 때만
 * 그 밖                0x13b06          [82](가격)
 * ```
 * (예전 웹은 칸 4 의 줄 나열과 앞 "!N" 을 빼고, 이글아이는 "!N" 하나에 [82] 의 머리 "!C" 를 뺐다.)
 */
export function gpItemQuestionWith(
  view: Pick<GpGuardView, 'abilities' | 'limits' | 'abilityNames'>,
  id: number,
  price: number,
  withEagleEyeNotice: boolean,
): string {
  const question = (ORIGINAL_MODE_TEXT[82] ?? '').replace('%d', String(price))
  if (id === ITEM.도시락) {
    const maxedLines = maxedAbilityNamesOf(view).map((name) => abilityMaxTextOf(name) + LINE_BREAK)
    return maxedLines.join('') + LINE_BREAK + question
  }
  if (id === ITEM.이글아이 && withEagleEyeNotice) return (ORIGINAL_MODE_TEXT[224] ?? '') + LINE_BREAK + LINE_BREAK + question
  return question
}

/** 타자편 GP 칸 구매 확인 글 (`gpItemQuestionWith`, 칸 9 는 이글아이 안내줄) */
export function gpItemQuestionOf(career: PlayerCareer, id: number): string {
  return gpItemQuestionWith(batterGpGuardViewOf(career), id, BATTER_GP_ITEMS[id].price, true)
}
