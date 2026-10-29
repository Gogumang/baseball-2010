import type { DrawnFieldingError } from '@/features/defense-play/model/fieldingErrors'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { PitchInput, PitcherGameProgress, PitcherGameSummary } from '@/features/play-pitcher-game/model/pitcherGameFlow'

/**
 * 투수편 경기 한 판을 들고 있는 상태 고리.
 *
 * 진행 규칙은 전부 `features/play-pitcher-game` 에 있고, 여기서는 화면이 부르는 손잡이만 묶는다.
 * 앱이 진행 상태를 직접 들고 싶으면 이 고리를 쓰지 말고 진행기 함수를 그대로 불러도 된다.
 */
export interface PitcherGameSession {
  readonly progress: PitcherGameProgress
  /**
   * **로딩 판(상태 7 · 9 · 8)의 팁 글** — 경기 장면 0x104 생성자 0x3301c 가 33100 에서 상태 7 을 모드 갈래 없이 예약하고, 진입
   * 0x39f88 이 판을 싣고 0x53dbc 가 팁을 굴린다. 서 있으면 화면이 `LoadingTip`(진행 칸 끝 0x24 — 모드 3 ≠ 4)을 그리고, 다 그리면 `finishLoading`
   */
  readonly loadingTip: string | null
  /** 로딩 판을 다 그렸다 — 상태 8 끝(48b20)이 모드 3 이라 인트로 0xc 로 간다. 그 진입 예약음 61 을 이때 낸다. 굴림 없음 */
  readonly finishLoading: () => void
  /** 지금 사람이 공을 던질 차례인가 */
  readonly canPitch: boolean
  /** 경기가 끝났으면 요약, 아니면 null */
  readonly summary: PitcherGameSummary | null
  readonly actions: {
    /**
     * 구질·코스·게이지 칸을 정해 한 개 던진다.
     * 인플레이 타구가 되면 **거기서 멈춘다** — 주자 처리는 수비 화면이 끝난 뒤다.
     */
    readonly throwPitch: (input: PitchInput) => void
    /**
     * 구질 고르기(상태 0xf)에서 눌린 키 — '3'/'1'/'7' 이고 그 루에 주자가 있으면 견제 한 판을 돌린다
     * (0x53548 → 0x50f28). 아니면 아무 일도 없다.
     */
    readonly pickoff: (key: string) => void
    /** 수비 화면이 한 타구를 다 돌렸다 (`DefensePlayback` 의 `onDone`) */
    readonly finishDefensePlay: (result?: DefensePlayResult) => void
    /** 수비 그림(0x43278)이 올린 실책 +0x2e — 화면이 `onDone` 바로 앞에 넘긴다 (`DefensePlayback.onFieldingErrors`) */
    readonly recordFieldingErrors: (errors: readonly DrawnFieldingError[]) => void
    /**
     * 수비 화면이 내 수비의 주자 판(도루 · 폭투 · 견제 — `progress.pendingRunnerPlay`)을 다 돌렸다. 결과를 못 받았으면 키 없이
     * 끝까지 돌려서라도 붙든 상태를 푼다.
     */
    readonly finishRunnerPlay: (result?: DefensePlayResult) => void
    /** 상태 0xe 의 OK — 그 뒤 굴림(돌발 0x8f158 · 0xf 진입 0x3d954 의 CPU 대타)을 돌린다 (`confirmScene`) */
    readonly confirmScene: () => void
    /** 조준(상태 0x10)의 CLR — 0xf 로 돌아가 0xf 진입 0x3d954 의 CPU 대타를 다시 묻는다 (`returnToPitchSelection`) */
    readonly returnToPitchSelection: () => void
    /** `#` 스스로 강판 (StrGAME[104] 에 "예") */
    readonly giveUp: () => void
    /** 감독 대사 창(0x23) 확인 */
    readonly confirmManagerHook: () => void
    /** 돌발 창 닫기 */
    readonly closeBurst: () => void
    /** 사구의 0x12 대기 끝(틱 31 갱신 0x4e6d4) — 4e74c 판정 (`judgeHitByPitch`, 화면 `useHitByPitchWait` 가 부른다) */
    readonly judgeHitByPitch: () => void
    /** 판정이 0x1e 를 예약한 다음 틀 — 벤치 클리어링 진입 0x3a5f0 의 굴림 45 번 (`enterBenchClearing`) */
    readonly enterBenchClearing: () => void
    /**
     * 벤치 클리어링 연출(상태 0x1e)이 끝났다 — 인자는 틱 10 의 갱신이 돌았는가.
     * 진행기 `resolveBenchClearing` 이 그 굴림 8 번을 내고 붙든 사구를 먹인다.
     */
    readonly finishBenchClearing: (reachedTargetTick: boolean) => void
    /**
     * 경기 끝 결과 판(상태 0x18)에서 OK — 정산(0x19)으로 넘어간다. 승리 31 · 패배 32 징글은
     * 0x19 진입(결과 적재 0x4ea0c)이 내므로 이 자리에서 낸다.
     */
    readonly enterSettlement: () => void
  }
}

/** 화면이 부르는 손잡이 묶음 */
export type PitcherGameActions = PitcherGameSession['actions']
