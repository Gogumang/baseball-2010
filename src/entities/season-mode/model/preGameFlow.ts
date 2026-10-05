import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import type { SeasonSceneState } from '@/entities/season-mode/model/seasonStateMachine'

/**
 * **시즌 경기 전 흐름** — 장면 0x105 의 0xd8 → 0xd7 → 0xdd → 0xe1 (직접 떴다).
 *
 * ```
 * 정규시즌     0xd8 다음경기 ─확인─▶ 0xd7 선수단(this+0x11c = 1) ─마투수·마타자─▶ 0xdd 경기정보 ─확인─▶ 0xe1 → 경기 0x104
 * 포스트시즌   0xef 결산 ─내 차례─▶ 0xd7 (this+0x11c = 1) ─▶ 0xdd ─▶ 0xe1
 * 국가대항전   0xf3 대진 ─▶ 0xf4 ─확인─▶ 0xdd ─▶ 0xe1          (0xd7 을 안 지난다 · 마선수도 안 넣는다)
 * ```
 *
 * **0xd7 = 선수단 화면** — 들어옴 `0x5268` · 그림 `0xaa24` · 키 `0xa248`(0xedb6 나무 0xef08).
 * `this+0x11c` 가 1 이면 **경기 전 마선수 고르기**(공용 목록 k 2 = 일반모드 상태 21 과 같은 화면,
 * 머리띠 0x54d95(4 "마선수선택", 바닥 0x205 레벨업+되돌아가기)), 2 면 코치채용(k 10)이다.
 * ```
 * 5268  [this+0x8c] vt+0x14(0,0)           ; 격자 커서 (0,0)
 * 5282  메뉴 +0xd4 객체 +0xac = 1 · +0xad = 0 · 메뉴+0x80 = 0
 * 52a4  메뉴+0xd0 = 1                       ; ★ 들어올 때마다 **마투수 단계부터**
 * 52b6  메뉴+0x105 = (this+0x11c == 2)       ; 코치채용이면 A 딱지 없음
 * 52ca  0x5faf4(메뉴, 1) · 메뉴+0x31d = 0 · 메뉴+0x314 = 0
 * ```
 * 키 `0xa248` 의 고르기 단계(메뉴+0x314 == 0, this+0x11c == 1):
 * ```
 * a734  OK  : 열림 = 저장[0x30 + 칸]
 *             메뉴+0xd0 ≠ 0(마투수) : 열렸으면 rec+0xe = 칸 · 커서 (0,1) · 메뉴+0xd0 = 0
 *             메뉴+0xd0 == 0(마타자): 열렸으면 rec+0xd = 칸 − 5 → **0xdd**
 *             잠겼으면 힌트 팝업(칸 4·9 [0x2a], 그 밖 [0x2b]) — 화면이 한다
 * a656  '0' : 레벨업 창 (열린 칸 · 레벨 ≤ 3) — 화면이 한다
 * a900  CLR : 마타자 단계 → 메뉴+0xd0 = 1 (커서를 고른 마투수 칸으로)
 *             마투수 단계 → `SR+0xb4`(포스트시즌) ? **0xef** : **0xd8**
 * ```
 * rec = 메뉴 `+0xbc` 16바이트 — 일반모드 준비 기록과 **같은 칸**이다(+0xd 마타자 · +0xe 마투수).
 *
 * **0xdd = 경기정보** — 들어옴 `0x6548` · 그림 `0xb398`(목록 k 4 + 설정 창 0x6042c + 머리띠 5) · 키 `0x83cc`:
 * ```
 * 6556  이전 상태 == 0xe0(엔트리 편집에서 돌아옴) 이면 아무것도 안 한다
 * 6564  0x5ffa4(메뉴) ; 저장+0x11e == 0 이면 0x5fef4(메뉴, 1) 로 **경기진행 설정 창을 저절로 열고** 그 칸 = 1 · 저장
 * 65b6  두 팀 고르기 (국가대항전 0xb7614 / 정규 SR[1]·0xb765c) · 경기 설정 0xb6814·0xb6c18·0xb6bd4 · 팀 0xb891c·0xb8768
 * 66ae  SR+0x12c == 0 이면 rec 를 읽어 내 팀에 0xb88c8(마투수 rec+0xe) · 0xb8870(마타자 rec+0xd),
 *       상대 팀에 0xb88c8(0x66968(rec+0xe)) · 0xb8870(0x66994(rec+0xd))   ← 상대 마선수 굴림 두 번
 * 670e  this+0x178 == 0 이고 SR+0xb2 ≠ 0 이면 양 팀 0xb8c80(로테이션) · this+0x178 = 1
 * 6850  SR+0xb2 == 0 이면 열 팀(0~9) 모두 0xb6190 = **투수 스태미나 전원 10000**
 * 83cc  키: 설정 창이 열렸으면 0x5ffcc 로 · 'OK/5' → 저장+0x14e = 0 · 0xa3424(평판 16칸 지움) ·
 *       0xb8768 · 0x1fdb0(저장, 0xc, …) · 0x22754 · 전환 0xbdae8 → **0xe1**
 *       '0' → 설정 창 열고 닫기 · '4'/왼 → this+0x120 = 1, 0xe0(유저 팀 엔트리) · '6'/오른 → 0, 0xe0(CPU 팀)
 *       CLR → SR+0x12c ? **0xf4** : **0xd7**
 * ```
 * **0xf4 의 키는 0x4a18 이다** (키 표 0xcbf6c 의 0x2c 칸 = 0xedb0 → bl 0x4a18): OK·'5' → 0xdd · CLR → 0xf3.
 * (R13 이 "0xf4 는 나가는 길이 없다" 고 적은 것은 이 칸을 못 본 것이다.)
 */

