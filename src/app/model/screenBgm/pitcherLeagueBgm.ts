import { useState } from 'react'
import type { PitcherScene, PitcherStoryContext } from '@/app/model/usePitcherLeagueSession'
import { SCREEN_BGM, STORY_BGM } from '@/app/model/screenBgm/screenBgmTable'
import { postseasonBgmOf } from '@/app/model/screenBgm/screenBgmOf'
import { endingBgmOf } from '@/app/model/screenBgm/endingBgm'
import { useManagementBgmRestart } from '@/app/model/screenBgm/useScreenBgm'
import { carriesYearCoverBgm } from '@/app/model/screenBgm/bgmRestarts'

/** 투수편 안쪽 장면의 배경음 — null 은 배경음을 안 건드린다(앞 장면의 것이 이어진다) */
const PITCHER_SCENE_BGM: Partial<Record<PitcherScene, number | null>> = {
  // 116 경기 뒤 평가 진입 0x1278c 는 배경음을 안 건드린다 — 경기 장면이 끊은 채다
  경기결과: null,
  다음경기순위: SCREEN_BGM.다음경기순위,
  관리: SCREEN_BGM.관리,
  상점: SCREEN_BGM.아이템,
  외출: SCREEN_BGM.외출,
  // 142 진입 0x1c46c 는 배경음을 안 건드린다 — 109(4) · 128(40 / 이어하기 4)의 것이 이어진다
  경기준비: null,
  // 경기 장면 0x104 는 상태 7 의 0x3e350 이 소리를 끊고 시작한다 — 끊기는 `usePitcherGame` 이 한다
  경기: null,
  // 시즌 끝 사슬 136 · 130 · 131 · 132 · 133 과 국가대항전 134 · 135 는 배경음을 안 건드린다 — 앞 장면의 것이 이어진다
  // (사슬은 114 를 오가 40 이, 대회 경기 뒤는 경기 장면이 끊은 채다). 진입 표 0xcc728[상태 − 100]: 130 0x19824 ·
  // 131 0x19774 · 132 0x10c54 · 133 0x1a090 · 134 0x19f30 · 135 없음 · 136 0x10bb0, 처리 스위치(0x1d1b2) 134 0x1b92c 말고는 없음,
  // 키 표 0xcc7e0 134 0x19fdc · 135 0x10680, 그리기 표 0xcc884 130 0x19f18 · 131 0x19f24 · 132 · 136 0x11e0c · 134 0x19fc8 ·
  // 135 0x168dc — 이들과 그 아래 세 단계 호출에 0x6ea6c · 0x6e498 · 0x6e418 · 0x6e438 · 0x6eaf0 이 없다
  국가대항전: null,
  // 137 "N년차" 표지(진입 0x1055c · 틀 0x12190 · 그리기 0x1cc4c)는 배경음을 안 건드린다 — 뒤 105 도 잇는다(`carriesYearCoverBgm`)
  연차표지: null,
  // 101 진입 0x10790 — 조건 없이 3(107a2). 102 · 103 은 안 건드려 이어진다
  등록: SCREEN_BGM.투수편,
}

type PitcherBgmEntry = { readonly storyContext?: PitcherStoryContext | null; readonly postseasonAfterGame?: boolean }

