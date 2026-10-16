import type { BurstJudgement } from '@/entities/burst-mission/model/burstMissionJudge'
import { BURST_TEXT_LINE } from '@/entities/burst-mission/model/burstMissionJudge'
import type { BurstMissionRow } from '@/entities/burst-mission/model/burstMissionRow'

/**
 * 돌발미션 창 — 경기 장면 **상태 0x1b**(갱신 0x3b014 → 0x8e5b8 · 그리기 0x4a198 → 0x8f3c0, r126 직접 떴다).
 *
 * ```
 * 그리기 0x4a198   타석 화면(0x38d1c · 0x49e64 · 0x35b94 · 0xbe6a1) 위에
 *                  0x8f3c0(돌발, 0xb63c0(지금 타자)) → [+0x223] = 좌타 · 0x8f29c 판 · 0x8ea18 글 · [+0x221] > 0 이면 흔들기
 *                  그 뒤 0x8e858 돌발 띠(타석 화면 쪽 그림)
 * 0x8f29c 판       [+0xc] = −1 이면 안 그림. h = s8 [+0x220]
 *                  초상 [+0x238] 0x93c45: 좌타면 (35, H − h − 13) 깃발 0x11(뒤집기) · 우타면 (W − 40, H − h − 13) 깃발 0
 *                  → 0x93cfd(초상, 1)(이미 돌면 아무 일 없음) · 0x93d91 한 칸
 *                  윗 띠 0x8f194((0, H − h − 12, W, 12), W − 67)
 *                  본체 0xb9f75((0, H − h, W, h), 0xB4000000) — 검정 알파 0xB4
 * 0x8f194 윗 띠    검정 (0, y, W, 12) → #5573D6 (0, y + 1, W, 10) → #243677 (0, y + 2, W, 10)
 *                  사선 i = 0..10: 줄 y + 11 − i 에 점 (px + i) 검정 · (px + i ± 1) #5573D6  (px = W − 67)
 * 0x8ea18 글       [+0x221] ≠ −1 이거나 [+0xc] = −1 이면 안 그림
 *                  "!cFFFFFF[" "!c00CC00" StrCOMMON[0x71 + 화자] "!cFFFFFF] : " + 대사 줄 → 0xba269(5, H − h + 3, 폭 W − 25, 흰)
 *                  넘김 표시 game_ui 이미지 0x34([+0x23c] = 장면+0x1018, 0x48c6e) 를 (W − 15, t % 8 ≤ 3 ? H − 8 : H − 10)
 *                  (t = [+0x224])
 * 갱신 0x8e5b8     [+0x224] += 1
 *                  h ≠ 55 이면 h = min(55, 2h + 2)
 *                  h = 55 이면 c = s8 [+0x221]: c = −1 이거나 c > 2 면 −1, 아니면 c + 1
 *                  c ≠ −1 이거나 키([장면+0x40]) 없으면 끝(0)
 *                  키 → [+0x21c] = 2(성공) 이면 결과 글을 공용 창 0x74ef5([0x140005c], 글, 1, 0, 0) 로 ·
 *                       [+0x21c] = 1(실패) 이고 행 b15 ≠ 0 이면 실패 글을 같은 창으로 → 1(상태 0xf 로)
 * ```
 * 대사를 실을 때(발동 0x8f000 · 판정 0x8f414) 0x8e2dc 가 h = c = 0 으로 되돌리고 초상을 0x63a04(…, 화자, 표정)로 다시 싣는다.
 */

/** 원본 화면 (RawScreen 한 장) */
export const BURST_SCREEN = { width: 240, height: 320 } as const

/** 다 오른 판 높이 — 0x8e5d6 `cmp #0x37` */
export const BURST_BOX_FULL_HEIGHT = 55

/** 흔들기 카운터 c = [+0x221]. −1 = 다 열림(글 · 키) */
export const BURST_SHAKE_DONE = -1

export interface BurstWindowState {
  /** [+0x220] 판 높이 */
  readonly height: number
  /** [+0x221] 흔들기 카운터 — 0 시작 · 1..3 흔들기 · −1 다 열림 */
  readonly shake: number
  /** [+0x224] 갱신 수 — 넘김 표시 위아래 */
  readonly ticks: number
}

/** 대사를 실은 순간 (0x8e2dc: +0x220 = +0x221 = 0) */
export const BURST_WINDOW_START: BurstWindowState = { height: 0, shake: 0, ticks: 0 }

