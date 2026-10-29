import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type {
  PendingDefensePlay,
  StealBase,
  TeamAutoRelay,
  TeamGameProgress,
  TeamGameSummary,
  TeamPitchInput,
} from '@/features/play-team-game/model/teamGameFlow'
import type { DrawnFieldingError } from '@/features/defense-play/model/fieldingErrors'
import type { ContactMessageRoll, DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { PickoffBase } from '@/entities/defense-controls/model/pickoff'

/**
 * 팀 경기 한 판을 들고 있는 상태 고리 (일반·시즌·대전 공용).
 *
 * 진행 규칙은 전부 `features/play-team-game` 에 있고, 여기서는 화면이 부르는 손잡이만 묶는다.
 * 앱이 진행 상태를 직접 들고 싶으면 이 고리를 쓰지 말고 진행기 함수를 그대로 불러도 된다
 * (시즌 세션이 그렇게 쓴다 — `TeamGameScreen` 주석 참고).
 */
export interface TeamGameSession {
  readonly progress: TeamGameProgress
  /**
   * **로딩 판(상태 7 · 9 · 8)의 팁 글** — 경기 장면 0x104 를 세울 때마다(새 경기 · 이어하기) 생성자 0x3301c 가 33100 에서 상태 7 을
   * 모드 갈래 없이 예약하고, 진입 0x39f88 이 판을 싣고 0x53dbc 가 팁을 굴린다. 서 있으면 화면이 `LoadingTip`(진행 칸 끝 0x24 —
   * 모드 ≠ 4)을 그리고, 다 그리면 `finishLoading`
   */
  readonly loadingTip: string | null
  /** 로딩 판을 다 그렸다 — 상태 8 끝(48b20)이 모드 1~4 면 인트로 0xc 로 간다. 그 진입 예약음 61 을 이때 낸다. 굴림 없음 */
  readonly finishLoading: () => void
  /** 사람이 칠 차례인가 */
  readonly canBat: boolean
  /** 사람이 던질 차례인가 */
  readonly canPitch: boolean
  /** 경기가 끝났으면 요약, 아니면 null */
  readonly summary: TeamGameSummary | null
  /** `#` 로 투수 교체 화면(상태 0xb)을 열 수 있는가 — 벤치 투수가 있고 투구 전일 때만 */
  readonly canChangePitcher: boolean
  /** 지금 벤치에서 올릴 수 있는 우리 투수 칸 */
  readonly benchPitchers: readonly number[]
  /** `#` 로 대타 화면(상태 0xb)을 열 수 있는가 — 우리 공격 차례이고 벤치 타자가 있을 때 */
  readonly canPinchHit: boolean
  /** 지금 대타로 낼 수 있는 우리 명단 칸 (9번부터가 벤치다) */
  readonly benchBatters: readonly number[]
  /** 지금 도루를 출발시킬 수 있는 루 ('3' 1루 · '2' 2루 · '1' 3루) */
  readonly stealableBases: readonly StealBase[]
  /**
   * **지금 실시간으로 돌려야 하는 타구** (원본 경기 상태 0x17). 차 있으면 화면은 타석·투구 대신
   * 수비 화면을 그리고, 다 돌면 `actions.finishDefensePlay` 로 결과를 넘긴다.
   * 이 칸이 차 있는 동안 `canBat`·`canPitch` 는 둘 다 거짓이라 다음 투구가 나가지 않는다.
   */
  readonly pendingDefensePlay: PendingDefensePlay | null
  readonly actions: {
    /**
     * 타석 화면이 판정한 공 하나. `isUncatchable` 은 필살타법이 성공한 타구(0x517e6 → 0x51800)인가 —
     * 수비 화면의 야수가 쥐지 못한다.
     */
    /** 먹인 뒤의 진행 — 타석 화면이 공 도착의 판정 칸(`lastPitchJudgementCleared`)을 같은 틀에 읽는다 */
    readonly resolvePitch: (detail: PitchOutcomeDetail, isUncatchable?: boolean, buntKind?: number) => TeamGameProgress
    /**
     * **맞은 판정 틀** — 메시지 0x11 굴림 묶음(필살수비 · 표시 패턴 · 두 공 폴 · 필살타법)을 이 공으로 설 판 입력으로 미리 굴린다(A-37).
     * 0x13 뒤 `resolvePitch` 가 세우는 판은 쏜 공에 묶인 그 값을 되찾는다. 돌려준 쏜 공으로 타석 화면이 0x13 을 그린다
     */
    readonly preRollContact: (detail: PitchOutcomeDetail, buntKind: number) => ContactMessageRoll | null
    /**
     * 사람 타석의 필살 스윙이 나갔다 (0x4e136) — `BattingStage` 의 `onSpecialSwingUsed` 를 그대로 잇는다.
     * 인자는 줄인 뒤 남은 횟수다.
     */
    readonly specialSwingUsed: (remaining: number) => void
    /** 타석 결과를 통째로 (자동 소화·테스트용) */
    readonly applyOutcome: (outcome: AtBatOutcome) => void
    /** 구질·코스·게이지 칸을 정해 한 개 던진다 */
    readonly throwPitch: (input: TeamPitchInput) => void
    /**
     * 구질 고르기(상태 0xf)에서 눌린 키 — '3'/'1'/'7' 이고 그 루에 주자가 있으면 견제 한 판을 돌린다
     * (0x53548 → 0x50f28). 아니면 아무 일도 없다.
     */
    readonly pickoff: (key: string) => void
    /**
     * CPU 투수가 견제를 걸었다 (0x34848 이 고른 루로 메시지 0x10). 사람이 칠 차례에만 먹는다.
     * 타석 화면(`widgets/batting-stage`)이 CPU 투구를 고르며 견제를 뽑으면 `onPickoff` 로 알려 주고
     * `TeamGameScreen` 이 여기로 넘긴다.
     */
    readonly cpuPickoff: (base: PickoffBase) => void
    /** 돌발 창 닫기 */
    readonly closeBurst: () => void
    /** `#` 교체 화면에서 벤치 투수 칸을 고른다 (R4 1a·1c) */
    readonly changePitcher: (benchIndex: number) => void
    /** `#` 대타 화면에서 벤치 타자 칸을 고른다 (0xaf06c → 0xaebe4) */
    readonly pinchHit: (benchIndex: number) => void
    /** 상태 0xe 의 OK — 그 뒤 굴림(돌발 0x8f158 · 0xf 진입 0x3d954)을 돌린다 (`confirmScene`) */
    readonly confirmScene: () => void
    /** `#` 교체 화면을 '#'·CLR 로 닫는다 — 상태 0xe 로 (0x495fc) */
    readonly cancelSubstitution: () => void
    /** 투구 코스 단계에서 CLR — 구질 고르기(상태 0xf)로 되돌린다 (0x50ee6) */
    readonly returnToPitchSelection: () => void
    /** 도루 출발 (메시지 0x583 → 0xa9bd4) — 대상 주자가 선 루. 판정은 공이 도착할 때 도루 판이 한다 */
    readonly steal: (base: StealBase) => void
    /** 경기 중 메뉴 '*' 의 자동진행 — **비용 검사는 화면이 먼저 한다** */
    readonly autoProgress: () => void
    /**
     * 자동진행 중계(상태 0x21) 갱신 한 번 — 0xc2198 → 0xc262c (`stepAutoRelay`). 굴린 걸음의 중계 칸을 돌려준다 —
     * null 이면 0xc2198 이 거짓이라 중계가 끝났다(+0x1784 = 0, 상태 0x18).
     */
    readonly stepAutoRelay: () => TeamAutoRelay | null
    /** CLR 중단 질문(StrGAME[6])에 예 — sim+0xa0 = 0 · sim+0x9f = 1 (`stopAutoRelay`) */
    readonly stopAutoRelay: () => void
    /**
     * 수비 화면이 한 타구를 다 돌렸다 (`DefensePlayback` 의 `onDone`).
     * **여기서야** 진루·아웃·득점이 경기 상태가 된다.
     *
     * 화면이 결과를 안 넘겨 주는 경우(재생 갈래로 잘못 들어간 때)는 여기서 끝까지 돌려서라도
     * 붙들어 둔 상태를 푼다 — 안 그러면 다음 타석이 영영 시작되지 않는다.
     */
    readonly finishDefensePlay: (result?: DefensePlayResult) => void
    /** 수비 그림(0x43278)이 올린 실책 +0x2e — 화면이 `onDone` 바로 앞에 넘긴다 (`DefensePlayback.onFieldingErrors`) */
    readonly recordFieldingErrors: (errors: readonly DrawnFieldingError[]) => void
    /**
     * 수비 화면이 사람이 잡은 주자 판(도루 · 폭투 · 견제 — 수비면 송구 키, 공격이면 주루 키 · `progress.pendingRunnerPlay`)을 다 돌렸다. 결과를 못 받았으면
     * 키 없이 끝까지 돌려서라도 붙든 상태를 푼다.
     */
    readonly finishRunnerPlay: (result?: DefensePlayResult) => void
    /** 사구의 0x12 대기 끝(틱 31 갱신 0x4e6d4) — 4e74c 판정 (`judgeHitByPitch`, 화면 `useHitByPitchWait` 가 부른다) */
    readonly judgeHitByPitch: () => void
    /** 판정이 0x1e 를 예약한 다음 틀 — 벤치 클리어링 진입 0x3a5f0 의 굴림 45 번 (`enterBenchClearing`) */
    readonly enterBenchClearing: () => void
    /**
     * 벤치 클리어링 연출(상태 0x1e)이 끝났다 (`BenchClearingScene` 의 `onDone`) — 출구 0xae24c 뒤 사구를 먹인다.
     * `reachedTargetTick` 이면 틱 10 의 굴림 8 번을 진행기가 먼저 낸다.
     */
    readonly finishBenchClearing: (reachedTargetTick: boolean) => void
    /**
     * 경기 끝 결과 판(상태 0x18)에서 OK — 정산(0x19)으로 넘어간다. 승리 31 · 패배 32 징글은 경기가 끝나는 자리가
     * 아니라 **0x19 진입(결과 적재 0x4ea0c)** 이 내므로 이 자리에서 낸다 (투수편 c016ab0 과 같은 자리).
     */
    readonly enterSettlement: () => void
  }
}

/** 화면이 부르는 손잡이 묶음 */
export type TeamGameActions = TeamGameSession['actions']
