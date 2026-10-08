/**
 * 시즌 상태 **0xe3** 외출 연출 — 진입 0x5184 · 키 0x4944 · 갱신 0xce0c · 그리기 0xa06c (직접 떴다).
 *
 * ```
 * 0x4a94  확인 팝업 0x16 에 "예" → [gfx+0x184] = 장소 p(this+0xf8) · 0xe3
 * 0x5184  0x85074(gfx)
 * 0x85074 [gfx+0x184] 점프표 0xd4a90 → 애니 k:
 *           0 → 시즌(0x7b998)이면 team_traning_ani.pzx 애니 **5**, 아니면 1 · 1 → 0 · 2 → 2 · 3 → 4 · 4 → 3  (그 밖 event_ani.pzx)
 *         [gfx+0x1c8] = 그 애니
 *         시즌이고 k == 5 면 덧애니 없음. 아니면 [gfx+0x1c0] = event_char_1.pzx 애니 k + 30 ·
 *         [gfx+0x1c4] = event_char_0.pzx 애니 k + 0x5d (시즌은 팔레트 −1 — 바꾸지 않는다)
 *         게이지 0x84634(gfx, 31, 60) — 훈련 팝업과 같은 60 갱신
 * 0x4944  확인(−5 / '5') → [gfx+0x1d0] = [gfx+0x1d8] (게이지 끝으로) · 그 밖 키 없음 (취소 없음)
 * 0xce0c  0x84e58(애니 끝 — 한 번만 참, 세 애니를 놓는다) → 0xc81c(굴림 · 적용 · 결과 팝업 0x17 · SR+4 = 1 · 저장)
 *         팝업 0x17 이 답 0 · 0x14 로 닫히면 SR+4 = 1 · 0xc9
 * 0xa06c  외출 지도 0x7ea64(gfx, p, 0) → 가운데 정렬판 0x84ea0(gfx)
 * 0x84ea0 R = mode_ui 프레임 10 박스 0 (0, 65, 240, 72) · d = H/2 − (R.y + R.h/2) = 59 (F 5-2)
 *         R+d 검정 · 위 띠 (0, y−11, W, 11) #395DCE 첫 줄 #294DAD 둘째 줄 #4A7DFF ·
 *         아래 띠 (0, y+h, W, 11) #395DCE 줄 h+9 #4A7DFF · h+10 #294DAD → 0x848d0(gfx, 0, d)
 * 0x848d0 캐릭터 끔 — mode_back 창 (1, R.y + d + 1, −14) · 잘라내기 (0, 0, W, R.y + R.h + d − 1) ·
 *         [+0x1c8] · [+0x1c0] · [+0x1c4] 를 모두 ((R.x + R.w)/2, R.y + R.h + d) 에 · 잘라내기 풀고 게이지 0x847e0(1, R.y + R.h + d)
 *         [+0x1c8] 가 비면(애니 끝 뒤) 통째로 안 그린다
 * ```
 * 연출 동안 난수는 없다 — 0x85074 · 0x848d0 · 0x84e58 · 0x84ea0 어디에도 0xbfa54 · 0x9d468 호출이 없다(난수 호출 목록 전수).
 */
export interface SeasonOutingPresentation {
  readonly folder: string
  readonly animation: number
  /** event_char_1 애니 k + 30 · event_char_0 애니 k + 0x5d — 시즌 칸 0 은 없다 */
  readonly overlays: { readonly char1: number; readonly char0: number } | null
}

const EVENT_ANI = './sprites/event_ani/frames'
const TEAM_TRAINING_ANI = './sprites/team_traning_ani/frames'
export const EVENT_CHAR_1 = './sprites/event_char_1/frames'
export const EVENT_CHAR_0 = './sprites/event_char_0/frames'

const eventPresentationOf = (k: number): SeasonOutingPresentation => ({
  folder: EVENT_ANI, animation: k, overlays: { char1: k + 30, char0: k + 0x5d },
})

/** 장소 p → 연출 (점프표 0xd4a90, 시즌 갈래) */
export const SEASON_OUTING_PRESENTATIONS: readonly SeasonOutingPresentation[] = [
  { folder: TEAM_TRAINING_ANI, animation: 5, overlays: null },
  eventPresentationOf(0),
  eventPresentationOf(2),
  eventPresentationOf(4),
  eventPresentationOf(3),
]

/** 가운데 정렬판의 창 R (mode_ui 프레임 10 박스 0) 과 세로 보정 d */
export const OUTING_PANEL = { x: 0, y: 65, width: 240, height: 72, d: 59 } as const
/** 띠 높이 */
export const OUTING_PANEL_BAND = 11

/** 확인 키 (0x4944: −5 · '5') */
export const isSeasonOutingSkipKey = (key: string): boolean => key === 'Enter' || key === '5' || key === ' '
