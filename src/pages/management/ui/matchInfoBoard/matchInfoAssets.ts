import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

export const SLT_IMAGE = assetUrl('./sprites/slt_frame')
export const SLT_FRAME = assetUrl('./sprites/slt_frame/frames')
export const IMG_TEXT_FRAME = assetUrl('./sprites/img_text/frames')

export const imageSrc = (folder: string, index: number) => `${folder}/${String(index).padStart(3, '0')}.png`

/** 누름 칸이 보내는 키 — 키 처리(`useEffect` 안 window 듣개)가 그대로 받는다 */
export const pressKey = (key: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key }))

/** 경기정보 키가 할 일 — 시즌 0x83cc · 나리 0x13c30 공용 (나리에는 '0' 설정 갈래가 없다) */
type MatchInfoKeyAction = 'start' | 'settings' | 'cancel' | 'userEntry' | 'cpuEntry'

/** −5(OK) · '5' → 경기 시작 · '0' → 경기진행 설정 · −16 → 취소 · −3 · '4' → 유저 팀 엔트리 · −4 · '6' → CPU 팀 엔트리 */
const MATCH_INFO_KEYS = new Map<string, MatchInfoKeyAction>([
  ['Enter', 'start'],
  ['5', 'start'],
  ['0', 'settings'],
  ['Escape', 'cancel'],
  ['ArrowLeft', 'userEntry'],
  ['4', 'userEntry'],
  ['ArrowRight', 'cpuEntry'],
  ['6', 'cpuEntry'],
])

/** 그 키의 할 일이 있으면 기본 동작을 막고 부른다 — 없는 갈래(엔트리를 안 넘긴 화면 따위)는 아무것도 안 한다 */
export function runMatchInfoKey(event: KeyboardEvent, actions: Partial<Record<MatchInfoKeyAction, () => void>>) {
  const action = MATCH_INFO_KEYS.get(event.key)
  const run = action === undefined ? undefined : actions[action]
  if (run === undefined) return
  event.preventDefault()
  run()
}
