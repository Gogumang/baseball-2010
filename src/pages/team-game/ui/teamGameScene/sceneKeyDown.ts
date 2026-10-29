import { pushSceneKey } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import { stealBaseOfKey } from '@/features/defense-play/model/pitchArrivalPlay'
import type { StealBase } from '@/pages/team-game/model/useTeamGame'
import type { ChangeWindowKind, MenuOverlay } from './teamGameSceneProps'

/** 공용 키 처리 `0x498d4` 가 그 키를 받은 때의 화면 — 키 효과가 걸 때 든 값 */
export interface SceneKeyState {
  readonly isSceneCovering: boolean
  readonly isPlayKeyBlocked: boolean
  readonly overlay: MenuOverlay | null
  readonly isMenuOpen: boolean
  readonly changeWindow: ChangeWindowKind | null
  readonly stealableBases: readonly StealBase[]
  readonly pressStar: () => void
  readonly closeMenu: () => void
  /** '#' — 받은 다음 틀에 처리한다(`pushSceneKey`) */
  readonly pressHashKey: () => void
  /** 교체 창(0xb)의 CLR — 0x495fc 가 받은 다음 틀에 닫는다 */
  readonly pressChangeWindowClear: () => void
  /** 도루 출발 0x53610 — 공이 나는 동안(상태 0x11)만 */
  readonly steal: (base: StealBase) => void
}

const isClearKey = (key: string) => key === 'Escape' || key === 'Backspace'

/**
 * 이 키를 아예 안 받는 화면 — 공수 교대 판(0x18)에는 공용 키 0x498d4 의 '*'·'#'·도루가 안 열린다(그 상태 범위 밖).
 * 수비 진행 중(상태 0x17)에는 이 키들이 원본에서도 안 먹는다 — '*' 는 경기 상태 0xd~0x15, '#' 는 0xe·0xf 일 때만 열리고(0x498d4),
 * 그 사이 키는 주루·송구가 가져간다. 판이 섰어도 0x11 끝 · 0x12 · 0x13 을 그리는 동안(`isPitchSceneBeforePlay`)은 아직 0x17 전이라
 * '*' 가 열린다('#' 는 `pressHashKey` 가 그대로 막는다). 조작방법 뷰어(경기 중 메뉴 하위 4)의 키는 0x3ca36 이 뷰어 0x637d0 에만
 * 준다 — '*' 도 아무 일 안 한다
 */
function isSceneKeyIgnored(event: KeyboardEvent, state: SceneKeyState): boolean {
  return event.repeat || state.isSceneCovering || state.isPlayKeyBlocked || state.overlay === '조작방법'
}

/**
 * '*' — 경기 중 메뉴. 교체 창(상태 0xb)에서는 '*' 가 안 먹는다 — 0x498d4 의 '*' 가지(4991c)는 상태 0xd~0x15 만 받고,
 * 0xb 의 키 함수 0x495fc 는 '2'·'8'·'#'·'0'·'5' 만 본다. 창을 닫지도 메뉴를 열지도 않는다
 */
function pressStarKey(event: KeyboardEvent, state: SceneKeyState): void {
  event.preventDefault()
  if (state.changeWindow !== null && !state.isMenuOpen) return
  state.pressStar()
}

/** 교체 화면과 메뉴에서 CLR 은 닫기다 (0x495fc 의 '#'·CLR 가지) — 그 밖의 키는 먹고 끝난다 */
function pressKeyUnderMenu(event: KeyboardEvent, state: SceneKeyState): void {
  if (!isClearKey(event.key)) return
  event.preventDefault()
  state.closeMenu()
}

/**
 * CLR — 교체 창이면 0x495fc 의 CLR 을 장면 키 칸으로(다음 틀). 코스 고르기(상태 0x10)의 CLR(−16)은 조준 화면(`AimCursor` 의 onCancel)이
 * 받는다 — 0x50ee0 → 0xf
 */
function pressClearKey(event: KeyboardEvent, state: SceneKeyState): void {
  if (state.changeWindow === null) return
  event.preventDefault()
  pushSceneKey(() => state.pressChangeWindowClear())
}

