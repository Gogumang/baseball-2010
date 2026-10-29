import type { StadiumPurchaseRefusal } from '@/entities/season-mode/model/stadiumItems'
import { fillModeText, seasonMoneyTextOf } from '@/widgets/season/lib/seasonText'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'

/** 가드 문구 — 원본 StrMODE (S3 4절). 원문 표(`ORIGINAL_MODE_TEXT`)에서 읽는다 (r216) */
export const REFUSAL_TEXT: Readonly<Record<StadiumPurchaseRefusal, (required: number) => string>> = {
  없는칸: () => '', // 목록에 없는 칸 — 원본에는 생길 수 없다
  미오픈: () => ORIGINAL_MODE_TEXT[76] ?? '', // StrMODE[76]
  이미보유: () => ORIGINAL_MODE_TEXT[78] ?? '', // StrMODE[78]
  인기도부족: (required) => (ORIGINAL_MODE_TEXT[62] ?? '').replace('%d', String(required)), // StrMODE[62]
  소지금부족: () => ORIGINAL_MODE_TEXT[77] ?? '', // StrMODE[77]
}

/** 전역 게임 모드 [0x1552d10] — 시즌 2 (0x783b0 의 하늘 줄 갈래) */
export const SEASON_MODE = 2

/**
 * StrMODE[184] — 구매 완료 (0x812c 가 0x81ba `movs r1, #0xb8` → 0xbbef9(this, 1, 0xf, 1) 로 띄우는 결과코드 15 팝업).
 * 원문은 [구단관리]-[구장관리] 두 이름이 노랑(!cFFFF00)이다 — 웹이 마크업을 뺀 글을 손으로 적어 흰 글로 나오던 것을 원문 표로 바꿨다(r263)
 */
export const PURCHASED_TEXT = ORIGINAL_MODE_TEXT[184] ?? ''
/** StrMODE[185] `!C[!cFFFF00%s!cFFFFFF]!N아이템을 적용합니다` — 교체 (0x7958 sprintf) · 이름은 노랑, 둘째 줄에 안내 */
export const EQUIPPED_TEXT = (name: string) => fillModeText(ORIGINAL_MODE_TEXT[185] ?? '', name)
/** StrMODE[79] — 구매 확인 (결과코드 14, 0x9bae `movs r1, #0x4f` → 0xbbef9(this, 2, 0xe, 1)) */
export const PURCHASE_QUESTION = (price: number) => fillModeText(ORIGINAL_MODE_TEXT[79] ?? '', seasonMoneyTextOf(price))
