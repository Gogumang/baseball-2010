import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { AdvanceResult } from '@/entities/game/model/baseState'
import type { DefensePlayView } from '@/features/defense-play/model/defensePlayView/viewStateInput'
import type { DefenseScene } from '@/features/defense-play/model/defenseScene'
import type { RunnerFate } from '@/features/defense-play/model/runnerFates'

export interface DefensePlayResult {
  /** `baseState.advanceRunners` 와 같은 모양 — 그대로 경기 상태에 넣을 수 있다 */
  readonly advance: AdvanceResult
  /** 매 틱의 화면 스냅샷 (`pages/defense` 가 그대로 그린다) */
  readonly ticks: readonly DefensePlayView[]
  /** 공을 쫓은 야수 칸. 잡히지 않는 타구면 "닿기만 한" 야수다 */
  readonly catchFielderSlot: number
  /** 포구 틱. 잡히지 않는 타구면 야수가 공에 닿은 틱이다 */
  readonly catchTick: number
  /** 필살타법 성공으로 아무도 잡지 못한 타구인가 (0x51800) */
  readonly isUncatchable: boolean
  /** 뜬공을 뜬 채로 잡았는가 — 원본 state[0x1f](쥐기의 아웃 판정이 타자주자를 뜬공 아웃으로 죽였다) */
  readonly caughtOnTheFly: boolean
  /**
   * **판 끝 정산 0xa8024 가 타자에게 적는 결과** — 안타 루타 · 홈런(담장 · 그라운드) · 아웃 (`playOutcome`).
   * 타구 판(`runDefensePlay`)만 낸다 — 견제·도루·폭투 판처럼 타석이 아닌 판에는 없다.
   */
  readonly outcome?: AtBatOutcome
  /**
   * **파울로 닫힌 판인가** — 판 끝 결과 코드 7(0x9d5bc 의 0xb68dc 파울 각 갈래)이 선 판. 판 끝 판정 B 0xae3e8 ae568 이 정산 0xa8024 를
   * 건너뛰고(ae5a2 → ae5b6) 상태 0xf(같은 타석 다음 공)로 보낸다 — `outcome` 이 없고, 0x35108 의 0xa975c 가 주자를 판 앞 자리로
   * 되돌리며(웹 `advance` 는 판 앞 루 그대로) 0xb6b58 이 스트라이크 ≤ 1 이면 +1 한다(`foulStrikes`). 파울 각 공이라도 낙구 전에 잡히면
   * 뜬공 아웃(13)이라 파울 판이 아니다.
   */
  readonly foulEnded?: boolean
  /** 파울 판이 닫힌 뒤의 스트라이크 수 — 0xb6b58 (`strikesAfterPlay`). 파울 판이 아니면 없다 */
  readonly foulStrikes?: number
  /**
   * **2스트라이크 번트 파울 아웃으로 닫힌 판인가** — 판 끝 결과 코드 11(0x9d5bc: 파울 각 · state[4] > 1 · 번트)이 선 판.
   * vt44(11) → vt90 머리 b373a 가 타자주자(+0x98)를 끝내고(+0x96) state[6]++ 하며, 메시지 0xbba(11) → 0x51b20 이 아웃 사건
   * 0xd(0xa7d0c)와 아웃 콜 62(조건 없음)를 낸다. 관문 b0db4 가 다음 틱에 닫고 0xae3e8 ae560 이 정산(0xd)한다 — `outcome` 은 아웃이다.
   * 콜을 고르는 쪽(`atBatSounds.inPlayCallSoundIdOf` 의 `buntFoulOut`)이 62 로 고정한다.
   */
  readonly buntFoulOut?: boolean
  /** **번트 타구였나** — state[0x13](= 장면 +0xfdc, 타구 시작 0x511da 가 옮긴다) ≠ 0. 입력 `buntKind` 그대로다 */
  readonly buntBall?: boolean
  /**
   * **희생 [sp+8]** — 정산 a83e2 ~ a8472(`playOutcome.isSacrificeOf`). 정산이 이 칸으로 타수를 빼고(a884c), 번트 타구면
   * a88e0 이 결과비트 B6(0x40)을 켠다(`burstResultBits` 의 `runnersAdvanced`). 파울로 닫힌 판은 정산이 없어 없다
   */
  readonly sacrifice?: boolean
  /**
   * **판 끝에 2·3루에 (타자주자가 아닌) 산 주자가 있나** — 정산 B7 루프 0xa88fc 의 주자 조건 (`scoringBaseRunnerAfterOf`).
   * 파울로 닫힌 판(정산 없음)은 없다
   */
  readonly scoringBaseRunnerAfter?: boolean
  /**
   * **그라운드 홈런 state[0x25]** — 주자 틱 0xaa0a8 이 홈에 막 닿은 주자(+0x8c == 4)가 이번 타자(+0x98)이고 담장 홈런 state[0x1d](코드 8) ·
   * 폴 홈런 state[0xf](코드 12)가 둘 다 0 일 때만 세운다(aa1e2~aa1fe — 바로 득점 · 보류 둘 다). 정산 a84cc~a84e8 이 이때만 미션
   * 그라운드홈런 칸 R+0xcc(사건 4)를 올린다. 담장을 넘긴 홈런은 타자주자가 홈을 돌아도 서지 않는다.
   */
  readonly groundHomeRun?: boolean
  /**
   * **아웃 판정(0xb36d0)이 마지막으로 적은 아웃이 태그였나** — 원본 `state[0x87]`.
   *
   * 아웃 콜을 62("잡아서·태그해서 낸 아웃")로 낼지 20(루에서 잡은 포스 아웃)으로 낼지를
   * 가르는 칸이다 (`play-at-bat/model/atBatSounds.ts` 의 `inPlayCallSoundIdOf`).
   *
   * **"한 번이라도" 가 아니라 "마지막 판정" 이다** — 근거는 `runOutJudgement` 주석에 적었다.
   * 쓰는 자리는 원본 판정을 옮긴 두 곳뿐이다: `runOutJudgement` 와 협살 태그.
   */
  readonly tagOut: boolean
  /** **첫** 송구의 목표 루(사람 키든 CPU 결정이든). −1 이면 안 던졌다 */
  readonly throwBase: number
  /** 첫 송구의 도착 틱. 송구가 없으면 −1 */
  readonly throwArrivalTick: number
  /**
   * **결과 코드 9 의 메시지가 마지막으로 간 판 틱** — 플레이 틱 b43ec~b444c(공 쥔 야수 H 의 목표점이 루 b · 그 루에 선 아웃 아닌 주자 R ·
   * H 가 목표점에 있음(vt18) · H+0x3b(막 닿음) · H+0xe0(쥠) · R 도 목표점(vt18) → [sp+0x38] = 9)에서 9 가 서고, 6d 절 0x9d5bc 와
   * b4540 의 13 에 덮이지 않아 b4562 가 메시지 0xbba(9)를 보낸 틱이다 — 그 메시지의 0x51c14 가 "Safe!" 17 을 낸다(`judgeCall`).
   * 없으면 −1. 화면이 판을 돌리지 않은 판의 콜(`atBatSounds.inPlayCallSoundIdOf`)이 이 칸으로 17 을 가른다.
   * 타구 판만 싣는다 — 주자 판(견제 · 도루 · 폭투)은 콜을 판 결과의 `callSoundId` 로 따로 낸다
   */
  readonly safeCallTick?: number
  /** 보류됐다가 3아웃으로 날아간 득점 수 (state[0]) */
  readonly voidedRuns: number
  /** 펌블(에러)이 났는가 — 0xb41d0 굴림 (`random` 을 줘야 돈다) */
  readonly fumbled: boolean
  /** 악송구가 났는가 — 0xa1828 굴림 */
  readonly errantThrow: boolean
  /** 필살수비 창이 열렸는가 — 0x66b30(점프) / 0x66be4(슬라이딩). 열려도 보통 포구가 되면 안 쓰인다 */
  readonly specialDefense: { readonly jumpUnlocked: boolean; readonly slideUnlocked: boolean }
  /** 사람이 반짝임 창 안에 키를 넣어 레이저 송구가 나갔는가 (플레이+0x1f4) */
  readonly laserThrow: boolean
  /**
   * **state[0x8b] — 정산 0xa8024 가 보는 필살송구 아웃 표시.** 결과 판 0x46844 가 큰 OUT 을 그리며 +0x1999 를 보고 세운다
   * (46922~46932, 레이저 연출 단계 3 뒤 코드 13 결과 판). 판 끝 정산이 이 판 아웃 사건 > 0 이면 기록 36 (`laserThrowOutRecordOf`).
   * 앞 판에서 남은 +0x1998 · +0x1999(`scene`)로도 선다.
   */
  readonly laserOutFlag: boolean
  /** 판이 끝났을 때의 수비 장면 연출 칸 — 다음 판의 입력 `scene` 으로 넘긴다 */
  readonly scene: DefenseScene
  /**
   * 협살(AI 상태 8)이 몇 번 걸렸는가 — 0xb3a94. `defenseIsCpu` 를 줘야 돈다.
   * 진행기를 안 돌린 결과(견제 · 도루 · 폭투 판의 다른 진행기)에는 없다.
   */
  readonly rundowns?: number
  /** 협살로 잡은 아웃 수 */
  readonly rundownOuts?: number
  /**
   * **주자 목록의 운명** — 원본 목록 순서 그대로(`[타자주자?, 1루?, 2루?, 3루?]`, `runnerFates.ts` 머리말).
   * 정산 `0xa8024` 가 읽는 +0x95(득점)·+0x96(처리 끝)을 옮긴 것이라 R+0x128(실점)·R+0x130(출루 허용)을
   * 원본대로 셀 수 있다 (`chargedRunsOfFates` · `baserunnerAllowedOfFates`).
   * 점수판 득점(`advance.runsScored`)과 달리 **3아웃으로 날아간 보류 득점의 주자도 `scored` 다**.
   */
  readonly runnerFates: readonly RunnerFate[]
  /** 사람이 읽을 진행 기록 — 테스트가 "왜 그렇게 됐나" 를 확인할 때 쓴다 */
  readonly log: readonly string[]
}