/**
 * 도루 출발 0x53610 — '3' 1루 주자 · '2' 2루 주자 · '1' 3루 주자(홈으로). 공이 나는 동안(상태 0x11)만 — 그 밖의 키는 원본도 먹고 끝난다.
 * 키는 장면 키 칸에 들어 다음 틀의 키 0x498d4 → 0x53610 이 그 틀의 상태를 본다
 */
function pressStealKey(event: KeyboardEvent, state: SceneKeyState): void {
  const stealBase = stealBaseOfKey(event.key)
  if (stealBase === null || !state.stealableBases.includes(stealBase)) return
  event.preventDefault()
  pushSceneKey(() => state.steal(stealBase))
}

/**
 * 원본 공용 키 처리 `0x498d4` — '\*' 경기 중 메뉴 · '#' 교체 · 도루 '3'/'2'/'1'.
 * (CLR 은 웹에서 Escape·Backspace 로 받는다 — 원본 키 코드 −16.)
 */
export function handleSceneKeyDown(event: KeyboardEvent, state: SceneKeyState): void {
  if (isSceneKeyIgnored(event, state)) return
  if (event.key === '*') return pressStarKey(event, state)
  if (state.isMenuOpen || state.overlay !== null) return pressKeyUnderMenu(event, state)
  if (event.key === '#') {
    event.preventDefault()
    // 장면 키 칸으로 — 받은 다음 틀의 키 0x498d4 '#' 가지(4994a~499f8) · 0xb 키 함수 0x495fc 가 그 틀의 상태를 본다
    pushSceneKey(() => state.pressHashKey())
    return
  }
  if (isClearKey(event.key)) return pressClearKey(event, state)
  pressStealKey(event, state)
}

/** '#' 키를 받은 틀의 화면 (`hashKeyActionOf`) */
export interface HashKeyState {
  readonly isSceneCovering: boolean
  readonly isDefenseInPlay: boolean
  readonly overlay: MenuOverlay | null
  readonly isMenuOpen: boolean
  readonly changeWindow: ChangeWindowKind | null
  readonly isAwaitingConfirm: boolean
  readonly isInConfirmState: boolean
  readonly pitchBusyTicks: number
  readonly canChangePitcher: boolean
  readonly canPinchHit: boolean
}

const isHashKeyClosed = (state: HashKeyState) => state.isSceneCovering || state.isDefenseInPlay || state.overlay !== null || state.isMenuOpen

/**
 * '#' 가지(0x4994a)는 0xe·0xf 에서 열린다 — 0xe 의 OK 뒤 굴림(돌발 0x8f158 · 0xf 진입 0x3d954)은 진행기가
 * OK 를 받을 때 돌리므로(`confirmScene`), 0xe 에서 열어 확정·취소해도 다시 선 0xe 의 OK 뒤 한 번뿐이다.
 * 0xd(대기가 보인 뒤 두 그림)는 0x4994a 의 상태 범위 밖이라 안 열린다. 내 공이 날거나 0x12 인 동안(상태 0x11 · 0x12)도 범위 밖
 */
const isHashKeyOutOfState = (state: HashKeyState) => (state.isAwaitingConfirm && !state.isInConfirmState) || state.pitchBusyTicks > 0

/**
 * '#' 키 — 0x498d4 의 '#' 가지(4994a~499f8)는 0x38984 참이고 상태 0xe · 0xf 면 0x49598 → 0xb(교체 창), 0xb 의 키 함수 0x495fc 의
 * '#' 는 교체 창을 닫는다(취소). 그 밖에서는 0x49598 의 갈림길 그대로 — 공격이 사람이면 대타(0xaf06c), 아니면 투수 교체(0xaf09c)다.
 * 그 틀의 상태를 보므로 지금 값으로 다시 가린다. 할 일이 없으면 null
 */
export function hashKeyActionOf(state: HashKeyState): ChangeWindowKind | '닫기' | null {
  if (isHashKeyClosed(state)) return null
  if (state.changeWindow !== null) return '닫기'
  if (isHashKeyOutOfState(state)) return null
  if (state.canChangePitcher) return '투수'
  return state.canPinchHit ? '대타' : null
}
