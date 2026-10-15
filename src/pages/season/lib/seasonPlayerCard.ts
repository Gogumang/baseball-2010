import {
  advanceBatterAnimation, advancePitcherAnimation, batterPoseOf, pitcherPoseOf,
} from '@/pages/special/lib/hallOfFameFigure'
import type { FigureAnimation, HallOfFameFigureLook } from '@/pages/special/lib/hallOfFameFigure'
import type { SeasonPlayerRecordView } from '@/entities/season-mode/model/seasonPlayerRecord'

/**
 * **시즌 선수 카드** — 카드 0x7ba44 의 시즌 · 선수 갈래(상태 0xd9, 또는 장비 창 0xdc 종류 3)와
 * 그 위에 얹는 선수 그림(0xd9 그림 0xae98 · 0xdc 그림 0xb1f8 b296~b346) — 직접 떴다.
 *
 * ```
 * 0x7ba44 (gfx = 창 객체 0x7b7b8)
 *   [gfx+0x138](mode_ui) 가 있으면 0x76725([gfx+0x134])         ; 계단형 판 — 들어옴 0x5404 가 0x76705(판, 0x67, 0x38, 0)
 *   로고 [gfx+0x140](들어옴 0x5404 가 team_logo 0x6fd9d(0xcc14c, 내 팀, 1)) 가 있으면
 *     (W/2 − w/2 − 0x3e, H/2 − h/2 − 0x32) 에 0xba1d5(…, 1, 0xc, 0) — 상태 0xd9 · 0xdc 는 효과 1 · 인자 12(반투명 12/16)
 *     [gfx+0x168] 이 있고 상태 ≠ 0xdc 면 로고 아래 · 위 딱지(slt_frame 이미지 9 · 116 + img_text 0x41+팀 · 157) — `SEASON_CARD_BADGE`
 *   mode_ui 프레임 8 을 (W/2 + 0x3a − w/2, H/2 − 0x6b) · img_text 159 "ABILITY" 를 (… , H/2 − 0x42 − 0x25)
 *   시즌(0x7b998) · (상태 0xd9 또는 창 종류 [gfx+0x1a4] == 3) 이면 (0x7bede~0x7bf9a)
 *     k = 0..3  기본 0xb6415(기록, k, 0) · 실효 0xb570d(팀레코드, k, 기록, 1, 0x5b, 0) — 견줘 빨강·초록(`seasonCardAbilitiesOf`)
 *     0x5a991(skin, [skin+0xd4], W/2 + 0x3a, H/2 − 0x42 + 10, 종류 = 0xb6278(기록 — 투수) ? 3 : 2, 실효표, 색표, 0x1e)
 *       종류 3 은 축 이름 img_text 37~40(제구·구속·변화·체력) · 2 는 41~44(히트·파워·수비·주루) — 0x5aa40 갈래가 고른 표 0xd1b14 칸
 * 선수 그림 — 박스 = mode_ui 프레임 0 박스 0 (11, 53, 93, 117)
 *   타자(창+0x24c) 그림 vt+0x10(그림, 자세 [this+0x170], 0, 박스 x + w/2, 박스 y + h − 10)   ; 겹침 타자 0x789f0
 *   투수 이미지 [0x1552ae0] 를 0x98975(…, 박스 x, 박스 y − 0x23, −1, −1, 0, 0, 0x10, 2, 1)       ; 효과 0x10 · 2 = 정수 두 배 확대
 *     이미지는 그리기 앞 0xe9ac(ef62~ef94)가 0x65e80(skin, &[0x1552ae0], 투수 그림, 자세 [this+0x170]) 로 54×75 에 떠 둔다
 * ```
 * 그림은 들어옴 0x5404 가 만든다: 그림 vt+8(그림, 팀 = (s8)SR+1 내 팀, 폼 +0xb >> 4, 피부 +0xb bit2-3, 손 0xb63c0, −1) ·
 * 부위 0~3 니블(+0x19 윗 · 아랫, +0x1a 윗 · 아랫) n ≥ 1 이면 vt+0x14(그림, 부위, n − 1) · 그림+0x48 = 0(그림자 끔).
 * 애니는 타자 [this+0x128]: +0x24 = −1 · +0x28 = 폼 · 0xb915d(애니, 5) / 투수 [this+0x124]: +0x24 = −1 · +0xc = 폼 · 0x9dff9(애니, 0).
 *
 * 딱지 [gfx+0x168] (직접 떴다): 창 객체는 장면 0x105 와 수명이 같고(new 가 0 으로 채운다) 이 칸을 적는 곳은
 * 팀 고르기 0xca 진입 0x50a8(0x50c0~0x50d0) · 트레이드 0xe4 진입 0x4774(0x47a6~0x47bc) 둘뿐 — 둘 다 [장면+0xd4] 를 넣는다.
 * [장면+0xd4] 는 장면 셋업 0x3b14 가 0(0x3ee2~0x3ef2), 상태 1 자원 적재 0x75fc 가 비었으면 ui/slt_frame(0x7736~0x775c)이라
 * **이 장면에서 0xca · 0xe4 를 한 번이라도 거쳤으면** 딱지가 서고, 경기로 장면이 지워졌다 새로 서면 다시 0 이다(`hasCardBadge`).
 * 레이아웃은 `SEASON_CARD_BADGE`.
 * 레이더 0x5a990 의 도형 자라는 애니([skin+0xd4] +0xad · +0x1e3 — 0xd9 들어옴 0x5446 · 0xdc 0x5f98 가 0 에서 다시 건다)는
 * `shared/lib/radarGrowth/useRadarGrowth` 가 그린다.
 */

