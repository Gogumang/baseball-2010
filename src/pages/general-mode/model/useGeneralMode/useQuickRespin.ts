import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { setAppTickTimeout } from '@/shared/lib/frameClock/frameClock'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { TeamSetupRolls } from '@/features/play-team-game/model/teamGameFlow'
import type { SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import { withSetup } from '@/pages/general-mode/lib/generalModeFlow'
import type { GeneralModeFlowState } from '@/pages/general-mode/lib/generalModeFlow'
import { GENERAL_MODE_STEP } from '@/pages/general-mode/lib/generalModeSetup'
import { QUICK_RESPIN_TICKS, finishQuickRespin, rollQuickRespinTeams } from '@/pages/general-mode/lib/quickStart'
import type { QuickStartOpenState } from '@/pages/general-mode/lib/quickStart'
import { rollsOf } from './matchInfoEntry'

/** 재굴림이 쓰는 세션 칸 — 기록 · 굴림 넷 · 고친 엔트리 · 블록 쓰기 차례 */
export interface QuickRespinWrites {
  readonly setFlow: Dispatch<SetStateAction<GeneralModeFlowState>>
  readonly setRolls: (rolls: TeamSetupRolls) => void
  readonly setUserEntryRoster: (roster: SeasonTeamRoster | null) => void
  readonly bumpBlockWrite: () => void
}

/**
 * `*` 재굴림 (0x311a8). 키 '*'(0x31424)는 [skin+0xf4] = 1 · [메뉴+0x154] = 0 만 하고, 굴림은 그 뒤 **매 틱**
 * 갱신 앞머리(31200~)가 한다: 1~19틱은 팀 둘만(`rollQuickRespinTeams`), 20틱째에 선공·마선수까지 굴리고
 * [skin+0xf4] = 0 → `0x30f20`(31290). 도는 동안([메뉴+0x154] ≤ 0x13) 키는 전부 버린다(312b6).
 * `respinTick` = [메뉴+0x154] (도는 중이 아니면 null). `respinBuilt` = 0x30f20 이 마지막으로 세운 두 팀 —
 * 도는 동안 기록 +0 · +4 는 바뀌지만 선발 줄은 0x30f20 이 만든 팀 객체(0xb51fd)를 읽으므로 옛 팀이 남는다.
 */
export function useQuickRespin(flow: GeneralModeFlowState, random: RandomPort, openState: QuickStartOpenState, writes: QuickRespinWrites) {
  const [respinTick, setRespinTick] = useState<number | null>(null)
  // 열린 것 목록은 부르는 쪽이 그릴 때마다 새 배열일 수 있다 — 틱 타이머가 그 때문에 다시 걸리지 않게 ref 로 읽는다
  const openStateNow = useEffectEvent((): QuickStartOpenState => ({
    openedHiddenTeamIds: openState.openedHiddenTeamIds,
    openedAcePitcherIds: openState.openedAcePitcherIds,
    openedAceBatterIds: openState.openedAceBatterIds,
  }))
  const [respinBuilt, setRespinBuilt] = useState<{ readonly userTeamId: number; readonly aiTeamId: number } | null>(null)

  const respin = useCallback(() => {
    // 0x3140e: 빠른실행([메뉴+0x14c])이고 [skin+0xf4] == 0 일 때만
    if (!flow.isQuickStart || flow.step !== GENERAL_MODE_STEP.경기정보 || respinTick !== null) return
    setRespinBuilt({ userTeamId: flow.setup.userTeamId, aiTeamId: flow.setup.aiTeamId })
    setRespinTick(0)
  }, [flow, respinTick])

  const { setFlow, setRolls, setUserEntryRoster, bumpBlockWrite } = writes
  useEffect(() => {
    if (respinTick === null) return undefined
    return setAppTickTimeout(() => {
      const tick = respinTick + 1
      if (tick < QUICK_RESPIN_TICKS) {
        const teams = rollQuickRespinTeams(random, openStateNow())
        setFlow((current) => withSetup(current, { ...current.setup, ...teams }))
        setRespinTick(tick)
        return
      }
      // 20틱째 — 팀 둘 · 선공 · 마투수 · 마타자 → [skin+0xf4] = 0 → 0x30f20. 고친 엔트리도 여기서 사라진다
      const setup = finishQuickRespin(random, flow.setup, openStateNow())
      setUserEntryRoster(null)
      setRolls(rollsOf(setup, random))
      setFlow((current) => withSetup(current, setup))
      setRespinBuilt(null)
      setRespinTick(null)
      bumpBlockWrite()
    }, 1)
  }, [respinTick, flow.setup, random, bumpBlockWrite, setFlow, setRolls, setUserEntryRoster])
  return [respin, respinTick !== null, respinBuilt] as const
}
