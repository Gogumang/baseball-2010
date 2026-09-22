// 이 파일은 tools/generate_game_data.py 가 원본 패키지에서 생성했다.
// 직접 고치지 말고 생성기를 고칠 것.

import type { BatterAbility } from '@/entities/batting/model/batter'

/**
 * 원본 `XlsACE_LEVEL_UP` 한 줄 — **이름과 달리 레벨업 표가 아니다.** 기본 능력치·G 오픈 가격·
 * 오픈 힌트 표다 (K-bursts-special.md K-3 · 3-3, 확정).
 *
 * ⚠️ 레벨업 비용(3000·6000·9000·12000 G, u32 표 0xd1724 × 1000)은 **다른 표**다 — 섞지 말 것.
 */
export interface AceOpenEntry {
  /** 표의 마선수 번호 1~10 (1~5 마투수 · 6~10 마타자) */
  readonly number: number
  /** 마선수 고르기 격자 칸 0~9 — 표의 줄 차례와 같다 (윗줄 0~4 마투수 · 아랫줄 5~9 마타자) */
  readonly cell: number
  /** `acePlayers.ts` 의 `id` */
  readonly aceId: string
  readonly name: string
  /** 이 표에 실린 기본 능력치. `ACE_PLAYERS` 의 값과 같다 (생성기가 다르면 멈춘다) */
  readonly ability: BatterAbility
  /**
   * u16[5] — G포인트 오픈 가격 (0xa6c6 → StrCOMMON[43] 의 %d).
   *
   * ⚠️ **0 이 "무료" 라는 뜻이 아니다.** `aceOpensWithGamePoint` 를 볼 것.
   */
  readonly openPriceGamePoint: number
  /** 문자열 (+0xc) — 잠긴 칸을 눌렀을 때 StrCOMMON[42]/[43] 의 %s 로 들어가는 오픈 힌트 */
  readonly openHint: string
}

/**
 * 마선수 오픈 가격·힌트 표 — **칸 번호(0~9)로 색인한다.**
 *
 * 0G 인 네 칸의 뜻이 서로 다르다 (K-3 3-0 · 3-1 · 3-3):
 *   - 칸 0 싸이커 · 칸 5 메디카 = **기본 개방** (해금 id 가 없다. 힌트도 "기본 개방")
 *   - 칸 4 드래고나 · 칸 9 킹타이거 = **G포인트로 열 수 없다** (StrCOMMON[42]).
 *     킹타이거는 만루홈런 누계 54 로 열리고(해금 id 7), 드래고나는 기록 누계 표에 아예 없어
 *     힌트 "2010.gamevil.com" 대로 웹/이벤트 쪽 해금으로 보인다 — **미해결**.
 * 나머지 여섯 칸은 가격만 내면 기록 달성 없이도 열 수 있다 (StrCOMMON[43] "오픈 조건을 달성하지 않고…").
 */
export const ACE_OPEN_TABLE: readonly AceOpenEntry[] = [
  { number: 1, cell: 0, aceId: 'psyker', name: '싸이커', ability: { hit: 670, power: 550, run: 300, defense: 820 }, openPriceGamePoint: 0, openHint: '기본 개방' },
  { number: 2, cell: 1, aceId: 'leony', name: '레오니', ability: { hit: 580, power: 850, run: 330, defense: 580 }, openPriceGamePoint: 6000, openHint: '삼진 삼진 삼진!!' },
  { number: 3, cell: 2, aceId: 'bbmachine', name: '붕붕머신', ability: { hit: 820, power: 620, run: 320, defense: 620 }, openPriceGamePoint: 9000, openHint: '풀카운트 승부!' },
  { number: 4, cell: 3, aceId: 'ballantine', name: '발렌타인', ability: { hit: 700, power: 600, run: 280, defense: 800 }, openPriceGamePoint: 12000, openHint: '퍼펙트 트리플' },
  { number: 5, cell: 4, aceId: 'dragona', name: '드래고나', ability: { hit: 650, power: 900, run: 300, defense: 650 }, openPriceGamePoint: 0, openHint: '2010.gamevil.com' },
  { number: 6, cell: 5, aceId: 'medica', name: '메디카', ability: { hit: 620, power: 620, run: 450, defense: 620 }, openPriceGamePoint: 0, openHint: '기본 개방' },
  { number: 7, cell: 6, aceId: 'kao', name: '어거지죠', ability: { hit: 700, power: 450, run: 650, defense: 600 }, openPriceGamePoint: 6000, openHint: '오오!! 스피드왕!' },
  { number: 8, cell: 7, aceId: 'roze', name: '로제', ability: { hit: 580, power: 850, run: 320, defense: 600 }, openPriceGamePoint: 9000, openHint: '외로운 홈런타자' },
  { number: 9, cell: 8, aceId: 'death', name: '크라이져', ability: { hit: 777, power: 555, run: 444, defense: 666 }, openPriceGamePoint: 12000, openHint: '사이클링 트리플' },
  { number: 10, cell: 9, aceId: 'tiger', name: '킹타이거', ability: { hit: 650, power: 920, run: 380, defense: 450 }, openPriceGamePoint: 0, openHint: '오오!! 만루홈런!' },
]

/**
 * **G포인트로 열 수 없는 칸** — 원본 0xa68e 는 가격 칸을 보지 않고 칸 번호를 그대로 박아 놨다:
 * `cmp r7,#4; beq …; cmp r7,#9; bne …` (직접 디스어셈해 확인).
 */
export const ACE_GAMEPOINT_LOCKED_CELLS: readonly number[] = [4, 9]

/** 처음부터 열려 있는 칸 — 0 싸이커 · 5 메디카 (해금 id 가 없다. K-3 3-0) */
export const ACE_DEFAULT_OPEN_CELLS: readonly number[] = [0, 5]

/** 이 칸을 G포인트로 열 수 있나 (0xa68e) */
export function aceOpensWithGamePoint(cell: number): boolean {
  return !ACE_GAMEPOINT_LOCKED_CELLS.includes(cell)
}

/** 잠긴 칸을 눌렀을 때의 팝업 글 (0xa696 · 0xa6ba). %s = 오픈 힌트 · %d = 오픈 가격 */
export const ACE_OPEN_POPUP = {
  /** StrCOMMON[42] — G포인트로 못 여는 칸 (알림 하나) */
  blocked: '!C!cffffff<!c00FF00마선수 오픈 힌트!cffffff>!N!N!cFF6600%s!cFFFFFF!N!N!cFFFF00G포인트!cFFFFFF로 오픈할 수 없습니다',
  /** StrCOMMON[43] — 가격을 물어보는 칸 (예/아니오) */
  confirm: '!C!cffffff<!c00FF00마선수 오픈 힌트!cffffff>!N!N!cFF6600%s!cFFFFFF!N!N오픈 조건을 달성하지 않고!N!cffff00%d G포인트!cffffff를 사용하여!N마선수를 오픈하시겠습니까?',
} as const

/**
 * 잠긴 칸 팝업 글 만들기 — 원본이 %s·%d 에 넣는 것을 그대로 채운다.
 * 칸이 표 밖이면 빈 글을 준다 (원본에는 없는 경우다).
 */
export function aceOpenPopupTextOf(cell: number): string {
  const entry = ACE_OPEN_TABLE[cell]
  if (entry === undefined) return ''
  return aceOpensWithGamePoint(cell)
    ? ACE_OPEN_POPUP.confirm.replace('%s', entry.openHint).replace('%d', String(entry.openPriceGamePoint))
    : ACE_OPEN_POPUP.blocked.replace('%s', entry.openHint)
}
