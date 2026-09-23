/**
 * **마선수 오픈 플래그 저장 칸** — 원본 전역 기록 `mgr[0x30..0x39]` 10바이트.
 *
 * 값·규칙은 전부 `shared/config/original/aceOpen.ts`(생성기가 뽑은 확정 표)에 있고, 여기는
 * **저장 칸의 모양과 오픈 판정**만 맡는다.
 *
 * 원본 직접 확인 (마선수 고르기 화면 0xa248 안, 팝업 답 처리 0xa390~0xa46e — 이번에 디스어셈해 읽었다):
 * ```
 * a390  r7 = 팝업답[+0x21c]            ; 0 = 첫 버튼 "예", 그 밖 = 아니오·취소
 * a3a2  cmp r7,#0 ; bne a482           ; 아니오면 팝업만 닫는다 (mgr+0x314 = 0)
 * a3b6  r4 = 0x31d ; cell = mgr[0x31d] ; 커서가 짚은 격자 칸 0~9
 * a3c6  r0 = XlsACE_LEVEL_UP[cell]     ; 0xa3cc: 가격 = u16 (row+0xa)
 * a3d6  r1 = mgr[+0x64]                ; 들고 있는 G포인트
 * a3dc  cmp r1,r3 ; blt a46e           ; **G < 가격이면 산 것이 아니다** (같으면 산다)
 * a3e2  r3 = G − 가격 ; >0x1869f(99999)면 99999 ; <0 이면 0 ; mgr[+0x64] = r3
 * a3f6  mgr[0x30 + cell] = 1           ; **오픈 플래그. 칸 번호를 그대로 색인한다**
 * ```
 * G가 모자란 갈래 0xa46e 는 확인 팝업을 닫고 화면 상태 `mgr+0x314` 를 **2** 로 둔다. 그러면 다음
 * 갱신에서 0xa5a6 이 그 2 를 보고 3 으로 올리며 **부족 팝업(id 0x20)** 을 띄운다 — 글은 문자열표가
 * 아니라 코드에 박힌 0xcc214 다 (`ACE_OPEN_SHORTAGE_POPUP`). **G는 한 푼도 안 깎이고 플래그도 안 선다.**
 */
import {
  ACE_DEFAULT_OPEN_CELLS,
  ACE_OPEN_TABLE,
  aceOpensWithGamePoint,
} from '@/shared/config/original/aceOpen'
import { ACE_PER_ROLE, ACE_PHASE, aceIndexOfCell, aceRoleOfCell } from '@/pages/general-mode/lib/generalModeSetup'
import type { AcePhase } from '@/pages/general-mode/lib/generalModeSetup'

/** 저장 칸 10개 — `mgr[0x30]`~`mgr[0x39]` (윗줄 0~4 마투수 · 아랫줄 5~9 마타자) */
export const ACE_OPEN_CELL_COUNT = ACE_PER_ROLE * 2

/**
 * 저장에 적는 모양. 원본 10바이트를 칸 차례 그대로 참/거짓으로 둔다.
 *
 * ⚠️ 원본은 이 10칸이 **전역 기록**이고 G포인트도 같은 기록의 `+0x64` 다. 웹판은 G 를 육성 선수
 *    (`PlayerCareer.gamePoint`)에 두고 있어서 **칸만 따로** 담는다 — 근사다.
 */
export interface AceOpenSave {
  /** 칸 0~9 의 오픈 플래그 */
  readonly cells: readonly boolean[]
}

/**
 * 저장에서 읽은 값을 10칸으로 맞춘다.
 *
 * - 저장이 아예 없거나(옛 세이브) 형식이 틀리면 **빠진 칸을 거짓으로 채운다**.
 * - 그러고 나서 `ACE_DEFAULT_OPEN_CELLS`(칸 0 싸이커 · 5 메디카)는 **늘 켠다** — 원본에서 그 둘은
 *   해금 id 가 없는 기본 개방이라 저장이 0 이어도 열려 있다 (K-bursts-special.md K-3 3-3).
 */
