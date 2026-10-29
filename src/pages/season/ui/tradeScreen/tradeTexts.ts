import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'

/** StrMODE — 트레이드 문구 [163]~[175] · CPU 요청 [204]·[205]·[216] */
export const CHOOSE_ACQUIRED = ORIGINAL_MODE_TEXT[163] // "상대 팀에서 우리 팀으로 영입할 선수를 선택합니다"
export const CHOOSE_GIVEN = ORIGINAL_MODE_TEXT[164] // "상대 팀에게 보상할 우리 팀의 선수를 선택합니다"
export const REFUSE_CAREER = ORIGINAL_MODE_TEXT[165] // "나만의 리그 선수는 트레이드 할 수 없습니다"
export const REFUSE_HALL_OF_FAME = ORIGINAL_MODE_TEXT[166] // "명예의 전당 선수는 트레이드 할 수 없습니다"
// [167] "트레이드 비용 :" · [168]~[170] 비용 칸 글은 확인 판(`TradeConfirmWindow` · `lib/tradeConfirmLayout`)이 그린다
export const TRADE_PROGRESS = ORIGINAL_MODE_TEXT[173] // "트레이드 진행 중"
export const TRADE_SUCCESS = ORIGINAL_MODE_TEXT[174] // "트레이드 성공!!!"
export const TRADE_FAILURE = ORIGINAL_MODE_TEXT[175] // "트레이드 실패!!!"
/** 진행 가드 0xd3e6~0xd45c — [65] G 부족(팝업 (2, 2) 예/아니오) · [77] 소지금 부족(팝업 (1, 1) 확인) */
export const LACK_GAME_POINT = ORIGINAL_MODE_TEXT[65] // "G포인트가 부족합니다. 구매 페이지로 이동하시겠습니까?"
export const LACK_MONEY = ORIGINAL_MODE_TEXT[77] // "소지금이 부족합니다"
/** 0xe5 진입 0x5cd0 — 요청이면 [163] 대신 [204] "상대 팀에서 제시한 보상 선수입니다" */
export const REQUEST_ACQUIRED = ORIGINAL_MODE_TEXT[204]
/** 0xe6 진입 0x5b28 — 요청이면 [164] 대신 [205] "상대 팀에서 원하는 우리 팀의 선수 입니다" */
export const REQUEST_GIVEN = ORIGINAL_MODE_TEXT[205]
/** 0xe5 키 0x7104 — 요청 중 취소(−16)면 [216] "트레이드를 취소 하시겠습니까?" (팝업 id 0x2e) */
export const REQUEST_CANCEL_QUESTION = ORIGINAL_MODE_TEXT[216]

/**
 * 탭 — 원본 `[this+0x154]` 는 `0xb5695(팀, 탭, i)` 에 그대로 들어가 **0 이면 투수(0xb51fc) · 1 이면 타자(0xb53d0)** 다.
 * (직접 떴다. J 4-4 의 "0 타자" 는 반대다 — CPU 요청 0x93c8 의 뽑기 범위 8·12 와 팀 배열 수 [+0xc]·[+0x10] 도 그렇다)
 *
 * 탭은 **두 칸**이다 (직접 떴다):
 * ```
 * 0x4774 (0xe4 진입)  memset(this+0x148, 0, 0x14)         ; 트레이드 탭 this+0x154 = 0 (투수)
 * 0x5cd0 (0xe5 진입)  0x5561c(ed, 상대 팀, 0, 0, this+0x154 == 0 ? 1 : 0) ; 목록(편집기) 탭 ed+0x33f — 1 투수 · 0 타자
 * 0x5b28 (0xe6 진입)  0x5561c(ed, 내 팀,  0, 1, this+0x154 == 0 ? 1 : 0)
 * 0x55864 '*'(559b2)  ed+0x33f 뒤집기 · 커서 0              ; 목록만 바뀐다
 * 0x7104 (0xe5 OK)    this+0x154 = ed+0x33f == 0 ? 1 : 0 ; this+0x150 = 커서   ; 트레이드 탭은 여기서만 정해진다
 * 0x727c (0xe6 OK)    this+0x14c = 커서 ; 0xb5695(내 팀, this+0x154, 커서) 로 나리·명전 검사
 * ```
 * '*' 를 편집기에 넘기는 것은 0xe5 뿐이다 — 0x7104(7164~717a)는 요청([this+0x148])일 때만 '*' 를 거르지만, 0xe6 키 0x727c 는
 * 72ac~72b0 `cmp r1, #0x2a ; beq` 로 **늘** 거른다(바닥띠도 0xe6 은 7 이라 "*투수" · "*타자" 표시가 없다). 그래서 0xe6 목록은
 * 0xe5 에서 정한 트레이드 탭 그대로다 *(정정 2026-10-16 r102 — 예전 웹 · J 4-4 는 0xe6 에서도 뒤집었다)*.
 * 마우스 길은 바닥띠 "*투수" · "*타자" 표시(0xe5 바닥 0xf · 0x17) 위 투명 누름 칸이다.
 *
 * **'0' 상세 창**: 0x7104 · 0x727c 는 '*'(위) · 요청 중 위·아래 말고 모든 키를 편집기 0x55865 에 넘기므로 '0'(55920)이 [ed+0x424] 를
 * 뒤집고, 그림 0xb0f4 · 0xb0b4 의 목록 창 0x5cfec → 0x5c984 끝(0x5cfc8)이 선수 정보 창 0x5b798 을 그린다(`EntryDetailOverlay`).
 * 창은 0xe5 · 0xe6 진입(0x5cd0 · 0x5b28 → 편집기 초기화 0x5561c 556d6)마다 닫힌다. 팝업이 떠 있으면([0x140005c]+9) 키가 안 간다.
 */
export type TradeStep =
  | { readonly kind: '팀' }
  | { readonly kind: '영입'; readonly teamId: number }
  | { readonly kind: '보상'; readonly teamId: number; readonly acquired: number }
  | { readonly kind: '확인'; readonly teamId: number; readonly acquired: number; readonly given: number }

/** 0xe5 · 0xe6 — 엔트리 목록 창을 띄우는 단계 */
export const isListStep = (step: TradeStep): step is Extract<TradeStep, { kind: '영입' | '보상' }> => step.kind === '영입' || step.kind === '보상'

/** 0xe4 에서 트레이드할 수 있는 팀 칸의 끝 — 칸 > 9(히든 팀)는 힌트만 (0x82c2 `cmp r2, #9`) */
export const LAST_TRADE_TEAM = 9

/** 지금 떠 있는 예·아니오 팝업 — 진행 [171] (id 0x18) · 요청 취소 [216] (id 0x2e) · G 부족 [65] (id 2) */
export type TradeQuestion = '진행' | '요청취소' | 'G부족'

/** 0xe7 단계 this+0x160 — 1 진행(게이지, [173]) · 2 성공 [174] · 3 실패 [175] (0 고르기는 null) */
export type TradeProgressStage = '진행' | '성공' | '실패'
