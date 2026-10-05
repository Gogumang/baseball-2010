import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/**
 * 투수편 관리 화면 — ⚠️ **원본 배치 미해독 — 근사**.
 * 원본 상태판(0x7d34c)·커맨드 줄(0x7e418)은 32×32 아이콘 계단형이지만, 투수편 웹 화면들은
 * 공용 판(`PixelScreen`) 관례를 쓰므로 여기서도 줄만 세운다.
 */

/** 두 칸짜리 정보 줄 (이름 — 값) */
export const infoRow = style({
  display: 'flex',
  justifyContent: 'space-between',
  gap: '4px',
  fontSize: '11px',
  lineHeight: '14px',
})

export const infoLabel = style({
  color: ORIGINAL_COLORS.tableDivider,
})

export const infoValue = style({
  color: ORIGINAL_COLORS.text,
})

/** 등판 예고 줄 — 오늘 보직과 다음 선발까지 남은 경기 */
export const dutyValue = style({
  color: ORIGINAL_COLORS.highlightYellow,
})

/** 구질 목록 — 보유한 것만 노랑 */
export const pitchList = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '2px',
})

export const pitchChip = style({
  background: 'transparent',
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  color: ORIGINAL_COLORS.highlightYellow,
  fontSize: '11px',
  lineHeight: '11px',
  padding: '1px 2px',
  cursor: 'pointer',
})

/** 기록실 엔트리 줄 (124 의 목록 칸 자리 — ⚠️ 원본 칸 배치 0x5796c 미해독) */
export const entryRow = style({
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '13px',
  minWidth: '52px',
})

/** 지금 쓰는 칸 (레코드 +0x18) — 원본은 창 안에서 "사용 중" 으로 가른다 */
export const pitchChipSelected = style({
  borderColor: ORIGINAL_COLORS.highlightYellow,
  color: ORIGINAL_COLORS.text,
})

/** 아직 훈련이 덜 된 칸 — StrMODE[71] 로 막히는 자리 */
export const pitchChipLocked = style({
  color: ORIGINAL_COLORS.tableDivider,
})

/** 탭 줄 (마구 1 · 구질 2) */
export const tabRow = style({
  display: 'flex',
  gap: '4px',
  marginBottom: '2px',
})

export const tab = style({
  background: 'transparent',
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  color: ORIGINAL_COLORS.tableDivider,
  fontSize: '11px',
  lineHeight: '11px',
  padding: '1px 4px',
  cursor: 'pointer',
})

export const tabSelected = style({
  color: ORIGINAL_COLORS.highlightYellow,
  borderColor: ORIGINAL_COLORS.highlightYellow,
})

/**
 * 상태 아이콘 줄 자리 — 원본 상태판 0x7d34c 의 박스 11 (4,45,20,19).
 * ⚠️ 이 화면은 공용 판 근사라 세로 자리는 판 흐름을 따르고, 아이콘 x·22px 간격만 원본 박스대로 둔다.
 * 본문 안쪽 여백(10px)만큼 왼쪽으로 당겨 화면 x 를 맞춘다.
 */
export const statusIconRow = style({
  position: 'relative',
  flexShrink: 0,
  height: '19px',
  marginLeft: '-10px',
})
