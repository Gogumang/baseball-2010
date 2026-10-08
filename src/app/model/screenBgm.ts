import { useEffect, useRef, useState } from 'react'
import type { SoundPort } from '@/shared/api/audio/soundPort'
import type { Screen } from '@/app/model/screen'
import type { PitcherScene, PitcherStoryContext } from '@/app/model/usePitcherLeagueSession'

/**
 * 화면 → 배경음 번호 (`shared/config/original/sounds` 의 `scene` 칸 그대로).
 *
 * ```
 * 1  메인메뉴          장면 0x103 상태 3~5 (타이틀 뒤 메뉴)
 * 3  모드 준비·설정    0x105 상태 202 · 0x106 상태 101 · 0x107 로비
 * 4  관리 화면         시즌(0x105)·나만의리그(0x106) 관리
 * —  경기              0x104 — 상태 7 갱신 0x3e340 의 맨 앞 0x3e350 이 소리를 끊고(0x6e418) 시작한다. 경기 안 배경음은
 *                      자동진행 중계 0x21 진입 0x3abf0 의 33(모드 {1,2,8,9} · 속도 ≠ 2 — `TeamAutoRelay`)과
 *                      벤치클리어링 44(한 번)뿐이다. 끊기는 장면을 세우는 쪽(`useTeamGame` · `usePitcherGame` ·
 *                      나리 타자편 · 미션 · 홈런더비의 상태 7 자리)이 그리는 때 한다 — 화면 표는 안 바꾼다(null)
 * 40 이벤트(대화)      0x106 상태 114 · 0x105 상태 211 — 두 가드(`STORY_BGM`)
 * 46 엔딩              0x106 상태 141 · 0x105 상태 245 예약 (141 은 e ≤ 1 이면 52 — `endingBgmOf`, 245 는 e == 0 이면 52 — `seasonEndingBgmOf`)
 * ```
 *
 * `null` 은 **배경음을 바꾸지 않는 화면**이다 — 끄지 않고 울리던 것을 그대로 둔다.
 * 원본도 배경음이 없는 상태로 넘어갈 때 따로 끄지 않는다 (통로는 하나뿐이라 다음 배경음이
 * 가져갈 때 자연히 바뀐다, 0x6e9d4).
 *
 * ⚠️ **근사한 곳**: 시즌·나만의리그·미션의 **안쪽 화면**은 최상위 `Screen` 한 칸(`시즌모드`·
 * `투수편` 등)으로 뭉쳐 있어 관리·준비를 여기서 가를 수 없다. 모드에 들어가는 순간은 원본도
 * 준비 화면(3)이므로 3 을 쓰고, 관리 화면(4)으로 갈라 주는 일은 그 라우트가 제 장면 번호를
 * 알게 되면 그때 넘긴다. 타이틀은 **소리를 안 튼다** — 원본도 로고 음성(0)만 내고 배경음은
 * 메뉴에 들어가서야 튼다.
 */
export const SCREEN_BGM = {
  메인메뉴: 1,
  // 도움말 · 스페셜 · 나리편선택은 없다 — 모두 장면 0x103 안의 상태(7 · 13 · 하위 목록)라 진입이 상태 표
  // 0xcea84 의 아무것도 안 하는 칸이다. 메뉴의 1 이 이어진다. 환경설정(8)은 진입 0x259fc 가 소리를 끊는다(`stopsSoundOnEnter`) —
  // 그래서 돌아올 때 0x24a40 이 1 을 처음부터 다시 튼다(`useScreenBgm`)
  팀선택: 3,
  선수등록: 3,
  시즌모드: 3,
  투수편: 3,
  일반모드: 3,
  미션선택: 3,
  // 홈런더비는 없다 — 선수 고르기는 장면 0x103 하위 16(메뉴 안)이라 메뉴의 1 이 이어지고, 경기는 0x3e350 이 끊는다
  관리: 4,
  // 109 진입 0x10d8c: 이전 ≠ 105 면 배경음 4. 105(관리, 4)에서 오면 이미 4 라 그대로다
  다음경기순위: 4,
  아이템: 4,
  외출: 4,
  성적: 4,
  엔딩: 46,
} as const satisfies Partial<Record<Screen['kind'], number>>

