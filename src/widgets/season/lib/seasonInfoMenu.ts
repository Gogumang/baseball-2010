import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import type { SeasonSceneState } from '@/entities/season-mode/model/seasonStateMachine'

/**
 * 시즌정보 하위 메뉴 (장면 0x105 상태 **0xcd**, 들어옴 0x4d58 · 키 **0x9008** · 그리기 0x9fd8 → 공통 틀 0x9f60).
 *
 * 직접 떴다:
 * ```
 * 0x3b14 (장면 생성) this+0x74 = 0x6c219(메뉴, 4, 1, 1) · +0x34 = 4 · +0x38 = 1     ; 네 줄 한 열
 * 0x4d58 (들어옴)    이전 상태 == 0xc9 → 메뉴 vt+0x14(메뉴, 0, 0) · +0x2c = +0x30 = 0   ; 커서·스크롤 (0,0)
 *                    [this+0xc0]+0x15c = 메뉴 · 0x76705([this+0xc4], 0x23, 0xbe, 0x1e)
 * 0x9008 (키)        팝업 중([this+0xc0]+0x99)이면 무시
 *                    확인(−5 / '5'): 칸 = 행 × 열수 + 열
 *                      0 → 0xd5 · 1 → 0xd6 · 2 → this+0x110 = 2 · 0xdf
 *                      3 → this+0x16c = 1 · 0x741a1(G, 0x80, 0xf655, 0xf661, this)   ; 기록순위 창
 *                    취소(−16) → 0xc9 · 0x7ff21([this+0xc0])
 *                    그 밖 → 메뉴 vt+0x18(메뉴, 키) (위·아래) — 메뉴 +0x25 가 서면 [this+0xc0]+0x98 = 0
 * ```
 * **칸 글은 그림 글이다** — 커맨드 줄 0x7e418 이 하위 메뉴를 그릴 때 표를 `0x7e84c(gfx, 상태)` 가 상태로 고른다
 * (0xcd 갈래 0x7e922: 칸 수 [gfx+0x180] = 4 · 아이콘 [gfx+0x178] = 0xd47e4 · 글 [gfx+0x17c] = 0xd47ec).
 * 글 프레임은 img_text(`[0x1552aec]`, 0x7e300) — 283 "구단정보" · 94 "아이템" · 90 "선수정보" · 111 "기록순위"
 * (그림을 눈으로 읽었다. 같은 표 관리 메뉴 [117, 226, 91, 93, 94, 89] 가 "시즌정보 … 다음경기" 로 읽혀 맞물린다).
 *
 * **기록순위 창** (팝업 id 0x80, 그리기 0xf334 · 키 0xf5d4 — 직접 떴다):
 * ```
 * 0xf334  제목 StrMODE[74] "보고 싶은 기록을 선택해주세요" · 두 칸 중 this+0x16c 쪽에 커서 (0x858fd 두 번)
 * 0xf5d4  취소(−16) → 창 닫기(0x742a9)                  ; 0xcd 그대로
 *         좌·우(−3·−4) · '4' · '6' → this+0x16c 뒤집기
 *         확인(−5 / '5') → 창 닫기 · 상태 0xdb          ; 기록 목록 (갱신 0x56fc · 키 0x74c4 → 0xcd)
 * ```
 * 구단정보 0xd5 는 `pages/season/ui/SeasonTeamInfoScreen`(카드 0x7ba44 팀 갈래 0x7bf9c + 정보 칸 0x7c450).
 * ⚠️ 미해결: 아이템 0xd6(아이템 창 0x8453c) · 기록순위 창의 두 칸 그림과 0xdb 목록(0x5796c 계열)은 웹에 아직 없다.
 * 칸을 고르면 부르는 쪽이 "아직 없음" 으로 막는다.
 */

/** 0x9008 의 칸 → 하는 일 */
export type SeasonInfoAction =
  | { readonly kind: '상태'; readonly target: SeasonSceneState }
  /** 칸 2 — `this+0x110 = 2` 로 공용 선수 고르기 0xdf (취소 → 0xcd · 확인 → 0xd9) */
  | { readonly kind: '선수고르기' }
  /** 칸 3 — 팝업 0x80 (기록순위 창). 확인하면 0xdb */
  | { readonly kind: '기록순위창' }

export interface SeasonInfoMenuEntry {
  readonly label: string
  /** img_text 글 프레임 — 표 0xd47ec (`[gfx+0x17c]`) */
  readonly textFrame: number
  /** 아이콘 프레임 — 표 0xd47e4 (`[gfx+0x178]`, 커맨드 줄 스프라이트 [gfx+0x2c]) */
  readonly iconFrame: number
  readonly action: SeasonInfoAction
}

/** 0xcd 메뉴 네 칸 — 키 0x9008 의 칸 차례 그대로 */
export const SEASON_INFO_MENU: readonly SeasonInfoMenuEntry[] = [
  { label: '구단정보', textFrame: 283, iconFrame: 23, action: { kind: '상태', target: SEASON_SCENE_STATE.구단정보 } },
  { label: '아이템', textFrame: 94, iconFrame: 8, action: { kind: '상태', target: SEASON_SCENE_STATE.보유아이템 } },
  { label: '선수정보', textFrame: 90, iconFrame: 9, action: { kind: '선수고르기' } },
  { label: '기록순위', textFrame: 111, iconFrame: 10, action: { kind: '기록순위창' } },
]
