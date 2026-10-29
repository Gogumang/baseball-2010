import { useState } from 'react'
import { GENERAL_MODE_STEP } from '@/pages/general-mode/lib/generalModeSetup'
import type { GeneralPrepPushView } from '@/pages/general-mode/lib/generalPrepPush'
import type { GeneralModeEntryEdit } from '@/pages/general-mode/model/useGeneralMode/generalModeTypes'

/** 지금 보이는 것과 바로 앞에 보였던 것 — 렌더 중에 맞춘다 */
interface ViewTrail<V> {
  readonly view: V
  readonly previous: V | null
}

/** 보이는 것이 바뀌었으면 앞의 것을 남긴 새 자취, 아니면 그대로 */
function trailAfter<V>(trail: ViewTrail<V>, view: V): ViewTrail<V> {
  return trail.view === view ? trail : { view, previous: trail.view }
}

/** 바로 앞에 보였던 것 — 보이는 것이 바뀐 그림에서 자취를 고쳐 둔다(렌더 중 상태 맞추기) */
export function usePreviousView<V>(view: V): V | null {
  const [held, setTrail] = useState<ViewTrail<V>>({ view, previous: null })
  const trail = trailAfter(held, view)
  if (trail !== held) setTrail(trail)
  return trail.previous
}

/** 상태 23 화면 밀기 방향 — [메뉴+0xec](유저 팀 1 · CPU 팀 0) */
const entryPushViewOf = (entryEdit: GeneralModeEntryEdit | null): GeneralPrepPushView => {
  if (entryEdit === null) return '22'
  return entryEdit.isUserTeam ? '23:유저' : '23:CPU'
}

/**
 * 18 ↔ 19 · 22 ↔ 23 은 화면 밀기(효과기 종류 8)로 바뀐다 — 모든 단계를 같은 밀기 틀에 담아 앞 화면을 떠 둔다(A-68,
 * `lib/generalPrepPush`). 23 은 [메뉴+0xec](유저 팀 1 · CPU 팀 0)에 따라 방향이 갈린다
 */
export function prepPushViewOf(step: number, entryEdit: GeneralModeEntryEdit | null): GeneralPrepPushView {
  if (step === GENERAL_MODE_STEP.유저팀) return '18'
  if (step === GENERAL_MODE_STEP.AI팀) return '19'
  if (step === GENERAL_MODE_STEP.경기정보) return entryPushViewOf(entryEdit)
  return '그밖'
}