/**
 * 포스트시즌 대진 128 의 배경음 — 진입 0x120a4 의 첫 줄(0x120a6~0x120be):
 * ```
 * if [장면+0x28](이전 상태) == 1:  0x6ea6d(소리, 4, −1, 1)   ; 관리 화면 배경음 4 를 반복으로
 * ```
 * 이전 상태 1 은 상태 100(재진입)이 거쳐 보내는 자원 적재 칸이라 **이어하기로 돌아온 때**뿐이다.
 * 그 밖에는 128 이 배경음을 안 건드린다 — 들어오는 길(131 뒤 · 경기 뒤 116)이 모두 이벤트 재생 114 를 지나온다.
 * 114 진입 0x11d00 은 S+0x50 ≠ 2 일 때만 40 을 튼다(`STORY_BGM_GUARD`): 131 뒤(S+0x50 = 0xe)는 40 이 이어지고,
 * **경기 뒤**(116 진입 0x1278c 가 S+0x50 = 2)는 안 튼다 — 경기 장면이 끊은 채(0x3e350)로 128 에 온다(null).
 * 웹은 116 → 114 화면이 없어 128 에 들어선 앞 화면(경기 결과 116)으로 가른다.
 */
const POSTSEASON_REENTRY_BGM = 4

/**
 * 이벤트 재생 배경음 40 의 두 가드 — 나리 114 진입 0x11d00(11d3a~11d5c) · 시즌 0xd3 진입 0x5110(512c~5152) 이 같다:
 * ```
 * 0x8be21(이벤트 시작) 뒤
 * if S+0x50 ≠ 2 && [관리자+0x39f] == 0:  0x6ea6d(소리, 0x28, −1, 1)
 * ```
 * - S+0x50 == 2 — 나리는 116 진입 0x1278c 가 쓰고(경기 뒤 116 → 114), 114 진입이 이 검사 **뒤에** 3(또는 0xb)으로 고친다
 *   (11d60~11d88). 시즌은 SR+0x50(phase) 2 = 정규시즌 경기 끝(0x4f044).
 * - [관리자+0x39f] — 내장 이벤트 표시. 쓰는 곳은 0x8a680(8a6e2, = 1) 하나 — 시즌 0xc038(연초 목표) · 나리 115 0x16aac
 *   (연초 이벤트)가 부른다. 0x8cf64(재생 끝)가 지운다.
 * 22경기 뒤 중간평가(117 → 114)는 105 진입 0x11910(1198c~11990)이 S+0x50 = 3 을 쓴 뒤라 40 이 난다.
 */
const STORY_BGM = 40

/** 엔딩 141 에서 부상 · 방출 · 판정 없음(e ≤ 1) 쪽 배경음 0x34 */
const ENDING_SAD_BGM = 52
/**
 * 나리 엔딩 141 의 배경음 — 진입 0x12300 이 e = 0xa3a85(S) 를 구한 뒤(12310) 곧바로:
 * ```
 * 12328  cmp e, #1 ; bgt 12332      ; 부호 있는 비교 — e = −1(판정 없음) · 0(부상) · 1(방출)은 0x34
 * 1232e  r1 = 0x34                  ; 그 밖(은퇴 2~9)은 12334 r1 = 0x2e
 * 1233c  0x6ea6d(소리, r1, −1, 1)    ; 반복 즉시 재생
 * ```
 * 모드 갈림이 없어 타자편 · 투수편 같다.
 */
export function endingBgmOf(endingIndex: number): number {
  return endingIndex <= 1 ? ENDING_SAD_BGM : SCREEN_BGM.엔딩
}

