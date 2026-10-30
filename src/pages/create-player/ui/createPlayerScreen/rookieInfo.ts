import type { RookieProfile } from '@/entities/career/model/playerCareer'
import { TEAMS } from '@/shared/config/original/teams'
import { CHOICES, ROOKIE_BATTING_ORDER, ROW_ORDER } from '@/pages/create-player/lib/createPlayerLayout'
import type { InfoCellId } from '@/pages/create-player/lib/createPlayerLayout'

/** 정보 칸 하나의 글 — 팀명 · 이름 · 필살(신인은 필살타법이 없어 빈 칸) · 타순(신인 8번), 그 밖은 고른 값의 이름 */
export function rookieInfoValueOf(id: InfoCellId, teamId: number, name: string, profile: RookieProfile): string {
  if (id === '팀명') return (TEAMS[teamId] ?? TEAMS[0]).name
  if (id === '이름') return name
  // 필살 = 선수 +0x18 필살 번호의 이름
  if (id === '필살') return ''
  if (id === '타순') return String(ROOKIE_BATTING_ORDER)
  const choice = CHOICES[id]
  return choice.options[choice.valueOf(profile)] ?? ''
}

/** 줄을 옮길 때 — 이름 줄로 오면 입력 초점을 주고, 이름 칸을 떠나면 놓아 좌우가 값 바꾸기로 간다 */
export function focusNameInputFor(row: number) {
  const nameInput = document.querySelector<HTMLInputElement>('input[aria-label="이름"]')
  if (row === ROW_ORDER.indexOf('이름')) nameInput?.focus()
  else nameInput?.blur()
}
