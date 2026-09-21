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
  fontSize: '9px',
  lineHeight: '13px',
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
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  color: ORIGINAL_COLORS.highlightYellow,
  fontSize: '8px',
  lineHeight: '11px',
  padding: '1px 2px',
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
  fontSize: '8px',
  lineHeight: '11px',
  padding: '1px 4px',
  cursor: 'pointer',
})

export const tabSelected = style({
  color: ORIGINAL_COLORS.highlightYellow,
  borderColor: ORIGINAL_COLORS.highlightYellow,
})
