import { nextPitcherTitleOf } from '@/entities/pitcher-career/model/pitcherTitles'
import { type PitcherAtoms, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'
import { fileEventsAtom, heldTitleAtom, isResultWindowOpenAtom, sceneAtom, storyAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import { outingRecoveryNoticeAtom } from '@/app/model/pitcherLeagueSession/atoms/uiAtoms'

/**
 * **칭호 팝업 하나** — 원본은 관리 화면(105) 갱신 0x1aec4 끝에서 판정 0x1a1c0 이 번호 순서로 **처음 맞는 하나만**
 * this+0x270 에 남겨 팝업 0x1274c 를 띄우고, 확인 0x1b1e4 가 비트·곧바로 장착(+0x1c4)·저장 뒤 다음 틀에 다시 판정한다
 * (P3 4절 — 장면 0x106 은 모드 3·4 공용). 105 에 있고 이벤트·알림이 없으면 판정한 값으로 둔다(타자편 `pendingTitle` 과 같다).
 * 훈련 · 휴식 결과 창은 원본에서 125 · 127 상태라(창이 닫혀야 105 로 돌아온다) 그동안은 판정하지 않는다(`isResultWindowOpen`).
 * 117 이 넣어 둔 +0x270(`heldTitle` — 칭호 1 · 9)이 서 있으면 판정 대신 그것이다(0x1af9c~0x1afa8 — +0x270 ≥ 0 이면 0x1a1c0 을 건너뛴다).
 */
export function usePendingTitle(atoms: PitcherAtoms): string | null {
  const career = usePitcherValue(atoms, careerAtom)
  const scene = usePitcherValue(atoms, sceneAtom)
  const story = usePitcherValue(atoms, storyAtom)
  const fileEvents = usePitcherValue(atoms, fileEventsAtom)
  const outingRecoveryNotice = usePitcherValue(atoms, outingRecoveryNoticeAtom)
  const isResultWindowOpen = usePitcherValue(atoms, isResultWindowOpenAtom)
  const heldTitle = usePitcherValue(atoms, heldTitleAtom)
  const isQuietManagement = scene === '관리' && story === null && fileEvents !== null && outingRecoveryNotice === '' && !isResultWindowOpen
  if (career === null || !isQuietManagement) return null
  return heldTitle ?? nextPitcherTitleOf(career)
}