export function normalizeAceOpenSave(raw: unknown): AceOpenSave {
  const saved = (raw as Partial<AceOpenSave> | null | undefined)?.cells
  const cells = Array.from({ length: ACE_OPEN_CELL_COUNT }, (_unused, cell) =>
    ACE_DEFAULT_OPEN_CELLS.includes(cell) ? true : Array.isArray(saved) && saved[cell] === true,
  )
  return { cells }
}

/** 새 저장 — 기본 개방 둘만 켜져 있다 */
export const INITIAL_ACE_OPEN_SAVE: AceOpenSave = normalizeAceOpenSave(null)

/** 이 칸이 열려 있나 */
export function isAceCellOpen(save: AceOpenSave, cell: number): boolean {
  return save.cells[cell] === true
}

/** 열린 마투수 — 화면이 받는 로컬 번호 0~4 (저장 +0x30..0x34) */
export function acePitcherIdsOf(save: AceOpenSave): readonly number[] {
  return openedIdsOf(save, ACE_PHASE.마투수)
}

/** 열린 마타자 — 로컬 번호 0~4 (저장 +0x35..0x39) */
export function aceBatterIdsOf(save: AceOpenSave): readonly number[] {
  return openedIdsOf(save, ACE_PHASE.마타자)
}

function openedIdsOf(save: AceOpenSave, phase: AcePhase): readonly number[] {
  return save.cells
    .map((open, cell) => (open && aceRoleOfCell(cell) === phase ? aceIndexOfCell(cell) : null))
    .filter((index): index is number => index !== null)
}

/** 그 칸의 G 오픈 가격 (`XlsACE_LEVEL_UP` row+0xa). 표 밖이면 0 */
export function aceOpenPriceOf(cell: number): number {
  return ACE_OPEN_TABLE[cell]?.openPriceGamePoint ?? 0
}

/**
 * 오픈 확인 팝업에서 "예" 를 골랐을 때 원본이 가는 갈래 (0xa3a2~0xa46e).
 *
 * - `못여는칸` — 칸 4 드래고나 · 9 킹타이거. 애초에 확인 팝업이 안 뜨는 칸이다 (0xa68e).
 * - `이미열림` — 열린 칸은 OK 가 레벨업 쪽으로 간다 (0xa68a `cmp r4,#0; bne 0xa6f8`).
 * - `G부족`  — `G < 가격` (0xa3dc `blt`). **가격과 딱 같으면 산다.**
 */
export type AceOpenAnswer = '오픈' | 'G부족' | '못여는칸' | '이미열림'

export function aceOpenAnswerOf(save: AceOpenSave, cell: number, gamePoint: number): AceOpenAnswer {
  if (isAceCellOpen(save, cell)) return '이미열림'
  if (!aceOpensWithGamePoint(cell)) return '못여는칸'
  return gamePoint < aceOpenPriceOf(cell) ? 'G부족' : '오픈'
}

/** 플래그를 세운다 (0xa3f6 `mgr[0x30 + cell] = 1`). 값 판정은 `aceOpenAnswerOf` 가 이미 했다 */
export function openAceCell(save: AceOpenSave, cell: number): AceOpenSave {
  if (cell < 0 || cell >= ACE_OPEN_CELL_COUNT || isAceCellOpen(save, cell)) return save
  return { cells: save.cells.map((open, index) => (index === cell ? true : open)) }
}

/**
 * G가 모자랄 때 뜨는 팝업 (0xaa00 → 팝업 id 0x20, 예/아니오 둘).
 *
 * 문자열표가 아니라 **코드에 박힌 글 0xcc214** 다 (StrCOMMON[41] "%d G포인트가 부족합니다" 는
 * 상점 쪽이 쓰고 이 화면은 안 쓴다 — 전수 확인했다).
 *
 * ⚠️ **근사**: 원본에서 "예" 는 유료 구매 페이지로 나간다 (0xa374 → 0xa4f0). 웹판에는 그 길이
 *    없어 **예·아니오 둘 다 그냥 닫는다.**
 */
export const ACE_OPEN_SHORTAGE_POPUP =
  '!C!cFF0000G포인트가 부족합니다.!cFFFFFF 구매!N페이지로 이동하시겠습니까?'