/** 엔딩 · 대진 · 이벤트 — 판정 · 들어선 길에 따라 갈린다. 표로 정하는 장면이면 undefined */
function storyPitcherBgmOf(
  scene: PitcherScene,
  postseasonFromReentry: boolean,
  endingIndex: number | null,
  entry: PitcherBgmEntry,
): number | null | undefined {
  if (scene === '엔딩' && endingIndex !== null) return endingBgmOf(endingIndex)
  if (scene === '포스트시즌') return postseasonBgmOf(postseasonFromReentry, entry.postseasonAfterGame === true)
  // 114 이벤트 재생 — 연초 115 는 내장 이벤트라 안 튼다. 대결결과 140 → 114 도 40(타자편 `screenBgmOf` 와 같다 — 미션 결과는 S+0x50 을 안 쓴다)
  if (scene === '이벤트') return entry.storyContext === '연초' ? null : STORY_BGM
  return undefined
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
 * 시즌 끝 사슬(136 · 130 · 131 · 132 · 133 — 웹은 이벤트 화면)과 국가대항전(134 · 135)은 배경음을 안 건드린다(null).
 * '등록'(101 팀 고르기 0x10790 의 3 · 102 · 103 은 안 건드림)만 3 이다. 마선수 대결은 SYS 8(0x8d734)이 곧장 경기 장면 0x104 를
 * 세워 0x3e350 이 끊는다 — 화면 표는 안 바꾼다(null).
 */
export function pitcherLeagueBgmOf(
  scene: PitcherScene,
  postseasonFromReentry: boolean,
  endingIndex: number | null = null,
  entry: PitcherBgmEntry = {},
): number | null {
  const story = storyPitcherBgmOf(scene, postseasonFromReentry, endingIndex, entry)
  if (story !== undefined) return story
  // 마선수 대결(경기 장면 0x104 — 0x3e350 이 끊는다) · 판정이 아직 없는 엔딩(141 진입 0x12300 이 판정과 함께 튼다)은 표에 없다
  return PITCHER_SCENE_BGM[scene] ?? null
}

/** 투수편이 서 있고 안쪽 장면이 그 장면인가 */
function isAtScene(isActive: boolean, scene: PitcherScene, target: PitcherScene): boolean {
  return isActive && scene === target
}

/** 128 대진에 머무는 동안 — 142 를 들렀다 128 로 물러나는 것은 같은 진입으로 본다(142 는 배경음을 안 바꾼다) */
function isPostseasonStay(scene: PitcherScene): boolean {
  return scene === '포스트시즌' || scene === '경기준비'
}

/** 장면이 바뀐 그림의 "128 이 경기 뒤 길인가" — 128 을 떠나면 false, 128 에 새로 들어서면 앞 장면이 116 이었나, 그 밖은 그대로(undefined) */
function postseasonAfterGameUpdateOf(scene: PitcherScene, previousScene: PitcherScene | null): boolean | undefined {
  if (!isPostseasonStay(scene)) return false
  if (scene === '포스트시즌' && previousScene !== '경기준비') return previousScene === '경기결과'
  return undefined
}

/** 투수편이 안 서 있거나 137 뒤 앞 배경음을 잇는 동안은 화면 배경음을 안 낸다 */
function isSilent(isActive: boolean, isYearCoverCarry: boolean): boolean {
  return !isActive || isYearCoverCarry
}

/**
 * **장면 0x106 에 들어선 순간** 대진(128)이었나 — 이어하기 진입 표시. 128 을 떠나면 지운다(142 경기 준비는 둔다).
 * 그리는 중에 앞 값과 견줘 고친다 (React 의 "이전 렌더 값으로 상태 고치기" — 효과 한 틀 늦지 않게)
 */
function useReentryEntry(isActive: boolean, scene: PitcherScene): boolean {
  const [wasActive, setWasActive] = useState(false)
  const [fromReentry, setFromReentry] = useState(false)
  if (isActive !== wasActive) {
    setWasActive(isActive)
    setFromReentry(isAtScene(isActive, scene, '포스트시즌'))
  } else if (fromReentry && !isPostseasonStay(scene)) {
    // 142 를 지나 128 로 물러나도(취소) 128 진입은 이전 142 라 배경음을 안 바꾼다 — 그동안은 표시를 둔다
    setFromReentry(false)
  }
  return fromReentry
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
  /** 화면이 '관리' 인 채 105 에 다시 들어와 4 를 다시 튼 수 (`usePitcherLeagueBgmRestart` 와 같은 값) — 137 뒤 잇기를 끝낸다 */
  managementBgmRestart = 0,
): number | null {
  /** 앞 그리기의 장면 · 128 에 들어선 앞 장면이 116(경기 결과)이었나 */
  const [previousScene, setPreviousScene] = useState<PitcherScene | null>(null)
  const [postseasonAfterGame, setPostseasonAfterGame] = useState(false)
  const [isYearCoverCarry, setYearCoverCarry] = useState(false)
  if (useManagementBgmRestart(isAtScene(isActive, scene, '관리'), managementBgmRestart)) setYearCoverCarry(false)
  if (scene !== previousScene) {
    setPreviousScene(scene)
    setYearCoverCarry(carriesYearCoverBgm(isYearCoverCarry, previousScene, scene))
    const afterGame = postseasonAfterGameUpdateOf(scene, previousScene)
    if (afterGame !== undefined) setPostseasonAfterGame(afterGame)
  }
  const fromReentry = useReentryEntry(isActive, scene)
  // 위에서 상태를 고쳤으면 React 가 이 그리기를 버리고 곧바로 다시 그린다 — 돌려주는 값은 고친 상태로 다시 구한다
  if (isSilent(isActive, isYearCoverCarry)) return null
  return pitcherLeagueBgmOf(scene, fromReentry, endingIndex, { storyContext, postseasonAfterGame })
}
