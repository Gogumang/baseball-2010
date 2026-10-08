import type { DefenseKeyPress, DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { DefensePlayView } from '@/features/defense-play/model/defensePlayView'
import { runRunnerPlay, startRunnerPlay } from '@/features/defense-play/model/runnerPlayEngine'
import { runPickoffPlay, startPickoffPlay, type PickoffPlayInput } from '@/features/defense-play/model/pickoffPlay'
import type { OpenedPitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'

/**
 * **사람이 수비하며 실시간으로 도는 주자 판** — 도루(종류 5) · 폭투·포일(종류 9) · 견제(종류 4) (2026-10-08 직접 뜸).
 *
 * 상태 0x17 의 키 처리 0x53420 은 판 종류를 안 가린다 — 사람이 수비면 0x533c8 이 '8'/아래 홈 · '6'/오른 1루 · '2'/위 2루 ·
 * '4'/왼 3루를 메시지 0x588 로 보내고 0x51890 이 플레이 vt60 0xb3118 로 **+0x160** 에 적는다(조건 없음). 그 값을 쓰는 것은
 * 플레이 vt4c 0xb45dc 의 b4660~b46a8 — `+0x160 ≠ −1 && +0x12c(쥠) && 공 가진 야수 vtC4(준비)` 면 0xb2c90 으로 그 루에 보내고
 * −1 — 이고, 슬롯 2 의 52602 는 판 종류가 마스크 0x58c(2 · 3 · 7 · 8 · 10) 밖일 때만 vt4c 를 부른다. 곧 도루 · 폭투 · 견제 판은
 * 사람 키로 던지고, 밀어내기(종류 2)는 키가 +0x160 만 적는다. 그래서 이 판들은 미리 돌려 재생하지 않고 화면이 한 틱씩 돌린다.
 *
 * 굴림 차례: 판 시작 굴림(공 도착의 0.1% · 폭투 쏘기 · 도루 리드 · 견제 리드)은 판을 열 때 · 진행기를 세울 때 돌고, 판 안의
 * 굴림(펌블 · 악송구 · 특수 송구)은 틱마다 — 그 사이에 다른 굴림이 없어 미리 돌리던 때와 같은 차례다(키가 같으면 같은 판).
 */
export type LiveRunnerPlay =
  | {
      readonly kind: 'arrival'
      /** 공 도착 판 — 판 시작까지 굴려 둔 것 (`openPitchArrivalPlay`) */
      readonly opened: Exclude<OpenedPitchArrivalPlay, { readonly kind: 2 }>
    }
  | {
      readonly kind: 'pickoff'
      readonly input: PickoffPlayInput
    }

/** 판을 한 틱씩 돌리는 손잡이 — `step(키)` 한 번이 그 틱 하나다 */
export interface LiveRunnerStepper {
  readonly tick: number
  readonly finished: boolean
  readonly ticks: readonly DefensePlayView[]
  step(press: DefenseKeyPress | null): void
  result(): DefensePlayResult
}

/** 사람 수비 조작을 달아 진행기를 세운다 — 키는 `step` 으로 받으므로 `keyAt` 은 안 쓴다 */
const HUMAN_DEFENSE = { side: '수비' as const, keyAt: () => null }

export function startLiveRunnerPlay(play: LiveRunnerPlay): LiveRunnerStepper {
  if (play.kind === 'arrival') return startRunnerPlay({ ...play.opened.engineInput, controls: HUMAN_DEFENSE })
  return startPickoffPlay({ ...play.input, controls: HUMAN_DEFENSE })
}

/** 화면이 결과를 못 넘겼을 때 — 남은 틱을 키 없이 끝까지 돌린다(붙든 경기는 반드시 푼다) */
export function runLiveRunnerPlayWithoutKeys(play: LiveRunnerPlay): DefensePlayResult {
  if (play.kind === 'arrival') return runRunnerPlay({ ...play.opened.engineInput, controls: HUMAN_DEFENSE })
  return runPickoffPlay({ ...play.input, controls: HUMAN_DEFENSE })
}