/** 갱신 0x8e5b8 의 앞부분 한 번 (키 처리 앞) */
export function tickBurstWindow(state: BurstWindowState): BurstWindowState {
  const ticks = state.ticks + 1
  if (state.height !== BURST_BOX_FULL_HEIGHT) {
    return { ...state, ticks, height: Math.min(BURST_BOX_FULL_HEIGHT, state.height * 2 + 2) }
  }
  const shake = state.shake === BURST_SHAKE_DONE || state.shake > 2 ? BURST_SHAKE_DONE : state.shake + 1
  return { ...state, ticks, shake }
}

/** 키를 받는가 — 0x8e60c: c = −1 일 때만 */
export const isBurstWindowOpen = (state: BurstWindowState): boolean => state.shake === BURST_SHAKE_DONE

/** 0x8f3c0 흔들기 — c > 0 이면 0xba888(화면, 0, c 홀수 ? 1 : −1). 아니면 null */
export function burstShakeOffsetOf(state: BurstWindowState): { readonly x: number; readonly y: number } | null {
  if (state.shake <= 0) return null
  return { x: 0, y: (state.shake & 1) !== 0 ? 1 : -1 }
}

/** 0x8f194 윗 띠 높이 */
export const BURST_BAND_HEIGHT = 12

/** 윗 띠 · 본체 색 (0x8f194 · 0x8f392) */
export const BURST_COLORS = {
  bandEdge: '#000000',
  bandLight: '#5573D6',
  bandFill: '#243677',
  /** 0xB4000000 — 검정 알파 0xB4 */
  body: `rgba(0, 0, 0, ${0xb4 / 0xff})`,
} as const

/** 사선 머리 px = W − 0x43 (0x8f364 · 0x8f36a) */
export const BURST_BAND_SLASH_X = BURST_SCREEN.width - 0x43
/** 사선 길이 — 줄 y + 11 부터 y + 1 까지 (0x8f21a~0x8f280) */
export const BURST_BAND_SLASH_LENGTH = BURST_BAND_HEIGHT - 1

/** 윗 띠 맨 위 줄 y — H − h − 12 (0x8f2d6~0x8f2de) */
export const burstBandTopOf = (height: number): number => BURST_SCREEN.height - height - BURST_BAND_HEIGHT

/** 초상 자리 — 0x8f310~0x8f33c. 좌타면 왼쪽(35) 깃발 0x11, 우타면 오른쪽(W − 40) */
export function burstPortraitAnchorOf(height: number, isBatterLeftHanded: boolean) {
  return {
    x: isBatterLeftHanded ? 0x23 : BURST_SCREEN.width - 0x28,
    y: BURST_SCREEN.height - height - 0xd,
    isFlipped: isBatterLeftHanded,
  } as const
}

/** 표 0xd0ae6 — 인물 → 애니 바탕 (`pages/management/lib/centerStage` · `features/play-game/model/aceCutIn` 과 같은 표) */
const PORTRAIT_ANIMATION_BASE: readonly number[] = [-1, -1, 16, 23, 30, 37, 44, 51, 58, 65, 0, 7, 15, 23, 72, 79, 86, 40, 16, 8, 0, 24, 32]

/**
 * 초상 0x8e2dc → **0x63a04([0x1552cfc], 화자, 표정)** — 10~13 `event_char_1` · 17~22 `event_char_2` · 그 밖 `event_char_0`,
 * 애니 = 0xd0ae6[화자] + 표정. 화자 1(육성 선수 — 장타형 8 · 피부 팔레트)과 8 · 9(팔레트 2)는 돌발 대사에 없다(세 표 `_TEXT`
 * 전수: 2 · 3 · 4 · 5 · 6 · 10~13 · 17~22) — 그 화자면 null(안 그림).
 */
export function burstPortraitOf(speaker: number, expression: number): { readonly file: string; readonly animation: number } | null {
  if (speaker === 1 || speaker === 8 || speaker === 9) return null
  const base = PORTRAIT_ANIMATION_BASE[speaker]
  if (base === undefined || base < 0) return null
  const file = speaker >= 10 && speaker <= 13 ? 'event_char_1' : speaker >= 17 && speaker <= 22 ? 'event_char_2' : 'event_char_0'
  return { file, animation: base + expression }
}

/** 글 자리 — 0x8ea2c · 0x8ead0~0x8ead6 */
export function burstTextBoxOf(height: number) {
  return { x: 5, y: BURST_SCREEN.height - height + 3, width: BURST_SCREEN.width - 0x19 } as const
}

/** 넘김 표시 — game_ui 이미지 0x34 (0x8eaf4 · 0x8eb0a~0x8eb20) */
export const BURST_NEXT_MARK_IMAGE = './sprites/game_ui/052.png'
export function burstNextMarkAt(ticks: number) {
  return {
    x: BURST_SCREEN.width - 0xf,
    y: ticks % 8 <= 3 ? BURST_SCREEN.height - 8 : BURST_SCREEN.height - 0xa,
  } as const
}

