import type { SoundPort } from '@/shared/api/audio/soundPort'
import type { TeamAutoRelay as TeamAutoRelayState } from '@/features/play-team-game/model/teamGameFlow'
import { teamAutoRelayStepOf, teamRelayFiguresOf } from '@/pages/team-game/lib/teamAutoRelay'
import { AUTO_RELAY_SPEED_MAX } from '@/pages/team-game/model/autoRelaySpeed'
import { applyChangeWaitBeforeUpdate, applyChangeWaitOnDraw, armChangeWait, clearChangeWait, isRelayUpdateTick } from './relayWait'
import type { RelayState } from './useRelayState'

/**
 * 장면 틱 하나의 처리 — 그림마다 새로 만든다(그때 렌더의 `onStep` 으로). 질문 창이 떠 있거나 중계가 끝났으면 아무 일도 없다.
 * 갱신 0x48480 뒤 그리기 0x4258c 의 sim+0x9d 셈을 하고, CLR 을 받은 그림이면 그 뒤에 질문 창을 띄운다
 */
export function useRelayTick(state: RelayState, onStep: () => TeamAutoRelayState | null, audio: SoundPort): (tick: number) => void {
  const { speedRef, waitRef, isDoneRef, isAskingRef, clrPendingRef, setSceneTick, setShown, setFigures, setChangeShown, setAsking } = state

  /** 걸음 하나 = 0xc262c 한 번(교체 틱 또는 타석 틱). 0xc2198 이 거짓이면 +0x1784 = 0 · 상태 0x18 · 0x6e418 배경음 끔 */
  const runStep = (fast: boolean) => {
    const wait = waitRef.current
    clearChangeWait(wait)
    const relay = onStep()
    if (relay === null) {
      isDoneRef.current = true
      audio.stop()
      return
    }
    const next = relay.ticks[0]
    if (next === undefined) return
    armChangeWait(wait, next.halfFlipped, fast)
    setShown(teamAutoRelayStepOf(next))
    // 48572~485a6 — 실린 마선수 그림은 틱을 넘어 이어진다(속도와 상관없이 싣는다)
    setFigures((previous) => teamRelayFiguresOf(next, previous.loadedRunnerAce))
  }

  /** 한 그림 — 갱신 0x48480 뒤 그리기 0x4258c 의 sim+0x9d 셈 */
  const update = (tick: number) => {
    setSceneTick(tick)
    const v = speedRef.current
    const wait = waitRef.current
    const runs = isRelayUpdateTick(tick, v) && !applyChangeWaitBeforeUpdate(wait)
    if (runs) {
      runStep(v === AUTO_RELAY_SPEED_MAX)
      if (isDoneRef.current) return
    }
    setChangeShown(applyChangeWaitOnDraw(wait))
  }

  return (tick: number) => {
    if (isDoneRef.current || isAskingRef.current) return
    update(tick)
    if (!clrPendingRef.current) return
    clrPendingRef.current = false
    if (isDoneRef.current) return
    // 창이 떠 있는 동안은 장면 틱(0xbc9c8) · 키 · 갱신이 안 돌고 장면도 다시 안 그린다 — 화면이 `isPaused` 로 멈춘다
    isAskingRef.current = true
    setAsking(true)
  }
}
