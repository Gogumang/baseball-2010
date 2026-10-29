import { TITLE_NAMES } from '@/entities/career/model/titles'
import { NICKNAME_PAGE_FIRST_NAMES, NICKNAME_PAGE_TOTALS } from '@/pages/record/lib/annalsGrid'

/** 쪽(갈래) p 의 칸 i 를 얻었는가 — 0x61d90(mgr, p, i). 웹은 칭호를 이름으로 들고 있어 이름 첫 번호를 더해 찾는다 */
export const isNicknameOwned = (page: number, index: number, owned: readonly string[]) =>
  owned.includes(TITLE_NAMES[(NICKNAME_PAGE_FIRST_NAMES[page] ?? 0) + index] ?? '')
/** 쪽(갈래)에서 얻은 수 [skin+0x124] — 그릴 때마다 0 에서 센다 (0x2f5d8~0x2f692) */
export const ownedNicknameCountOf = (page: number, owned: readonly string[]) =>
  Array.from({ length: NICKNAME_PAGE_TOTALS[page] ?? 0 }, (_, index) => index).filter((index) => isNicknameOwned(page, index, owned)).length