/** 선수단 화면 0xd7 의 용도 `this+0x11c` — 1 경기 전 마선수 고르기 · 2 코치채용 */
export const SQUAD_PURPOSE = { 경기전: 1, 코치채용: 2 } as const
export type SquadPurpose = (typeof SQUAD_PURPOSE)[keyof typeof SQUAD_PURPOSE]

/** 마선수 고르기 단계 `메뉴+0xd0` — 1 마투수(윗줄) · 0 마타자(아랫줄). 일반모드 상태 21 과 같은 칸이다 */
export const PRE_GAME_ACE_PHASE = { 마타자: 0, 마투수: 1 } as const
export type PreGameAcePhase = (typeof PRE_GAME_ACE_PHASE)[keyof typeof PRE_GAME_ACE_PHASE]

/** 마투수 5 · 마타자 5 — 격자 윗줄 0..4 · 아랫줄 5..9 */
const ACES_PER_ROW = 5

/** 아직 안 고른 마선수 */
export const NO_PRE_GAME_ACE = -1

/** 0xd7 이 들고 있는 것 — 단계 `메뉴+0xd0` 와 rec `+0xe`(마투수) · `+0xd`(마타자) */
export interface PreGameAces {
  readonly phase: PreGameAcePhase
  /** rec+0xe — 마투수 0..4 */
  readonly pitcher: number
  /** rec+0xd — 마타자 0..4 */
  readonly batter: number
}

/** 들어옴 `0x5268` — 메뉴+0xd0 = 1 이라 **늘 마투수부터** 다시 고른다 */
export const PRE_GAME_ACES_START: PreGameAces = {
  phase: PRE_GAME_ACE_PHASE.마투수,
  pitcher: NO_PRE_GAME_ACE,
  batter: NO_PRE_GAME_ACE,
}

export type PreGameAceStep =
  /** 0xd7 에 남는다 (마투수를 골라 마타자 단계로) */
  | { readonly kind: '고르기'; readonly aces: PreGameAces }
  /** 마타자까지 골랐다 → 0xdd 경기정보 */
  | { readonly kind: '경기정보'; readonly aces: PreGameAces }

/**
 * 0xd7 의 OK 한 칸 (0xa734~0xa79a) — **열린 칸만** 넘어온다고 본다(잠긴 칸 팝업은 화면이 띄운다).
 * 단계에 안 맞는 줄의 칸이면 원본도 그 칸 번호를 그대로 적지만, 웹 화면은 그 줄을 누를 수 없게 막는다.
 */
export function choosePreGameAce(aces: PreGameAces, cell: number): PreGameAceStep {
  if (aces.phase === PRE_GAME_ACE_PHASE.마투수) {
    // a782: rec+0xe = 칸 · 커서 (0,1) · 메뉴+0xd0 = 0
    return { kind: '고르기', aces: { ...aces, pitcher: cell, phase: PRE_GAME_ACE_PHASE.마타자 } }
  }
  // a76c: rec+0xd = 칸 − 5 → 0xdd
  return { kind: '경기정보', aces: { ...aces, batter: cell - ACES_PER_ROW } }
}

export type PreGameAceCancel =
  | { readonly kind: '고르기'; readonly aces: PreGameAces }
  | { readonly kind: '나감'; readonly scene: SeasonSceneState }

/**
 * 0xd7 의 CLR (0xa900~0xa972, this+0x11c == 1).
 * 마타자 단계면 마투수 단계로 되돌리고, 마투수 단계면 **포스트시즌 0xef · 그 밖 0xd8** 로 나간다.
 * (this+0x11c == 2 코치채용의 CLR 은 0xce 구단관리다 — a974.)
 */
export function cancelPreGameAce(aces: PreGameAces, inPostseason: boolean): PreGameAceCancel {
  if (aces.phase === PRE_GAME_ACE_PHASE.마타자) {
    return { kind: '고르기', aces: { ...aces, phase: PRE_GAME_ACE_PHASE.마투수 } }
  }
  return {
    kind: '나감',
    scene: inPostseason ? SEASON_SCENE_STATE.시즌결산 : SEASON_SCENE_STATE.다음경기,
  }
}

/**
 * 0xdd 의 CLR (0x844e~0x8478) — 국가대항전 중이면 0xf4, 아니면 0xd7(경기 전 마선수 고르기).
 * 웹에는 0xf4 장면이 따로 없어 국가대항전 화면(0xf3)으로 돌아간다 — 원본도 0xf4 의 CLR 이 0xf3 이다.
 */
export function matchInfoCancelScene(inNationalCup: boolean): SeasonSceneState {
  return inNationalCup ? SEASON_SCENE_STATE.국가대항전 : SEASON_SCENE_STATE.선수단
}
