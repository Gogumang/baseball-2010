import { useState } from 'react'
import type { Screen } from '@/app/model/screen'
import type { PitcherScene } from '@/app/model/usePitcherLeagueSession'

/**
 * 화면 → 배경음 번호 (`shared/config/original/sounds` 의 `scene` 칸 그대로).
 *
 * ```
 * 1  메인메뉴          장면 0x103 상태 3~5 (타이틀 뒤 메뉴)
 * 3  모드 준비·설정    0x105 상태 202 · 0x106 상태 101 · 0x107 로비
 * 4  관리 화면         시즌(0x105)·나만의리그(0x106) 관리
 * 33 경기              0x104 상태 0x21 (0x3abf0 · 0x48480 · 0x4258c)
 * 40 이벤트(대화)      0x106 상태 114 · 0x105 상태 211
 * 46 엔딩              0x106 상태 141 · 0x105 상태 245 예약
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
  나리편선택: 3,
  팀선택: 3,
  선수등록: 3,
  시즌모드: 3,
  투수편: 3,
  일반모드: 3,
  미션선택: 3,
  홈런더비: 3,
  스페셜: 3,
  도움말: 3,
  환경설정: 3,
  관리: 4,
  // 109 진입 0x10d8c: 이전 ≠ 105 면 배경음 4. 105(관리, 4)에서 오면 이미 4 라 그대로다
  다음경기순위: 4,
  아이템: 4,
  외출: 4,
  성적: 4,
  경기: 33,
  미션진행: 33,
  투수미션: 33,
  마선수대결: 33,
  이벤트: 40,
  엔딩: 46,
} as const satisfies Partial<Record<Screen['kind'], number>>

/**
 * 포스트시즌 대진 128 의 배경음 — 진입 0x120a4 의 첫 줄(0x120a6~0x120be):
 * ```
 * if [장면+0x28](이전 상태) == 1:  0x6ea6d(소리, 4, −1, 1)   ; 관리 화면 배경음 4 를 반복으로
 * ```
 * 이전 상태 1 은 상태 100(재진입)이 거쳐 보내는 자원 적재 칸이라 **이어하기로 돌아온 때**뿐이다.
 * 그 밖에는 128 이 배경음을 안 건드린다 — 들어오는 길(131 뒤 · 경기 뒤 116)이 모두 이벤트 재생 114 를
 * 지나오고 114 진입 0x11d00 이 배경음 40 을 트므로 그 40 이 이어진다. 웹은 경기 뒤 116 → 114 화면이 없어
 * 그 자리를 여기서 40 으로 채운다.
 */
const POSTSEASON_REENTRY_BGM = 4

/** 이 화면에서 틀 배경음. 바꾸지 않는 화면이면 null */
export function screenBgmOf(screen: Screen): number | null {
  if (screen.kind === '포스트시즌') return screen.fromReentry === true ? POSTSEASON_REENTRY_BGM : SCREEN_BGM.이벤트
  const table: Partial<Record<string, number>> = SCREEN_BGM
  return table[screen.kind] ?? null
}

/**
 * 투수편(장면 0x106 모드 3) 배경음 — 최상위 `Screen` 은 '투수편' 한 칸이라 안쪽 장면을 따로 본다.
 * 128 대진은 타자편과 같은 진입 0x120a4 다: 이어하기로 들어왔으면(이전 상태 1) 4, 아니면 114 의 40 이 이어진다.
 * 109 순위표는 타자편과 같은 진입 0x10d8c(모드 갈림 없음)다: 이전 ≠ 105 면 `0x6ea6d(소리, 4, −1, 1)`, 105 에서 오면
 * 105 진입 0x11910 이 튼 4 가 이어진다 — 어느 길이든 4 다.
 * 그 밖 장면은 예전 근사 그대로 준비 화면 배경음(3)이다 (머리 주석 ⚠️).
 */
export function pitcherLeagueBgmOf(scene: PitcherScene, postseasonFromReentry: boolean): number {
  if (scene === '포스트시즌') return postseasonFromReentry ? POSTSEASON_REENTRY_BGM : SCREEN_BGM.이벤트
  if (scene === '다음경기순위') return SCREEN_BGM.다음경기순위
  return SCREEN_BGM.투수편
}

/**
 * 투수편 화면의 배경음 — **장면 0x106 에 들어선 순간** 대진(128)이었으면 이어하기 진입이다.
 * 원본은 장면을 떠났다 돌아오면 늘 상태 100(0x1c154) → 1(자원 적재) → S+0x50 의 상태로 가므로, 웹에서 '투수편' 화면에
 * 들어설 때(앱을 켜고 처음 들어설 때 포함 — 세션이 그때 저장의 S+0x50 으로 128 을 고른다) 128 이면 이전 상태가 1 이다.
 * 128 을 떠나면(경기 142 · 132 연말) 그 표시는 지워진다 — 다시 128 에 오면 경기 뒤 116 → 114 길이다.
 */
export function usePitcherLeagueBgm(isActive: boolean, scene: PitcherScene): number | null {
  const [wasActive, setWasActive] = useState(false)
  const [fromReentry, setFromReentry] = useState(false)
  // 그리는 중에 앞 값과 견줘 고친다 (React 의 "이전 렌더 값으로 상태 고치기" — 효과 한 틀 늦지 않게)
  if (isActive !== wasActive) {
    setWasActive(isActive)
    setFromReentry(isActive && scene === '포스트시즌')
  } else if (fromReentry && scene !== '포스트시즌') {
    setFromReentry(false)
  }
  // 위에서 상태를 고쳤으면 React 가 이 그리기를 버리고 곧바로 다시 그린다 — 돌려주는 값은 고친 상태로 다시 구한다
  return isActive ? pitcherLeagueBgmOf(scene, fromReentry) : null
}

/**
 * 화면에 **들어설 때 한 번** 나는 효과음·음성 (배경음이 아니다).
 *
 * ```
 * 0  로고 "GAMEVIL"  장면 0x103 상태 2 = 시작 인증·로고 화면 (0x69400)
 * ```
 *
 * ⚠️ **브라우저는 사용자가 한 번 누르기 전에는 소리를 못 낸다** (`useSound` 머리 주석).
 * 앱을 켜고 처음 보는 타이틀에서는 이 음성이 실제로 울리지 않는다 — 다시 타이틀로 돌아오면 난다.
 */
export const SCREEN_ENTER_SOUND = {
  타이틀: 0,
} as const satisfies Partial<Record<Screen['kind'], number>>

/** 이 화면에 들어설 때 낼 효과음. 없으면 null */
export function screenEnterSoundOf(screen: Screen): number | null {
  const table: Partial<Record<string, number>> = SCREEN_ENTER_SOUND
  return table[screen.kind] ?? null
}