/**
 * 그림 vt+8 · vt+0x14 에 넘기는 값 (들어옴 0x5404) — 폼 +0xb >> 4 · 피부 +0xb bit2-3 · 팀 = 내 팀 · 니블 네 칸.
 * 손 0xb63c0 은 마선수가 아니면 폼 & 1 이고 시즌 명단에는 마선수가 없다(`seasonPlayerRecord.ts` 머리말).
 */
export function seasonCardLookOf(view: Pick<SeasonPlayerRecordView, 'profile' | 'equipment'>, teamId: number): HallOfFameFigureLook {
  const nibble = (part: number) => view.equipment[part] ?? 0
  return {
    form: (view.profile >> 4) & 0xf,
    skin: (view.profile >> 2) & 3,
    team: teamId,
    equipment: [nibble(0), nibble(1), nibble(2), nibble(3)],
  }
}

/** 계단형 판 0x76705(판, 위 0x67, 높이 0x38, 꺾임 0) — 0xd9 들어옴 0x5404 · 생성자 0x76610 기본값 */
export const SEASON_CARD_BOARD = { top: 0x67, height: 0x38, offset: 0 } as const

const SCREEN = { width: 240, height: 320 } as const

/**
 * 계단형 판 꼭짓점 여덟 — 식 0x7650c (위 T · 높이 H · 꺾임 O):
 * (0, T+19) (W/2+O−9, T+19) (W/2+O+10, T) (W, T) (W, T+H−19) (W/2+O+10, T+H−19) (W/2+O−9, T+H) (0, T+H)
 */
export function steppedBoardPointsOf(top: number, height: number, offset: number): readonly { x: number; y: number }[] {
  const left = SCREEN.width / 2 + offset - 9
  const right = SCREEN.width / 2 + offset + 0xa
  return [
    { x: 0, y: top + 0x13 },
    { x: left, y: top + 0x13 },
    { x: right, y: top },
    { x: SCREEN.width, y: top },
    { x: SCREEN.width, y: top + height - 0x13 },
    { x: right, y: top + height - 0x13 },
    { x: left, y: top + height },
    { x: 0, y: top + height },
  ]
}

/** team_logo 77×76 — (W/2 − w/2 − 0x3e, H/2 − h/2 − 0x32), 효과 1 · 인자 12 = 무게 12/16 (R6 3절) */
export const SEASON_CARD_LOGO = {
  x: SCREEN.width / 2 - (77 >> 1) - 0x3e,
  y: SCREEN.height / 2 - (76 >> 1) - 0x32,
  width: 77,
  height: 76,
  opacity: 12 / 16,
} as const

/**
 * 로고 아래 · 위 딱지 — 0x7bbda~0x7bdca (직접 떴다). 판 그림은 [gfx+0x168](ui/slt_frame) 이미지, 글은 img_text 를 그 판에
 * 0xb9e05(정렬 0x22 가운데, ox, oy) 로 놓는다. 로고 크기는 team_logo 77×76.
 * ```
 * 판 A  slt_frame 9  (82×15)  (W/2 − (w >> 1) − 0x3e, H/2 + (로고h >> 1) − 0x30)        ; 0x7bbe8~0x7bc80 · 0xba1d5(…, 0, 0)
 *       0x913e5(img_text, 0) · img_text 0x41 + 팀([gfx+0x24]) 를 판 A 에 0xb9e05(0x22, 0, 0, ox 1, oy −1)   ; 0x7bc84~0x7bcc2
 * 판 B  slt_frame 116 (57×15) (W/2 − (w >> 1) − 0x3e, H/2 − (로고h >> 1) − h − 0x32)     ; 0x7bcc6~0x7bd8a
 *       0x913e5(img_text, 4) · img_text 157 을 판 B 에 0xb9e05(0x22, 0, 0, ox 0, oy −1)                   ; 0x7bd8e~0x7bdca
 * ```
 */
const BADGE_IMAGE_SIZE = { 9: { width: 82, height: 15 }, 116: { width: 57, height: 15 } } as const
const badgeBoardX = (width: number) => SCREEN.width / 2 - (width >> 1) - 0x3e
export const SEASON_CARD_BADGE = {
  name: {
    board: {
      image: 9,
      x: badgeBoardX(BADGE_IMAGE_SIZE[9].width),
      y: SCREEN.height / 2 + (76 >> 1) - 0x30,
      ...BADGE_IMAGE_SIZE[9],
    },
    /** img_text 0x41 + 팀 · 팔레트 0 */
    frameBase: 0x41,
    palette: 0,
    ox: 1,
    oy: -1,
  },
  title: {
    board: {
      image: 116,
      x: badgeBoardX(BADGE_IMAGE_SIZE[116].width),
      y: SCREEN.height / 2 - (76 >> 1) - BADGE_IMAGE_SIZE[116].height - 0x32,
      ...BADGE_IMAGE_SIZE[116],
    },
    frame: 157,
    palette: 4,
    ox: 0,
    oy: -1,
  },
  /** 가운데 정렬 0x22 */
  align: 0x22,
} as const