/**
 * 시즌모드(장면 0x105) 10년차 엔딩 상태 0xf5 의 배경음 — 진입 0x6be8 (직접 떴다):
 * ```
 * 6bfc  r5 = 0xa3085(SR)            ; 시즌 엔딩 판정 0xa3084 (`judgeSeasonEnding`) — 연차 idx ≠ 9 면 −1, 그 밖 0~4
 * 6c0c  0x87919(엔딩 판, r5)
 * 6c12  cmp r5, #0 ; bne            ; 0(비 인기 구단)이면 SR+0x7b = 1 · 저장(6c16~6c2e)
 * 6c4a  cmp r5, #0 ; bne 6c54       ; 0 → r1 = 0x34(52) · 그 밖(1~4 · −1) → 0x2e(46)
 * 6c5a  0x6e499(소리, r1, 1)         ; 예약 · 반복
 * ```
 * 나리 141(`endingBgmOf`, e ≤ 1 이면 52)과 달리 **0 하나만** 52 다. r5 는 0xa3084 의 엔딩 번호 그대로다(1 지역 인기 구단도 46).
 */
export function seasonEndingBgmOf(endingIndex: number | null): number {
  return endingIndex === 0 ? ENDING_SAD_BGM : SCREEN_BGM.엔딩
}

/**
 * 메인 메뉴(장면 0x103)에 들어설 때 배경음 1 을 **처음부터** 다시 트는가 — 같은 1 이 돌고 있어도 끊고 다시 튼다
 * (0x6ea6c 는 같은 번호도 0x6e9d4 가 울리던 것을 끊고 새로 튼다).
 * - 상태 4(처음 메뉴) 진입 0x24a40 의 24a8c~24aa2: 이전 상태가 0(타이틀) 또는 8(환경설정)이면 `0x6ea6d(소리, 1, −1, 1)`.
 *   타이틀에서는 울리던 것이 없어 들리는 것이 같으니 **환경설정에서 돌아올 때**만 갈린다.
 * - 상태 5(게임시작 목록) 진입 0x25b88 의 25c24~25c38: 이전 상태 ≠ 4 면 0x6e418 로 끊고 1 — 웹은 `openTier` 5 로
 *   장면을 새로 세울 때(나리 105 취소 0x126e6 · 시즌 0xc9 취소 0x8f5a)다. 메뉴 안에서 4 → 5 로 내려갈 때는 안 다시 튼다.
 */
export function restartsMenuBgm(previousKind: Screen['kind'] | null, screen: Screen): boolean {
  if (screen.kind !== '메인메뉴' || previousKind === '메인메뉴') return false
  return previousKind === '환경설정' || screen.openTier === 5
}

/**
 * 최상위 화면의 배경음과 **다시 틀기 표** — 화면이 바뀐 그리기에서 `restartsMenuBgm` 이 참이면 표가 하나 오른다.
 * `useSceneBgm` 이 표가 오르면 같은 번호라도 끊고 처음부터 튼다.
 */
export function useScreenBgm(screen: Screen): { readonly bgm: number | null; readonly restartSerial: number } {
  const [previousKind, setPreviousKind] = useState<Screen['kind'] | null>(null)
  const [enteredFrom, setEnteredFrom] = useState<Screen['kind'] | null>(null)
  const [restartSerial, setRestartSerial] = useState(0)
  // 그리는 중에 앞 값과 견줘 고친다 (`usePitcherLeagueBgm` 과 같은 꼴 — 효과 한 틀 늦지 않게)
  if (screen.kind !== previousKind) {
    setPreviousKind(screen.kind)
    setEnteredFrom(previousKind)
    if (restartsMenuBgm(previousKind, screen)) setRestartSerial((serial) => serial + 1)
  }
  return { bgm: screenBgmOf(screen, enteredFrom), restartSerial }
}

/**
 * 이 화면에서 틀 배경음. 바꾸지 않는 화면이면 null.
 * `enteredFrom` 은 이 화면에 들어설 때의 앞 화면이다 (128 대진이 경기 뒤 길인지 가른다).
 */