/**
 * 화자 이름 StrCOMMON[0x71 + 화자] (0x8ea7a) — StrCOMMON 113~136 원문.
 * 웹에 StrCOMMON 표가 없어 쓰는 칸을 원문 그대로 적는다(`base/extracted/StrCOMMON.json`).
 */
const SPEAKER_NAMES_FROM_0X71: readonly string[] = [
  '뱀파이어', '용인족', '감독', '주장', '선배', '안경', '꼬맹이', '김감독', '금발', '장발', '메디카', '레오니',
  '로제', '발렌타인', '동료', '동료', '동료', '싸이커', '붕붕머신', '드래고나', '어거지죠', '크라이져', '킹타이거', '모두',
]

/** 0x8ea50~0x8ea8e — 이름 머리 "!cFFFFFF[" "!c00CC00" 이름 "!cFFFFFF] : " (0xd5150 · 0xd515c · 0xd5168) */
export function burstSpeakerPrefixOf(speaker: number): string {
  return `!cFFFFFF[!c00CC00${SPEAKER_NAMES_FROM_0X71[speaker] ?? ''}!cFFFFFF] : `
}

/** `_TEXT` 4줄 중 **제안** 줄 — 발동 0x8f000 이 [+0x222] = 0 */
export const BURST_PROPOSAL_LINE = 0

/** 지금 보여 줄 `_TEXT` 줄 번호. 판정이 없으면(아직 타석 전) 제안 줄이다 */
export function burstLineIndexOf(judgement: BurstJudgement | null): number {
  return judgement === null ? BURST_PROPOSAL_LINE : BURST_TEXT_LINE[judgement]
}

/** 보상 이름 표 [0x14002c8] — 0 없음 · 1 사기 · 2 인기도 · 3 평판 · 4 소지금 (0xd4fb4~0xd4ff8) */
const REWARD_NAMES: readonly string[] = [
  '!C!cffffff없음', '!C!cffffff사기', '!C!cffffff인기도', '!C!cffffff평판', '!C!cffffff소지금',
]
/** 소지금(4) 보상은 표시 값을 ×100 (0x8e68e · 0x8e6ee) */
const MONEY_KIND = 4
const MONEY_DISPLAY_SCALE = 100

const asSignedByte = (value: number): number => (value > 127 ? value - 256 : value)

/**
 * **결과 공용 창 글 — 0x8e5b8 키 갈래** (0x8e64a~0x8e706 성공 · 0x8e764~0x8e7a6 실패). 띄우지 않으면 null.
 * ```
 * 성공(+0x21c = 2)  "!C!cffffff[" "!cffff00돌발미션 성공!!" "!cffffff]!N"
 *                   b10 ≠ 0 이면 이름[b10] " +" s8(b11)(b10 = 4 면 ×100)
 *                   b12 ≠ 0 이면 "!N" 이름[b12] " +" s8(b13)(b12 = 4 면 ×100)
 * 실패(+0x21c = 1)  b15 = 0 이면 창 없음. "!C!cffffff[" "!cff5500돌발미션 실패!!" "!cffffff]!N"
 *                   b14 ≠ 0 이면 이름[b14] " -" s8(b15)   (소지금도 ×100 이 없다 — 원본 그대로)
 * 무효(3)           창 없음
 * ```
 * 표시 값은 부호 있는 바이트다(`lsls #0x18 ; asrs #0x18` · `ldrsb`). 실제 보상 적용(0x8e34c)은 따로다.
 */
export function burstResultPopupTextOf(judgement: BurstJudgement | null, row: BurstMissionRow | null): string | null {
  if (row === null) return null
  if (judgement === '성공') {
    let text = '!C!cffffff[!cffff00돌발미션 성공!!!cffffff]!N'
    const [first, second] = row.successRewards
    const valueOf = (reward: { readonly kind: number; readonly amount: number }) =>
      reward.kind === MONEY_KIND ? asSignedByte(reward.amount) * MONEY_DISPLAY_SCALE : asSignedByte(reward.amount)
    if (first.kind !== 0) text += `${REWARD_NAMES[first.kind] ?? ''} +${valueOf(first)}`
    if (second.kind !== 0) text += `!N${REWARD_NAMES[second.kind] ?? ''} +${valueOf(second)}`
    return text
  }
  if (judgement === '실패') {
    const penalty = row.failurePenalty
    if (penalty.amount === 0) return null
    let text = '!C!cffffff[!cff5500돌발미션 실패!!!cffffff]!N'
    if (penalty.kind !== 0) text += `${REWARD_NAMES[penalty.kind] ?? ''} -${asSignedByte(penalty.amount)}`
    return text
  }
  return null
}
