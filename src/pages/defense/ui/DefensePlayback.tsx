import type { ControlSide } from '@/entities/defense-controls/model/defenseKeys'
import type { DefenseViewState } from '@/entities/fielding/model/defenseView/defenseViewState'
import type { DrawnFieldingError } from '@/features/defense-play/model/fieldingErrors'
import type { LiveRunnerPlay } from '@/features/defense-play/model/liveRunnerPlay'
import type { DefensePlayInput, DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { DefenseSceneMemory } from '@/pages/defense/lib/defenseHomeRunEffects'
import { LivePlayback } from '@/pages/defense/ui/playback/LivePlayback'
import { LiveRunnerPlayback } from '@/pages/defense/ui/playback/LiveRunnerPlayback'
import { RecordedPlayback } from '@/pages/defense/ui/playback/RecordedPlayback'
import type { RunScoreBoardSource } from '@/pages/defense/ui/playback/runScoreBoardView'
import { useClaimSceneParticles } from '@/widgets/particles/model/useClaimSceneParticles'
import { useMarksGameScene } from '@/shared/lib/commonWindow/commonWindow'

interface DefensePlaybackProps {
  /**
   * **미리 계산해 둔** 한 플레이의 매 틱 스냅샷. 홈런 비행 재생(`homeRunPlayback`)처럼
   * 사람이 끼어들 것이 없는 장면은 이 쪽을 쓴다.
   */
  readonly ticks?: readonly DefenseViewState[]
  /**
   * **실시간으로 돌릴** 타구. 주면 이 화면이 진행기를 **매 갱신 한 틱씩 직접 돌리고**
   * `keydown` 을 그 틱의 키로 넘긴다 — 사람이 주루·송구를 할 수 있는 갈래다.
   * `ticks` 와 같이 주면 이 쪽이 이긴다.
   */
  readonly input?: DefensePlayInput
  /**
   * **실시간으로 돌릴 주자 판**(사람 수비의 도루 · 폭투 · 견제 — `features/defense-play/model/liveRunnerPlay`). 주면 진행기를
   * 매 갱신 한 틱씩 돌리며 `keydown` 을 그 틱의 키로 넘긴다(송구 키 → +0x160). `input` 이 없을 때만 본다.
   */
  readonly runnerPlay?: LiveRunnerPlay
  /**
   * 사람이 어느 쪽을 잡는가 — 조작 객체 `[+0xc]` (0 공격/주루 · 1 수비/송구).
   * **안 주면 자동이다**: 키를 눌러도 아무 일도 없고 CPU 규칙대로만 굴러간다.
   */
  readonly side?: ControlSide
  /** 마지막 틱까지 다 보여 준 뒤. 실시간 갈래는 그 플레이의 결과를 함께 넘긴다 */
  readonly onDone: (result?: DefensePlayResult) => void
  /**
   * 이 판의 그림들이 올린 **실책 +0x2e** (야수 그리기 0x43278 4381a~43904 — `features/defense-play/model/fieldingErrors`).
   * 그린 틱마다 세어 두었다가 `onDone` **바로 앞에** 한 번 넘긴다(없으면 안 부른다). 키 건너뛰기(+0xfe7)로 안 그린 틱은 안 센다
   */
  readonly onFieldingErrors?: (errors: readonly DrawnFieldingError[]) => void
  /**
   * 시즌 구장 잔디 — `stadium/defense.mpl` 줄 (`0x7885c`). `DefenseScreen` 과 같은 뜻이다.
   * 시즌 **홈경기**에서만 값이 오고, 그 밖에는 null(구운 그림 = 칸 3 특급천연잔디)이다.
   */
  readonly grassPalette?: number | null
  /**
   * 수비 장면 득점 점수판 0x41a64 — 주면 실시간 갈래에서 1점마다 20번 세운다. 안 주면 안 그린다.
   * 재생 갈래(`ticks`)는 주자가 홈 자리에 닿은 틱을 메시지 0x13 으로 보고, 타자주자가 달리는 재생(홈런 비행)이면
   * 홈런 갈래(간격 min(40/n, 20)로 1점씩), 아니면 보통 갈래로 센다 (`lib/runScoreBoard` 머리말).
   */
  readonly runScoreBoard?: RunScoreBoardSource
  /**
   * 경기 장면 동안 남는 HOMERUN 글자 칸(+0x1962 반짝임 셈 …)과 표시 비거리 +0x36 — 실시간 갈래의 홈런 연출이 판마다 이어 쓴다
   * (`lib/defenseHomeRunEffects`). 부르는 쪽이 경기(장면) 하나 동안 들고 있는 ref 를 넘긴다. 안 주면 판마다 장면 new 의 0 이다.
   */
  readonly sceneMemory?: { current: DefenseSceneMemory }
  /**
   * 재생 갈래(`ticks`)가 **볼넷 · 사구 밀어내기 판**(종류 2, `features/defense-play/model/walkPlay`)인가.
   * - 타자주자(칸 0)가 달리지만 홈런 비행이 아니다 — 득점 점수판을 보통 갈래로 센다.
   * - state[0xb] ∈ {3, 4} 라 판 동안 · 닫힌 뒤 갱신에 온 키가 0x519cc 를 지나 +0xfe7 을 세우고 52b26 이 그 그림 안에서
   *   판 끝 · +0x1094 셈을 다 돌아 0x35108 로 끝낸다 — 키를 받은 그림에서 재생을 끝낸다.
   */
  readonly freePassPlay?: boolean
  readonly children?: React.ReactNode
  /**
   * **돌발 결과 창 0x1c — 수비 화면 위에** (r284 직접 뜸). 0x17 끝 0x528b0 이 0x35108(52a66) 뒤 돌발 판정 0x8f414(52a8e)가 참이면
   * 다음 상태를 0x1c 로 둔다(52aa2). 0x1c 그리기 0x46ee0(표 0xd05a0 칸 0x13 → 0x5300e)은 머리에서 **수비 화면 그리기 0x46c88 을 부른 뒤**
   * (46ee6) 창 0x8f3c0 을 얹는다 — 갱신 0x3afd4 는 창 갱신 0x8e5b8 하나뿐이라 판(진행기 · 목록 틱)은 서고 카메라도 선 채, 그리기 쪽만
   * 그림마다 돈다: 공 그리기 0x36dfc 의 파티클 → 프레임 끝 관리자 틱 0x6de85(53048 — 이 창은 공용 창이 아니라 게이트가 안 닫힌다,
   * 경기 난수). 0x12 끝 판정(0x4e7ca)은 0x1d(그리기 0x4d1e0 — 타석 화면)로 가므로 이 길이 아니다.
   *
   * 주면 판이 끝난 뒤(0x35108 — `onDone`)에도 이 판을 내리지 않고 그 그림을 이어 그리며 위에 이 창(과 그 위 덧그림)을 얹는다.
   * 부르는 쪽은 판을 띄운 그 자리에 **같은 요소**로 다시 그려 상태를 잇는다(`useDefenseUnderBurstWindow`). `onDone` 은 판마다 한 번이다.
   * ⚠️ 연출 몫(결과 판 0x46844 · 레이저 · B · C — 굴림 없음)은 판이 닫힌 뒤 그림(+0x1094 셈)처럼 안 넘긴다 — 판 끝 칸 그대로 그린다
   * (진행기가 판 끝에 넘긴 장면 칸이 다음 판으로 이어지므로 화면에서만 넘기면 어긋난다). 줌 펀치는 0x35108 의 0xbb428 이 내려 안 그린다.
   */
  readonly burstWindow?: React.ReactNode
}

/**
 * 수비 한 플레이를 보여 준다 — 갈래가 셋이다(조립만 한다 — 갈래마다 `playback/` 아래 파일).
 *
 * 원본은 타구가 뜬 순간 경기 장면 상태가 0x11 → 0x13 → 0x17(수비 인플레이)로 넘어가
 * 공이 멈출 때까지 같은 루프를 돌면서 **매 갱신 눌린 키를 읽는다** (R10 · I 문서).
 *
 * - `ticks` 를 주면 **미리 계산해 둔 틱을 재생만** 한다 (홈런 비행 등).
 * - `input` 을 주면 **여기서 진행기를 한 틱씩 돌리며** 실시간 키를 먹인다 — 원본과 같은 모양이다 (`LivePlayback`).
 * - `runnerPlay` 를 주면 사람이 잡은 주자 판을 같은 모양으로 돌린다 (`LiveRunnerPlayback`).
 */
export function DefensePlayback({
  ticks,
  input,
  runnerPlay,
  side,
  onDone,
  onFieldingErrors,
  grassPalette = null,
  runScoreBoard,
  sceneMemory,
  freePassPlay = false,
  children,
  burstWindow,
}: DefensePlaybackProps) {
  // 수비 판(0x17)은 갱신마다 앱 전역 파티클 관리자를 직접 굴리고 그린다(그리기 0x46c88 → 프레임 끝 0x6de84 · 0x6dd69)
  useClaimSceneParticles()
  // 수비 판도 경기 장면 0x104 의 한 상태(0x17)다 — 0x3874 가 장면 객체를 new 하는 것은 장면 전환 때뿐이라 타석 화면이 내려가고 이
  // 판이 서도 장면은 그대로다(결과 코드 +0xfd4 · 파티클 관리자가 남는다). 타석 화면을 내리고 이 판만 그리는 길(`GameRoute` ·
  // `MissionRoutes`)에서도 경기 장면이 서 있다고 센다 — 공용 창이 뜨면 이 판도 멈춘다(`isGameSceneFrozen`)
  useMarksGameScene()
  if (input !== undefined) {
    return (
      <LivePlayback
        input={input}
        side={side}
        onDone={onDone}
        onFieldingErrors={onFieldingErrors}
        grassPalette={grassPalette}
        runScoreBoard={runScoreBoard}
        sceneMemory={sceneMemory}
        burstWindow={burstWindow}
      >
        {children}
      </LivePlayback>
    )
  }
  if (runnerPlay !== undefined) {
    return (
      <LiveRunnerPlayback
        play={runnerPlay}
        onDone={onDone}
        onFieldingErrors={onFieldingErrors}
        grassPalette={grassPalette}
        runScoreBoard={runScoreBoard}
        burstWindow={burstWindow}
      >
        {children}
      </LiveRunnerPlayback>
    )
  }
  return (
    <RecordedPlayback
      ticks={ticks ?? []}
      onDone={onDone}
      onFieldingErrors={onFieldingErrors}
      grassPalette={grassPalette}
      runScoreBoard={runScoreBoard}
      freePassPlay={freePassPlay}
      burstWindow={burstWindow}
    >
      {children}
    </RecordedPlayback>
  )
}