export function screenBgmOf(screen: Screen, enteredFrom: Screen['kind'] | null = null): number | null {
  if (screen.kind === '엔딩') return endingBgmOf(screen.endingIndex)
  if (screen.kind === '포스트시즌') {
    if (screen.fromReentry === true) return POSTSEASON_REENTRY_BGM
    // 경기 뒤 116 → 114 는 S+0x50 == 2 라 40 을 안 튼다 (`STORY_BGM` 가드)
    return enteredFrom === '경기결과' ? null : STORY_BGM
  }
  // 115 연초 이벤트는 0x8a680 이 만든 내장 이벤트([관리자+0x39f] = 1) — 40 을 안 튼다.
  // 대결결과(140 → 114)도 40 이다 (확정): 미션 장면 결과 0x4ea0c 가 S+0x50 을 쓰는 곳은 4eb3e(`[장면+0xf08]` 이 있으면 3) ·
  // 4f044 · 4f1ca(다른 모드 갈래)뿐이고, 모드 5 · 6 갈래 0x4ef18~0x4f01e 는 안 쓴다. +0xf08 은 적재 0x3f584 의 모드 3 · 4 갈래
  // (0x3f6a4)만 세우고 모드 5(0x3f6e0) · 6(0x3f6bc)은 안 세워 new(0x2ac4 의 memset 0) 그대로 0 → 4eb3e 도 건너뛴다.
  // 곧 대결은 S+0x50 을 안 바꾸고, 대결을 연 114 진입이 이미 2 를 3 으로 고친 뒤라 140 → 114 의 가드는 늘 열린다
  if (screen.kind === '이벤트') return screen.context === '연초' ? null : STORY_BGM
  const table: Partial<Record<string, number>> = SCREEN_BGM
  return table[screen.kind] ?? null
}

/**
 * 투수편(장면 0x106 모드 3) 배경음 — 최상위 `Screen` 은 '투수편' 한 칸이라 안쪽 장면을 따로 본다.
 * 128 대진은 타자편과 같은 진입 0x120a4 다: 이어하기로 들어왔으면(이전 상태 1) 4, 아니면 114 의 40 이 이어진다.
 * 109 순위표는 타자편과 같은 진입 0x10d8c(모드 갈림 없음)다: 이전 ≠ 105 면 `0x6ea6d(소리, 4, −1, 1)`, 105 에서 오면
 * 105 진입 0x11910 이 튼 4 가 이어진다 — 어느 길이든 4 다.
 * 105 관리 화면도 타자편과 같은 틀 0x1aec4(모드 갈림 없음)다: 첫 틀(+0x2c == 2)에 이전 상태가 {100, 116, 132, 125, 126,
 * 114, 134, 1, 112} 면 `0x6ea6d(소리, 4, −1, 1)`(1aef4~1af02) — 관리 화면 배경음 4. 111 상점·112 외출은 105 에서 들어가
 * 배경음을 안 건드려 그 4 가 이어진다(타자편 `SCREEN_BGM` 의 아이템·외출 4 와 같다).
 * 141 엔딩은 타자편과 같은 진입 0x12300(모드 갈림 없음) — `endingBgmOf`(e ≤ 1 이면 52, 그 밖 46).
 * 시즌 끝 사슬(136 · 130 · 131 · 132 · 133 — 웹 '시즌종료' · '연말')과 국가대항전(134 · 135)은 배경음을 안 건드린다(null).
 * 그 밖 장면은 예전 근사 그대로 준비 화면 배경음(3)이다 (머리 주석 ⚠️).
 */