/** 선수 그림 박스 — mode_ui 프레임 0 박스 0 */
const FIGURE_BOX = { x: 11, y: 53, width: 93, height: 117 } as const

/** 타자 그림 발 자리 (박스 x + w/2, 박스 y + h − 10) · 투수 이미지 왼쪽 위 (박스 x, 박스 y − 0x23) · 두 배 확대 */
export const SEASON_CARD_FIGURE = {
  batter: { x: FIGURE_BOX.x + (FIGURE_BOX.width >> 1), y: FIGURE_BOX.y + FIGURE_BOX.height - 10 },
  pitcherImage: { x: FIGURE_BOX.x, y: FIGURE_BOX.y - 0x23, scale: 2 },
} as const

/** 축 이름 img_text — 0x5a990 종류 3(투수) 37~40 · 종류 2(타자) 41~44 (표 0xd1b14) */
export const SEASON_CARD_RADAR_LABELS = { 투수: [37, 38, 39, 40], 타자: [41, 42, 43, 44] } as const

/* ── 그림 애니 0x45e8 (그리기 앞 0xe9ac ef62 — 상태 0xd9 또는 0xdc 창 종류 3) ─────────────────── */

export interface SeasonCardFigureState {
  readonly animation: FigureAnimation
  /** [this+0x174] — 동작 머무름 */
  readonly hold: number
  /** [this+0x170] — 이번 그림의 자세 */
  readonly pose: number
}

/** 상태 틱 [this+0x2c] 가 0x1e 이거나 0 이 아니고 0x8c 의 배수면 동작을 건다 (0x4600~0x4612 · 0x46a8~0x46ba) */
const TRIGGER_TICK = 0x1e
const TRIGGER_PERIOD = 0x8c
const isTriggerTick = (tick: number) => tick === TRIGGER_TICK || (tick !== 0 && tick % TRIGGER_PERIOD === 0)

const startAnimation = (form: number, state: number): FigureAnimation => ({ state, step: 0, count: 0, form })

/** 들어옴 0x5404 — 타자 0xb915d(애니, 5) 대기 · 투수 0x9dff9(애니, 0) */
export function initialSeasonCardFigure(isBatter: boolean, form: number): SeasonCardFigureState {
  const animation = startAnimation(form, isBatter ? 5 : 0)
  return { animation, hold: 0, pose: isBatter ? batterPoseOf(animation) : pitcherPoseOf(animation) }
}

/**
 * 0x45e8 한 번 (틱 = [this+0x2c]):
 * ```
 * 타자  걸면 상태 2(준비) · 머무름 0
 *       상태 3(스윙) 이고 단계 ≥ (폼 2·3 ? 4 : 6) 이면 머무름 ++ — 올리기 전 값 > 13 이면 상태 5(대기)
 *       상태 2 이고 단계 ≥ 1 이면 머무름 ++ — 올리기 전 값 > 4 이면 상태 3 · 머무름 0
 *       애니 vt+8(0xb928d) 한 걸음 · 자세 0xb905d
 * 투수  걸면 상태 1(투구) · 머무름 0
 *       상태 1 이고 단계 > 11 이면 머무름 ++ — 올리기 전 값 > 4 이면 상태 0 · 머무름 0
 *       애니 vt+8(0x9e005) 한 걸음 · 자세 0x9e0b9
 * ```
 */
export function stepSeasonCardFigure(state: SeasonCardFigureState, tick: number, isBatter: boolean): SeasonCardFigureState {
  let { animation, hold } = state
  const { form } = animation
  if (isBatter) {
    if (isTriggerTick(tick)) {
      animation = startAnimation(form, 2)
      hold = 0
    }
    if (animation.state === 3) {
      const swingSteps = form - 2 >= 0 && form - 2 <= 1 ? 4 : 6
      if (animation.step >= swingSteps) {
        const held = hold
        hold += 1
        if (held > 0xd) animation = startAnimation(form, 5)
      }
    } else if (animation.state === 2 && animation.step >= 1) {
      const held = hold
      hold += 1
      if (held > 4) {
        animation = startAnimation(form, 3)
        hold = 0
      }
    }
    animation = advanceBatterAnimation(animation)
    return { animation, hold, pose: batterPoseOf(animation) }
  }
  if (isTriggerTick(tick)) {
    animation = startAnimation(form, 1)
    hold = 0
  }
  if (animation.state === 1 && animation.step > 0xb) {
    const held = hold
    hold += 1
    if (held > 4) {
      animation = startAnimation(form, 0)
      hold = 0
    }
  }
  animation = advancePitcherAnimation(animation)
  return { animation, hold, pose: pitcherPoseOf(animation) }
}
