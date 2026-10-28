import type { GameState } from '@/entities/game/model/gameState'
import type { LeagueFieldingError, LeaguePlateAppearance, LeagueStolenBase } from '@/entities/league/model/leaguePlayerStats'
import type { RunnerPitcherTags } from '@/entities/game/model/runnerPitchers'
import type { AtBatState, PitchResolution } from '@/entities/at-bat/model/atBatState'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { HalfInningMound } from '@/entities/game/model/simulateHalfInning'
import type { QuickLineup } from '@/entities/game/model/quickLineup'
import type { BatterGameLog } from '@/entities/game/model/batterGameLog'
import type { DefensePlayInput, DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { DefenseScene } from '@/features/defense-play/model/defenseScene'
import type { PendingSettlementEvents } from '@/features/defense-play/model/settlementEvents'
import type { CpuSwingPose } from '@/entities/pitching/model/simulateBatter'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import type { PitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { ManagerHookFlags } from '@/entities/pitcher-career/model/managerHook'
import type { PitcherGameRecord } from '@/entities/pitcher-career/model/pitcherGameRecord'
import type { BurstResolution, BurstSession } from '@/entities/burst-mission/model/burstMissionSession'
import type { BurstRewardDelta } from '@/entities/burst-mission/model/burstMissionReward'
import type { DecisionState } from '@/entities/game/model/winLossSave'
import type { GamePitcherLine } from '@/entities/game/model/gamePitcherLines'
import type { PitcherEvaluationRecord } from '@/features/play-pitcher-game/model/pitcherGameEvaluation'
import type { HalfInningFielderRoll } from '@/features/play-game/model/halfInningBoard'
import type { FielderRecordSeat } from '@/entities/fielding/model/fielderRecords'
import type { BenchClearingEntryRoll, HitByPitchHoldPhase } from '@/features/play-game/model/benchClearingScene'
import type { SceneConfirmWait } from '@/features/play-game/model/sceneConfirm'
import type { SubstitutionScene } from '@/features/play-game/model/substitutionScene'
import type { PitcherGameLogEntry } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/logTypes'
import type { PitcherGameOptions } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/optionsTypes'
import type {
  PitcherPendingPitchArrival,
  PitcherPendingRunnerPlay,
  PitcherStealDisplay,
} from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/pitchStateTypes'

export interface PitcherGameProgress {
  readonly options: PitcherGameOptions
  readonly game: GameState
  /** 내 투수가 지금 마운드에 서 있는가 */
  readonly onMound: boolean
  /** 이 경기에 한 번이라도 등판했는가 */
  readonly hasEntered: boolean
  /** 강판 뒤 남은 경기를 간이 엔진이 도는가 (`engine[0] = 1`, 상태 0x21) */
  readonly simpleEngineRunning: boolean
  /** 감독 대사 창(상태 0x23)이 떠 있으면 그 StrUSER_EVT 번호 */
  readonly managerHookText: number | null
  readonly hookFlags: ManagerHookFlags
  readonly stamina: number
  readonly magicRemaining: number
  /** 상대 타순 커서 (0~8) */
  readonly opponentOrderIndex: number
  readonly atBat: AtBatState
  /** 이 타석의 준비(0xe·0xf)를 이미 지났는가 */
  readonly atBatPrepared: boolean
  /**
   * **상태 0xe 의 OK 대기** — 내가 던지는 타석의 0xe 진입마다 새 객체다 (`features/play-game/model/sceneConfirm`).
   * 진입에서 감독 강판(0x504cc)이 참이면 0x23 으로 빠져 OK 를 기다리지 않는다 — 그때는 0xd 두 그림 · 0xe 한 그림만 세는
   * 지나감 대기(`hooksAtEntry`)를 싣고, 화면은 그것을 다 센 뒤 강판 창을 세운다. 화면이 OK 를 받을 때까지
   * 구질 고르기를 안 띄운다.
   */
  readonly sceneConfirm?: SceneConfirmWait | null
  /**
   * 0xe 에 서서 **OK 를 아직 안 받았다** — OK 뒤 굴림(메시지 1 의 돌발 0x8f158 · 0xf 진입 0x3d954 의 CPU 대타 0xac228)을
   * 아직 안 돌렸다. 화면이 OK 를 받으면 `confirmScene` 이 그때 돌린다. 그래서 0xe 에서 '#' 강판 물음(0x4994a)에 "예" 하면
   * 그 굴림은 아예 돌지 않는다(원본 차례). 없으면 거짓.
   */
  readonly sceneConfirmPending?: boolean
  readonly lastPitch: Pitch | null
  /** 마지막 공(`lastPitch`)이 실투였나 — 놓기 0x4dc78 4deae 의 투구 객체 +8 = 4 → 0x38d1c 38ee0 머리 위 "!" (`PitcherSideStage.isMistakePitch`) */
  readonly lastPitchIsMistake?: boolean
  /** 마지막 공에 CPU 타자가 휘둘렀으면 그 스윙 프레임 · 번트 종류 — 타석 장면의 타자 자세(0x4e0dc → 0x49e64) */
  readonly lastCpuSwing?: CpuSwingPose | null
  readonly lastResolution: PitchResolution | null
  /**
   * 경기 +0xfd4 — 스윙 판정 결과 코드 칸(`features/defense-play/model/sceneResultCode`). 0x11 진입(3deea)이 공마다 0 으로 지우고
   * CPU 타자가 휘두른 공만 판정(5130e)이 덮는다. 주자 판의 튐 파티클 · 홈런성 조건이 본다 — 견제는 앞 공의 값. null = 원본 미정의(헛스윙)
   */
  readonly sceneResultCode: number | null
  /** 이닝별 실점 표 (`0xb6988`) — 감독 강판 3번 사유가 읽는다 */
  readonly inningRuns: readonly number[]
  readonly decision: DecisionState
  /** 평가 객체 R 의 투수 칸 (entities/pitcher-career) */
  readonly pitcherRecord: PitcherGameRecord
  /** 경기 뒤 평가가 읽는 칸 (내가 던진 것만 쌓인다) */
  readonly record: PitcherEvaluationRecord
  /** 투구 수 (레코드 +0x28 · R+0x140) */
  readonly pitchCount: number
  /**
   * 내 투수에게 매겨진 실점 — 레코드 +0x22(방어율)이고 평가 칸 R+0x128 과 같은 값이다.
   * 둘 다 정산 0xa8024 의 같은 주자 루프(0xa8ea4~0xa8f60)가 **득점 주자를 내보낸 투수**(주자+0x30)에게
   * 매긴다 — 마운드에 있는 동안의 득점 + 강판 때 남겨 둔 주자(`runnerPitchers` 가 `MY_PITCHER_SLOT`)의 득점.
   */
  readonly runsAllowedByMe: number
  /**
   * **지금 공격 중인 쪽 루의 주자마다 그 주자를 내보낸 투수**(주자+0x30) — 우리 수비면 우리 투수 칸(나는 `MY_PITCHER_SLOT`),
   * 우리 공격이면 상대 투수 칸. 원본은 주자마다 내보낸 투수를 적어 두므로(0xa93ac 넷째 인자 → 주자+0x30) 강판 뒤 간이 엔진
   * 타석(0xc1054 등도 정산 0xa8024 를 부른다)에서 내가 남긴 주자가 들어와도 내 실점이다(`entities/game/model/runnerPitchers`).
   * 반 이닝이 넘어가면 빈 루라 비고, 없으면 지금 투수로 본다
   */
  readonly runnerPitchers?: RunnerPitcherTags
  /**
   * 내가 마운드에서 내준 볼넷 · 사구 — 레코드 **+0x2a(사사구)**. 정산 0xa8024 의 공통 꼬리가
   * `state[5] > 3`(볼넷, a8b0c) · `state[0x12]`(사구, a8b8a) 이면 수비 팀 지금 투수 0xae83d 의 +0x2a 를 +1 하고
   * 0..9999 로 자른다(a8b58~a8b74 · a8bd2~a8bee). 앞머리 게이트 [sp+0x38](0xa56dc)을 **안 본다** — 포스트시즌에도 센다(원본 그대로).
   */
  readonly freePassesByMe: number
  /**
   * state+0x88 출루 허용 — 정산 0xa8024 의 a8c5c~a8ca6 이 **그 정산이 읽는 주자 목록의 마지막 원소** `+0x96 == 0` 이고 수비 팀이
   * 사람이면 1 로 세운다(지우는 곳 없음, `baserunnerAllowedOfPlay`). 판 종류를 안 거르므로 정산하는 주자 판(견제 4 · 도루 5 ·
   * 삼진이나 3아웃 · 경기 끝으로 정산되는 폭투·포일 9)도 그 판의 주자 운명으로 본다. 야수선택은 안 깨고 에러로 산 타자주자는 깬다.
   * 팀 경기 `TeamPitchingLine.allowedBaserunner` 와 같은 칸이다.
   */
  readonly teamBaserunnerAllowed: boolean
  /** state+0x89 피안타 · +0x8a 실점 — 우리 팀 투수 **전체**가 내준 것 */
  readonly teamHitsAllowed: number
  readonly teamRunsAllowed: number
  /**
   * **정산 사건 목록(ctx+0x30)에 남은 앞 판의 몫** — 같은 투구 틈에 앞서 돈 도루 · 폭투·포일 · 견제 판의 아웃 · 득점.
   * 견제 판(종류 4) 정산이 함께 센다(`features/defense-play/model/settlementEvents`). 공이 손을 떠날 때(0xa5e14) 비운다.
   */
  readonly pendingSettlementEvents?: PendingSettlementEvents
  /**
   * **정산이 센 아웃 − 아웃 콜이 센 아웃** — 우리 지금 투수 R[3](a8f8c, 완투 판정) · 투수 레코드 +0x20(a8cb0, 시즌 아웃)은 정산이
   * 사건 목록의 아웃([sp+0x30])으로 세고, R+0x13c(`record.outsRecorded`)는 아웃 콜 0xa7c4c · 0xa7d0c 가 하나마다 센다.
   * 둘이 갈리는 곳: 정산을 건너뛰는 폭투·포일 판(ae596 → ae5a2, −아웃) · 같은 투구 틈 앞 판을 다시 세는 견제 정산(+앞 몫).
   * 없으면 0
   */
  readonly settledOutsExtra?: number
  /**
   * **투수 레코드 +0x20(시즌 아웃)만 더 세는 몫** — 낫아웃(state[0x1a]) 정산은 [sp+0x30] 에 삼진 사건 5 가 하나 더 들어
   * a8cb0 이 +0x20 에 그대로 더하고, 보정 −1 은 R+0x13c(a8cfc)와 R[3](a8fa8)에만 건다 — 낫아웃 하나마다 시즌 아웃이 1 많다
   * (원본 그대로). 없으면 0
   */
  readonly seasonOutsExtra?: number
  /** 이 이닝에 아직 아무도 안 내보냈는가 — R+0x184(삼자범퇴 표시) 자리 */
  readonly perfectInningFlag: boolean
  /** 상대 타순 칸별 이번 경기 안타·홈런 — 돌발 b6/b7 조건이 읽는 기록 +0x12·+0x13 */
  readonly opponentBatterLogs: Readonly<Record<number, { hits: number; homeRuns: number }>>
  /**
   * 이 경기에서 달성한 기록 id (0xa77f0 이 한 번 받을 때마다 하나).
   * 투수편은 모드 3 이라 **공격·수비 게이트가 둘 다 열린다** (0x3a20a — 모드 3·4 는 내 팀 전체가 사람 팀).
   * 그래서 동료 타석의 타격 기록(0~15·34·35)과 우리 투수의 삼진 계열(16~23·25)이 모두 들어온다.
   */
  readonly recordIds: readonly number[]
  /** 우리 팀 타순(0~8)별 이 경기 기록 — 투수편 주인공은 타석에 안 서므로 아홉 칸 모두 동료다 */
  readonly teammateLogs: Readonly<Record<number, BatterGameLog>>
  /** ctx+0x161 — 이번 타석 투구 수. 삼구 삼진(16) 판정이 읽는다 */
  readonly atBatPitches: number
  /** ctx+0x16c — 이번 반 이닝 투구 수. 삼구 삼자범퇴(25) 판정이 읽는다 */
  readonly halfInningPitches: number
  /**
   * 0xb8cec 가 돌려주는 **지금 마운드에 선 우리 투수**의 경기 기록 R[0]·R[1].
   * 기록 18~23 은 "현재 투수" 기준이라 투수가 바뀌면 0 부터 다시 센다 (R8 4-2).
   * `record.strikeouts` 와 달리 동료 투수가 잡은 삼진도 여기 들어간다.
   */
  readonly moundStrikeouts: number
  readonly moundStrikeoutCombo: number
  /**
   * **재생만 하면 되는** 장면. 매 틱의 화면 스냅샷이 들어 있어 수비 화면은 이것만 받아 그리면 된다
   * (타자편 `gameFlow` 와 같다).
   *
   * 홈런 비행처럼 사람이 조작할 것이 없는 장면이 여기 들어온다. 사람이 송구를 잡는 인플레이 타구는
   * `pendingDefensePlay` 쪽으로 가고, 다 본 뒤에는 **여기 남기지 않는다** — 남기면 한 번 더 튼다.
   */
  readonly lastDefensePlay: DefensePlayResult | null
  /**
   * **수비 장면 연출 칸** — 결과 판 +0x1997~+0x1999 · 연출 단계 · deadly_effect 애니 · 줌 (`defenseScene`). 원본은 경기 장면
   * 객체 칸이라 판마다 안 지워진다 — 판 결과의 `scene` 을 받아 두었다가 다음 판(타구 · 주자 · 견제)에 넘긴다. 없으면 경기 첫 판.
   */
  readonly defenseScene?: DefenseScene
  /**
   * **내가 수비하며 실시간으로 돌리는 주자 판** (도루 · 폭투·포일 · 견제 — `features/defense-play/model/liveRunnerPlay`).
   * 원본 상태 0x17 동안 사람 송구 키가 +0x160 을 적고 vt4c 가 그 루로 던진다 — 판 결과가 키에 달려 미리 돌릴 수 없어
   * 화면이 한 틱씩 돌린 뒤 `resolveRunnerPlay` 로 넘긴다. 그동안 다음 공이 안 나간다.
   */
  readonly pendingRunnerPlay?: PitcherPendingRunnerPlay | null
  /**
   * **0x12 진입을 기다리는 못 맞힌 공** — 화면 갈래(`startPitch` 의 `holdsArrival`)는 공을 놓는 걸음(0x11 틱 10)에서 공 도착 0x3dfac 을
   * 돌리지 않고 여기 붙든다. 원본은 공이 날아간 뒤 0x12 진입 틀에 0x3dfac 이 `rollPassedBall` · 판 시작 굴림을 내므로, 그 사이 프레임 끝
   * 관리자 틱 0x6de85 (마구 공 파티클 따위 — 경기 난수)가 먼저 굴린다. 화면이 그 틀에 `enterPitchResult` 를 불러 나머지를 돌린다.
   * 없으면(null · 옛 진행) 붙든 공이 없다
   */
  readonly pendingPitchArrival?: PitcherPendingPitchArrival | null
  /**
   * **이번 투구에 출발한 주자들의 루** — state[0x14 + 루]. 투수편은 늘 CPU 공격이라 투구마다 CPU 타자 결정(0x34334)
   * 바로 앞에서 `0x520de` 를 굴려 넣는다(`rollCpuStealStart`). 공이 도착하면(0x3dfac) 도루 판(종류 5)을 열거나
   * 지워지고, 인플레이 타구면 타구 판의 리드(0x3d7b8)가 이 칸을 본다.
   */
  readonly stealingFrom: readonly StealBase[]
  /**
   * **CPU 도루 출발 표시** st[0x15 + i] — CPU 가 이번 공에 출발시킨 주자의 루(0x520de → 0xa9bd4). 투구 화면 HUD(0x35b94)는
   * 그 루의 주자를 안 그린다. 판정 입력(`stealingFrom`)과 원본은 한 칸이지만 지우는 때가 판정이 아니다 (직접 재역어셈):
   * - 0xf 진입 `0x3d954` 3d966~3d976 — `for i in 0..3: st[0x14 + i] = 0 ; st[0xa4 + i] = 0` (`enterPitchSelection`)
   * - 판 시작 리드 `0x3d7b8` 3d8c6~3d8d2 — 판 종류 **1(타구 · 파울 각 공)** 일 때만. 도루(5) · 폭투(9) · 밀어내기(2) 판은 안 지운다.
   * 세우는 때는 상태 0x11 의 틱 10(CPU 조작 0x537dc `[+0x18] == 10` → 0x583) — 공을 놓는 틱(0x4e060 `[+0x2c] > 9`)과 같은 그림이라
   * 웹은 공을 던지는 걸음(`startPitch`)에 세운다.
   * 같은 타석 다음 공의 0xf 진입은 진행기가 공을 먹인 걸음에 바로 돌리므로(`afterMyPitchArrival`) 그 진입은 `selectionEntered` 로만
   * 적는다 — 화면은 공이 날거나 0x12 인 동안(원본 0x11 · 0x12) 계속 숨긴다(투수 미션 `pitcherStealDisplay` 와 같은 꼴).
   * 새 타석이면 0xf 진입이 0xe 의 OK(`confirmScene`) 뒤라 그때까지 숨긴다. 없으면(옛 상태) 비어 있다.
   */
  readonly stealDisplay?: PitcherStealDisplay | null
  /**
   * **마지막으로 열린 공 도착 판** (0x3dfac — 종류 9 폭투·포일 · 종류 5 도루). 판정 콜을 고르는 데만 쓴다 —
   * 걸음 앞뒤가 다른 객체면 이번 걸음에 새로 열린 판이다. 재생은 `lastDefensePlay` 가 맡는다.
   */
  readonly lastArrivalPlay: PitchArrivalPlay | null
  /**
   * **마지막 공 도착(0x3dfac)이 판정 칸 [장면+0x10ac] 를 지웠나** — 낫아웃 갈래 3e0aa (`clearsPitchJudgement`). 사람이 던지는 타석
   * (`PitcherSideStage.isJudgementCleared`)의 0x12 틱 0 판정 글자 · 삼진 양끝 파티클이 이 값으로 선다. 못 맞힌 공마다 공 도착이 다시
   * 적는다 — 맞힌 공은 안 적어 앞 값이 남지만 그 공은 판정 글자 삼진이 없다. 없으면 거짓
   */
  readonly lastPitchJudgementCleared?: boolean
  /**
   * **지금 화면이 실시간으로 돌리고 있는 타구.** 차 있으면 이 경기는 "수비 진행 중" 이고,
   * 타석 결과(안타/아웃 코드)만 정해졌을 뿐 **진루·아웃·실점은 아직 하나도 안 먹였다**.
   *
   * 원본은 타구가 뜨면 경기 장면이 상태 0x17 로 넘어가 공이 멈출 때까지 같은 루프를 돌며
   * 매 갱신 눌린 키를 읽는다 (R10 · I 문서). 그 동안 다음 투구는 나가지 않는다 —
   * 웹도 이 칸이 차 있는 동안 `isPitchTurn` 이 거짓이 되는 것으로 그 자리를 붙든다.
   *
   * ⭐ 투수편은 **사람이 수비**다 (조작 객체 `[+0xc]` = 1, I 0절) — 타자편과 정반대로 송구 키를 읽는다.
   * 이 칸은 **내 투수가 마운드에 있는 수비 반 이닝에서만** 찬다 (`startPitch` 가 유일한 자리이고
   * 그 앞에 `isPitchTurn` 이 있다). 우리 팀 공격 이닝(`playTeammateAtBat`)과 내가 마운드에 없는
   * 수비 타석(`playDefensiveAtBat`)은 원본도 간이 엔진이라 수비 시뮬레이션 자체를 안 돌린다.
   *
   * 화면이 다 돌고 나면 `resolveDefensePlay` 가 그 결과를 먹이고 이 칸을 비운다.
   * 미리 다 계산해도 되는 자리(테스트)는 `throwPitch` 를 부르면 이 칸을 거쳐 가되
   * 한 번에 비워져 나온다 — 밖에서 보면 예전과 똑같다.
   */
  readonly pendingDefensePlay: DefensePlayInput | null
  /**
   * **붙든 사구** — 0x12 대기(`'wait'`) · 벤치 클리어링 진입 앞(`'entry'`) · 연출 중(`'scene'`, 상태 0x1e)
   * (`HitByPitchHoldPhase`, A-22). 내가 던진 공이 사구면 굴림 없이 여기 붙들고, 화면이 0x12 틱 31 에 `judgeHitByPitch`(4e74c 의
   * 20/99 굴림)를, 들어갔으면 다음 틀에 `enterBenchClearing`(진입 0x3a5f0 의 굴림 45 번)을 부른다. 밀어내기 주루·정산·다음 타석은
   * 안 들어갔으면 판정 때, 들어갔으면 화면이 연출을 끝내고 `resolveBenchClearing` 을 부를 때 비로소 돈다
   * (원본도 출구 0xae24c 뒤에야 0x17 로 간다).
   */
  readonly pendingBenchClearing: {
    readonly phase: HitByPitchHoldPhase
    readonly outcome: AtBatOutcome
    /** 이 사구 공이 연 밀어내기 판(종류 2, `arrivePitcherPitch`) — 연출 뒤 0x17 로 재생한다 */
    readonly arrivalPlay?: PitchArrivalPlay | null
    /** 진입 0x3a5f0 의 굴림 45 번 — 그리기 0x43228 이 공격 9명을 세운다 (`rollBenchClearingEntry`) */
    readonly entryRolls?: readonly BenchClearingEntryRoll[]
  } | null
  /**
   * 마지막으로 **OK 를 기다리며 선** 공수 교대 판(상태 0x18 교대 가지) — 화면은 `serial` 이 바뀌면 판을 띄운다.
   * 모드 3 에서는 1회초 판(인트로 0xc 끝 → 0x18)만 설 수 있다 — `withHalfInningBoard` 머리말.
   */
  readonly halfInningBoard: {
    readonly serial: number
    readonly inning: number
    readonly half: GameState['half']
    /** 판 틱 0 의 0x3fac4 굴림 36 개 — 운동장 전경 0x4fb8c 가 18명을 걷게 한다 (`rollHalfInningFielders`) */
    readonly fielderRolls?: readonly HalfInningFielderRoll[]
  } | null
  /**
   * **수비 줄 야수 +0xec** — 장면이 사는 동안 칸별로 남는 선수 레코드 (`entities/fielding/model/fielderRecords`). 교대 판 0x3fac4
   * (`withHalfInningBoard`, 칸 0..8)와 판 시작 0xb0fb4(칸 1..8 — `myFielderRecordsOf`)만 적는다. 모드 3 은 1회초 판(후공 선발)이 안 서면
   * 경기 내내 칸 0 이 0 이라 내 투수 칸의 펌블 확률 0 · 레이저 굴림 없음 · 실책 안 쌓임이다(원본 그대로). 없으면 장면 직후(0)
   */
  readonly fielderRecords?: readonly (FielderRecordSeat | null)[]
  /** 마지막으로 사람이 던진 타석의 반 이닝 — 반 이닝이 바뀐 뒤 첫 사람 타석인지 가린다 */
  readonly lastHumanHalf: { readonly inning: number; readonly half: GameState['half'] } | null
  /** 그 뒤로 자동(간이 엔진, 상태 0x21) 타석이 지났는가 — 지났으면 0x18 이 판 없이 넘어간다 (4fab6) */
  readonly autoSinceHuman: boolean
  /**
   * **자동진행 중계(상태 0x21)의 틱들** — 사람 장면 사이에 돈 간이 엔진 0xc262c 한 번마다 한 칸(교체로 공 없이 돌아간 틱 ·
   * 타석 하나). 화면이 틱마다 한 칸씩 중계를 튼다(`pages/auto-play-relay`). 모드 3 은 0x21 키 · 속도 · 배경음 · 연출 대기가 없어
   * 굴린 결과를 나중에 틀어도 원본과 같다. 새 자동 묶음마다 `serial` 이 오른다.
   */
  readonly autoRelay?: PitcherAutoRelay | null
  readonly burst: BurstSession | null
  readonly lastBurstResolution: BurstResolution | null
  /**
   * 이 경기 돌발 보상 · 페널티(0x8e34c) — 판정 차례대로. 사기(종류 1)는 판정 그 자리에서 `options.teamMorale` · `stats` 에도 먹는다
   * (`withPitcherGameMorale`). 커리어(사기 · 인기도 · 평판 · 소지금)에는 앱이 경기 끝에 얹는다 — 0x8e34c 는 저장하지 않고 정산 0x4ea0c 의
   * 저장이 함께 쓰므로, 경기 중 나가면(0x40140 — 저장 없음) 사라지는 것까지 같다. 없으면 빈 목록
   */
  readonly burstRewardDeltas?: readonly BurstRewardDelta[]
  /**
   * **이 경기에서 0xb570c(b5768)가 상대 팀 레코드 +2 에 마지막으로 쓴 값** — 아직 안 덮었으면 없다(그동안 상대 첫 공은
   * `PitcherGameOptions.opponentStaleMorale`). 덮는 자리: 사람 장면 상대 타석의 0xe 그리기 0x4d9ec → 0x35b94(35f70 `상태 == 0xe` →
   * 공격 팀 +0x220) · 우리 공격(자동진행 0x21)의 공마다 c1446 · c1852(수비 = 상대) · 강판 뒤 상대 자동 타석의 스윙 경로 0xab214 ·
   * 주자 있는 판정 경로 c19ec. 돌발 보상(0x1c · 0x1d 진입 → 0x8e34c)이 사기를 바꾼 뒤 다시 안 덮이면(경기 마지막 타석의 돌발)
   * 경기 끝 그 칸은 **바뀌기 전 값**이다 — 0x1c · 0x1d · 0x18 · 0x19 에서 0xb570c 에 닿는 길은 35f70 에 막힌다 (r104 직접 뜸)
   */
  readonly opponentRecordMorale?: number
  /**
   * **공 객체 +0x10** (경기+0xf98) — 공에 실린 마구 번호. 0x34d6c 투수 쪽 보정(구속·제구 +150~220 · B/C %)이 본다.
   * 상태 0x11 진입 `0x3de10` 만 쓴다 (H2 3-4): `구질 == 22 && 0xaea10(수비 팀) > 0` 이면 `+0x10 = 투수+0x18`.
   * 마구 횟수는 그보다 앞(코스 확정 0x50e9c)에서 줄어 **마지막 한 번(1 → 0)은 새로 안 싣는다**.
   * 되돌리는 곳이 없어 한 번 실린 번호는 경기 내내 직구·변화구에도 남는다 — 원본 그대로 옮긴다.
   */
  readonly ballMagicNumber: number
  /**
   * 상대 팀 명단(`team+0xe`)과 타순 칸별 이 경기 기록(`team+0x34 + 타순×0x18`) — **CPU 대타** `0xac228` 이 보고 바꾼다.
   * 기록은 내가 던진 타석이든 간이 엔진 타석이든 정산 `0xa8024` 가 똑같이 쌓는다.
   */
  readonly opponentLineup: QuickLineup
  /**
   * `state[0xe]` — 다음 공이 나가기 전까지 CPU 대타를 다시 묻지 않게 막는 칸. `0xac228`(ac33e)이 1 로 세우고
   * 공마다 투구 처리 `0xa5e14`(a5e7c — 사람 공 0x3dec6 · 간이 엔진 c26ca)와 새 타석 0xd 진입 `0x48d50`(48eb6,
   * 이전 상태가 0x16 이면 건너뜀)이 내린다 (a114d95).
   */
  readonly pinchHitUsed: boolean
  /**
   * 우리 팀 명단(`team+0xe`)과 타순 칸 기록 — 동료 타석은 모두 간이 엔진이라 `0xc1ba4` 의 CPU 대타(0xc1c50)가 **우리 팀**도 바꾼다
   * (모드 3 은 투수편 주인공이 타석에 안 서므로 아홉 칸 다 CPU 처럼 돈다).
   */
  readonly ourLineup: QuickLineup
  /**
   * 양 팀 마운드 — 지금 던지는 투수 칸과 그 스태미나(`+0x2c`)·투구 수(`+0x27c`)·실점 B(`+0x280`)·이미 내려간 투수·
   * `state[0xd]`(교체 직후). 자동 타석(0x21)마다 `0xc1ba4` 의 교체 AI `0xac428`(0xc1ce2)이 **수비 팀** 것을 바꾸고,
   * 투구마다 `0xa5e14` 가 깎는다 (c26ca). 칸 번호는 `ourPitcherOrderOf`·`opponentPitcherOrderOf` 의 로스터 칸이다.
   *
   * 우리 쪽은 내 투수가 마운드에 있으면 `MY_PITCHER_SLOT` 이다 — 그동안 내 스태미나·투구 수는 `stamina`·`pitchCount` 가 든다
   * (사람 장면은 이 칸을 안 본다). 마운드에 오르는 투수의 스태미나는 제 레코드 `+0x2c` 다 — 두 팀 표(`ourPitcherStaminas` ·
   * `opponentPitcherStaminas`, 리그 표 `leaguePitcherStaminas` 에서 이어 온 값)에서 꺼낸다. 경기가 깎은 값은 경기 끝 표로
   * 리그 표에 남고(0xaeb08), 하루 끝 4f304 가 열 팀 `0xb617c`(+20%)를 먹인다(`entities/pitcher-career/model/leaguePitcherRecords`).
   * 내 투수는 `options.stamina`(레코드 +0x2c, 하루 끝 0xb60e0 회복 — `applyPitcherGameResult`)로 오른다.
   */
  readonly ourMound: HalfInningMound
  readonly opponentMound: HalfInningMound
  /**
   * 양 팀 투수 칸(붙박이 표 칸 0~7)별 **레코드 스태미나** `+0x2c` — 벤치 투수는 이 값으로 올라오고 내려간 투수는 그 순간
   * 값을 남긴다. 지금 마운드 값은 `…Mound.stamina`, 내 값은 `stamina` 가 든다. 경기 끝 표는 `summaryOf` 가 낸다.
   */
  readonly ourPitcherStaminas: readonly number[]
  readonly opponentPitcherStaminas: readonly number[]
  /**
   * 이 경기를 던진 **CPU 투수** 줄 (`entities/game/model/gamePitcherLines`) — 내 투수(육성 선수)는 빼고 동료·상대 투수만.
   * 간이 타석마다 아웃·삼진은 그 순간 마운드 투수에게, 실점은 들어온 주자의 책임 투수(주자+0x30)에게 쌓고, 투구 수는 교체·경기 끝에 그 마운드의 `pitches` 를 얹는다.
   */
  readonly pitcherLines: readonly GamePitcherLine[]
  /**
   * **리그 타자 기록표 도루 +0x2c 재료** — 모드 3 의 기록 게이트 0xa56dc(점프표 0xd8204 → 0xa571c)는 시즌 객체 0x1fa2d 의
   * +0x12c(국가대항전) · +0xb4(포스트시즌)가 0 이면 마선수(0xb633d)만 거짓이라, 투수편 정규시즌 경기도 주자 레코드 +0x2c 를 올린다:
   * 간이 타석 도루(0xc1a42~0xc1a98 — 주자마다 0xa56dc(ctx, 주자, 0)) · 사람 수비의 도루 판(0xa8340~0xa83c0 — 게이트는 지금 타자).
   * 포스트시즌 · 국가대항전 거르기는 커리어에 먹이는 쪽이 한다. 옛 진행은 없다
   */
  readonly leagueStolenBases?: readonly LeagueStolenBase[]
  /**
   * **리그 타자 기록표 실책 +0x2e 재료** — 수비 그림 0x43278 이 펌블 6 · 악송구 4 를 본 야수마다(`recordDrawnPitcherFieldingErrors`).
   * 투수편에서 그려지는 수비는 내가 던지는 반 이닝의 우리 팀뿐이다. 게이트가 없어 포스트시즌에도 쌓는다. 옛 진행은 없다
   */
  readonly leagueErrors?: readonly LeagueFieldingError[]
  /**
   * **리그 타자 기록표 타석 줄 재료**(+0x20 타수 · +0x22 안타 · +0x24 2루타 · +0x26 3루타 · +0x28 홈런 · +0x2a 타점) — 정산
   * 0xa8024 는 sp+0x34 = 0xa56dc(ctx, 공격 팀 지금 타자, 0) 이 참이면 그 타자 레코드에 쌓는다. 모드 3 갈래(0xa571c)는 정규시즌이면
   * 마선수(0xb633d)만 거짓이라 상대 타자(내가 던진 타석 · 간이 수비 타석) · 동료 타자(간이 타석) 모두 쌓인다. 마타자 칸은 뺀다.
   * 포스트시즌 · 국가대항전 거르기는 커리어에 먹이는 쪽이 한다. 옛 진행은 없다
   */
  readonly leaguePlateAppearances?: readonly LeaguePlateAppearance[]
  /**
   * **삼진 + 도루 판(종류 5)으로 끝난 내 삼진 수** — 정산 0xa8024 가 종류 5 로 한 번 돌아 a8d38 이 R+0x134(탈삼진, 코드 0x18)를
   * 건너뛰지만, 투수 레코드 **+0x26(시즌 탈삼진)** 은 a8d06~a8d34 가 판 종류를 안 보고 [sp+0x20](이번 플레이의 삼진 사건 5 수)만큼
   * 올린다(게이트 sp+0x38 = 0xa56dc(R, 수비 지금 투수, 0)). 그래서 시즌 탈삼진은 `record.strikeouts` 에 이 수를 더한다. 옛 진행은 없다
   */
  readonly stealPlayStrikeouts?: number
  /** 우리·상대 지금 투수의 **이번 이닝 실점 A**(`+0x284`) — 반 이닝 교대 `0xa5b00`·교체 `0xaec64` 가 0 으로 */
  readonly ourInningRunsAllowed: number
  readonly opponentInningRunsAllowed: number
  /**
   * 사람 장면(0xf 진입 `0x3d954`)에서 지난 **CPU 대타** 한 번 — 화면이 "Time!" 22 와 들어온 타자 등판음(14/15/26)을
   * 내는 신호다 (`pages/team-game` 의 `pinchHitSoundIdsOf` 와 같은 모양). 간이 엔진 대타는 연출이 없어 안 바꾼다.
   */
  readonly scenePinchHit: { readonly serial: number; readonly by: 'CPU'; readonly incomingIsAce: boolean } | null
  /**
   * **교체 연출 0x16** (`features/play-game/model/substitutionScene`) — 0xf 진입 0x3d954 의 CPU 대타가 낸 것. 화면이 "CHANGE" 애니를
   * 그린 뒤 0xd 두 그림 → 0xe 에서 타자 등판음(0x38b64 타자 가지)을 낸다. "Time!" 22 는 걸음 끝 소리가 낸다. 굴림 없음.
   */
  readonly substitutionScene?: SubstitutionScene | null
  readonly log: readonly PitcherGameLogEntry[]
  readonly nextLogId: number
  /** 경기가 끝난(또는 지금 치르는) 이닝 인덱스 (0-기준) */
  readonly endedInningIndex: number
}

/** 사람이 안 잡은 타석(간이 엔진)이 지났다는 표시 */
/** 자동진행 중계 묶음 — `PitcherGameProgress.autoRelay` */
export interface PitcherAutoRelay {
  readonly serial: number
  readonly ticks: readonly PitcherAutoRelayTick[]
}

/**
 * 0x21 갱신 0x48480 의 한 걸음 = 0xc262c 한 번. 그 틱 뒤의 경기(`progress` — 중계 칸을 비운 사본)와, 타석 틱이면 그 타석.
 * 교체 틱(0xc1ba4 가 대타 · 투수 교체를 내 공 없이 돌아감, c266c)은 `atBat` 이 null 이다.
 */
export interface PitcherAutoRelayTick {
  readonly progress: PitcherGameProgress
  /** 이 틱 앞의 경기 — 3아웃 넘김 0xb6b6c 는 다음 틱 0xc2198 이라 이 틱 그림은 앞 반 이닝 그대로다 */
  readonly before: GameState
  readonly atBat: {
    /** 공격이 우리(동료 타석)인가 */
    readonly ours: boolean
    /** 친 타자의 타순 커서 (팀[+0x32]) */
    readonly orderIndex: number
    readonly outcome: AtBatOutcome
    /** 그 타석에 파울이 났나 — 코드 0 뜬공 아웃의 중계 글이 앞 공의 13(파울)으로 남는다 (`relayCodeOf`) */
    readonly fouled: boolean
    /** 헛스윙 세 번째 겨루기에서 진 아웃 — 결과는 '아웃' 이지만 중계 글은 5 "삼진 아웃"(c17d8, `relayCodeOf`) */
    readonly swingingStrikeOutLost?: boolean
    /** 타석 끝 카운트 st[4] · st[5] (간이 엔진이 올린 그대로) */
    readonly strikes: number
    readonly balls: number
  } | null
}