export function pitcherLeagueBgmOf(
  scene: PitcherScene,
  postseasonFromReentry: boolean,
  endingIndex: number | null = null,
  entry: { readonly storyContext?: PitcherStoryContext | null; readonly postseasonAfterGame?: boolean } = {},
): number | null {
  if (scene === '엔딩' && endingIndex !== null) return endingBgmOf(endingIndex)
  if (scene === '포스트시즌') {
    if (postseasonFromReentry) return POSTSEASON_REENTRY_BGM
    // 경기 뒤 116 → 114 는 S+0x50 == 2 라 40 을 안 튼다 (`STORY_BGM` 가드)
    return entry.postseasonAfterGame === true ? null : STORY_BGM
  }
  // 114 이벤트 재생 — 연초 115 는 내장 이벤트라 안 튼다. 대결결과 140 → 114 도 40(타자편 `screenBgmOf` 와 같다 — 미션 결과는 S+0x50 을 안 쓴다)
  if (scene === '이벤트') return entry.storyContext === '연초' ? null : STORY_BGM
  // 116 경기 뒤 평가 진입 0x1278c 는 배경음을 안 건드린다 — 경기 장면이 끊은 채다
  if (scene === '경기결과') return null
  if (scene === '다음경기순위') return SCREEN_BGM.다음경기순위
  if (scene === '관리') return SCREEN_BGM.관리
  if (scene === '상점') return SCREEN_BGM.아이템
  if (scene === '외출') return SCREEN_BGM.외출
  // 142 진입 0x1c46c 는 배경음을 안 건드린다 — 109(4) · 128(40 / 이어하기 4)의 것이 이어진다
  if (scene === '경기준비') return null
  // 경기 장면 0x104 는 상태 7 의 0x3e350 이 소리를 끊고 시작한다 — 끊기는 `usePitcherGame` 이 한다
  if (scene === '경기') return null
  // 시즌 끝 사슬 136 · 130 · 131 · 132 · 133 과 국가대항전 134 · 135 는 배경음을 안 건드린다 — 앞 장면의 것이 이어진다
  // (사슬은 114 를 오가 40 이, 대회 경기 뒤는 경기 장면이 끊은 채다). 진입 표 0xcc728[상태 − 100]: 130 0x19824 ·
  // 131 0x19774 · 132 0x10c54 · 133 0x1a090 · 134 0x19f30 · 135 없음 · 136 0x10bb0, 처리 스위치(0x1d1b2) 134 0x1b92c 말고는 없음,
  // 키 표 0xcc7e0 134 0x19fdc · 135 0x10680, 그리기 표 0xcc884 130 0x19f18 · 131 0x19f24 · 132 · 136 0x11e0c · 134 0x19fc8 ·
  // 135 0x168dc — 이들과 그 아래 세 단계 호출에 0x6ea6c · 0x6e498 · 0x6e418 · 0x6e438 · 0x6eaf0 이 없다
  if (scene === '시즌종료' || scene === '연말' || scene === '국가대항전') return null
  return SCREEN_BGM.투수편
}

/**
 * 투수편 화면의 배경음 — **장면 0x106 에 들어선 순간** 대진(128)이었으면 이어하기 진입이다.
 * 원본은 장면을 떠났다 돌아오면 늘 상태 100(0x1c154) → 1(자원 적재) → S+0x50 의 상태로 가므로, 웹에서 '투수편' 화면에
 * 들어설 때(앱을 켜고 처음 들어설 때 포함 — 세션이 그때 저장의 S+0x50 으로 128 을 고른다) 128 이면 이전 상태가 1 이다.
 * 128 을 떠나면(경기 · 132 연말) 그 표시는 지워진다 — 다시 128 에 오면 경기 뒤 116 → 114 길이다. 142 경기 준비는
 * 배경음을 안 바꾸고(null) 취소하면 128 로 돌아오므로 그동안은 표시를 둔다.
 */
export function usePitcherLeagueBgm(
  isActive: boolean,
  scene: PitcherScene,
  endingIndex: number | null = null,
  storyContext: PitcherStoryContext | null = null,
): number | null {
  const [wasActive, setWasActive] = useState(false)
  const [fromReentry, setFromReentry] = useState(false)
  /** 앞 그리기의 장면 · 128 에 들어선 앞 장면이 116(경기 결과)이었나 */
  const [previousScene, setPreviousScene] = useState<PitcherScene | null>(null)
  const [postseasonAfterGame, setPostseasonAfterGame] = useState(false)
  if (scene !== previousScene) {
    setPreviousScene(scene)
    // 142 를 들렀다 128 로 물러나는 것은 같은 진입으로 본다(142 는 배경음을 안 바꾼다)
    if (scene !== '포스트시즌' && scene !== '경기준비') setPostseasonAfterGame(false)
    else if (scene === '포스트시즌' && previousScene !== '경기준비') setPostseasonAfterGame(previousScene === '경기결과')
  }
  // 그리는 중에 앞 값과 견줘 고친다 (React 의 "이전 렌더 값으로 상태 고치기" — 효과 한 틀 늦지 않게)
  if (isActive !== wasActive) {
    setWasActive(isActive)
    setFromReentry(isActive && scene === '포스트시즌')
  } else if (fromReentry && scene !== '포스트시즌' && scene !== '경기준비') {
    // 142 를 지나 128 로 물러나도(취소) 128 진입은 이전 142 라 배경음을 안 바꾼다 — 그동안은 표시를 둔다
    setFromReentry(false)
  }
  // 위에서 상태를 고쳤으면 React 가 이 그리기를 버리고 곧바로 다시 그린다 — 돌려주는 값은 고친 상태로 다시 구한다
  return isActive ? pitcherLeagueBgmOf(scene, fromReentry, endingIndex, { storyContext, postseasonAfterGame }) : null
}

/** 시즌 관리 메뉴 상태 0xc9 · 장면 생성 뒤 첫 상태(진입 분기) 0xcb */
const SEASON_MANAGEMENT_MENU = 0xc9
const SEASON_ENTRY_BRANCH = 0xcb
/** 관리 메뉴 배경음 (`0x6ea6d(소리, 4, −1, 1)`) */
const SEASON_MANAGEMENT_BGM = 4
/**
 * 시즌 관리 메뉴 0xc9 의 틀 0x73b8 이 배경음 4 를 트는 이전 상태 (0x73c2~0x73ea 직접 떴다):
 * ```
 * 0x73ba  [sm+0x2c](상태 틀 수) == 2 일 때만
 * 0x73c2  이전 상태 ∈ {0xcb, 0xcc, 0xe3, 0xde, 0xf9, 0xe4, 0xe6, 0xe5, 0xd3, 1}
 * 0x73ec  0x6ea6d([0x1400058], 4, −1, 1)   ; 배경음 4 반복 즉시 재생
 * ```
 */
const SEASON_MENU_BGM_FROM: ReadonlySet<number> = new Set([0xcb, 0xcc, 0xe3, 0xde, 0xf9, 0xe4, 0xe6, 0xe5, 0xd3, 1])
/**
 * 웹이 원본 상태를 건너뛰는 자리 — 원본에서는 아래 상태가 위 목록의 상태를 거쳐 0xc9 에 온다.
 * - 0xca 팀고르기 · 0xc8 팀결정확인: 웹은 곧장 0xc9 로 간다. 원본은 0xcc(새 시즌 초기화) → 0xcb → 0xc9.
 * - 0xcf 트레이닝: 웹은 0xde 연출과 결과 팝업을 0xcf 화면 안에서 띄우고 닫으면 0xc9 로 간다(원본 0xde → 0xc9).
 *   ⚠️ 0xcf 에서 취소로 돌아올 때도 4 를 다시 부른다 — 원본은 안 부르지만 그때 이미 4 가 돌고 있어(0xc9 → 0xcf 는 배경음을
 *   안 바꾼다) 같은 번호라 그대로 이어진다.
 * - 0xe1 경기: 원본은 경기 장면 0x104 를 나와 장면 0x105 를 새로 지으므로 0xcb 를 지난다.
 */
const SEASON_MENU_BGM_WEB_STAND_INS: ReadonlySet<number> = new Set([0xca, 0xc8, 0xcf, 0xe1])

/**
 * 관리 메뉴 0xc9 에 들어설 때 틀 배경음 — 이전 상태가 목록에 들면 4, 아니면 null(안 바꾼다).
 * `previous` 가 null 이면 시즌 장면에 막 들어선 때다 — 원본은 장면 생성 0x3b14 의 첫 상태가 진입 분기 0xcb 다.
 */
export function seasonMenuBgmOf(previous: number | null): number | null {
  const from = previous ?? SEASON_ENTRY_BRANCH
  return SEASON_MENU_BGM_FROM.has(from) || SEASON_MENU_BGM_WEB_STAND_INS.has(from) ? SEASON_MANAGEMENT_BGM : null
}

/**
 * 시즌모드(장면 0x105) 관리 메뉴의 배경음 4 — 원본은 상태 0xc9 의 틀 0x73b8 이 이전 상태를 보고 **한 번** 튼다.
 * 최상위 화면 표(`SCREEN_BGM` 시즌모드 3)를 고른 **뒤에** 불러야 한다 — 같은 컴포넌트의 효과는 선언 차례로 돈다.
 */
export function useSeasonMenuBgm(sound: SoundPort, isActive: boolean, scene: number): void {
  /** 앞 틀의 상태 — 시즌모드가 아니었으면 null */
  const previousRef = useRef<number | null>(null)
  useEffect(() => {
    const previous = previousRef.current
    previousRef.current = isActive ? scene : null
    if (!isActive || scene !== SEASON_MANAGEMENT_MENU || previous === scene) return
    const bgm = seasonMenuBgmOf(previous)
    if (bgm !== null) sound.playBgm(bgm)
  }, [sound, isActive, scene])
}

/**
 * 화면에 **들어설 때 한 번** 나는 효과음·음성 (배경음이 아니다). 지금은 없다.
 *
 * 로고 음성 0 은 들어설 때가 아니라 켤 때 로고(하위 2) 객체의 상태 2 끝(0x694c4 `0x6ea6d(소리, 0, −1, 0)`)에 난다 —
 * `LogoScreen` 이 그 갱신에 부른다. 타이틀(하위 3) 진입은 소리를 안 낸다. 앞 화면 `<이용안내>` 에서 한 번 눌렀으니
 * 브라우저 자동 재생 막기(`useSound` 머리 주석)에도 걸리지 않는다.
 */
export const SCREEN_ENTER_SOUND = {} as const satisfies Partial<Record<Screen['kind'], number>>

/**
 * 들어설 때 울리던 소리를 끊는 화면 — 환경설정(하위 8) 진입 0x259fc 의 끝 0x25aac~0x25ab6 `0x6e419(소리)` (= 0x6e418 소리 끊기,
 * 기억한 배경음도 잊는다). 하위 페이지(0x20 · 0x21)에서 돌아오는 진입도 같은 끝을 지나지만 그때는 이미 끊긴 뒤다.
 */
export function stopsSoundOnEnter(screen: Screen): boolean {
  return screen.kind === '환경설정'
}

/** 화면이 바뀌어 `stopsSoundOnEnter` 화면에 들어선 그리기에서 한 번 `sound.stop()` */
export function useSceneEnterStop(sound: SoundPort, screen: Screen): void {
  const lastKindRef = useRef<Screen['kind'] | null>(null)
  const stops = stopsSoundOnEnter(screen)
  useEffect(() => {
    if (lastKindRef.current === screen.kind) return
    lastKindRef.current = screen.kind
    if (stops) sound.stop()
  }, [sound, screen.kind, stops])
}

/** 이 화면에 들어설 때 낼 효과음. 없으면 null */
export function screenEnterSoundOf(screen: Screen): number | null {
  const table: Partial<Record<string, number>> = SCREEN_ENTER_SOUND
  return table[screen.kind] ?? null
}
