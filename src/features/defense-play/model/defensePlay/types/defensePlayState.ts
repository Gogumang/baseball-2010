import type { BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction'
import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import type { FielderState, PlayView, RunnerState } from '@/entities/fielding/model/fieldingState'
import type { HeldRunState } from '@/entities/fielding/model/heldRuns'
import type { RundownPlan } from '@/entities/fielding/model/rundown'
import type { DefensePlayInput } from '@/features/defense-play/model/defensePlay/types/defensePlayInput'
import type { ActionMemory, DefensePlayView } from '@/features/defense-play/model/defensePlayView'
import type { DefenseScene } from '@/features/defense-play/model/defenseScene'

/**
 * 진행기 한 틱의 소리 한 칸 (`DefensePlayState.tickSounds`) — 번호가 정해진 소리, 메시지 0x13 의 주자 칸(함성 0x51fb8 은 결과 코드
 * [경기+0xfd4] 의 0x357e0 을 보므로 화면이 고른다), 깊은 낙구 함성 60 의 후보(0x357e0 은 화면이 본다)
 */
export type DefenseTickSound =
  | { readonly kind: 'sound'; readonly soundId: number }
  | { readonly kind: 'runIn'; readonly slot: number }
  | { readonly kind: 'deepLanding' }

/** 진행기 안에서 **제자리에서 바뀌는** 주자 한 명 */
export interface MutableRunner {
  state: RunnerState
  /** 최소 진루 루 — 포스 사슬이 정한다(타자주자는 1루) (`createPlayRunners`) */
  minimumBase: number
  /**
   * 원본 `+0x84` — 직전의 `+0x7c`(달려가던 루). a07b0 vt48 이 목표를 바꿀 때 옛 +0x7c 를 옮기고, 도착 0xa040c 가
   * `+0x84 = +0x8c = +0x7c` 로 적는다. 판 끝 정산 0xa8024 가 타자주자에게 "1루를 넘봤나" 로 읽는다(`playOutcome`)
   */
  previousTarget: number
  /** 이미 득점 처리를 했는가 */
  counted: boolean
  /**
   * 주자 +0x3b — 마지막 목록 틱(6 절 이동)에서 목표점에 막 닿았다. 주자 틱 0xa01cc(a0364 → 0xbf094 bf0a2)가 목록 틱마다 지우고
   * 이동 0xbf0dc 가 닿은 갱신에서만 세운다. 득점 0xaa0a8(aa12a)은 이것이 선 주자만 센다
   */
  arrivedThisListTick: boolean
}

/**
 * **한 플레이가 도는 동안 바뀌는 것 전부** — 지금까지 `runDefensePlay` 루프 안의 `let` 변수였던 것들이다.
 *
 * 앞쪽(`input`~`specialDefense`)은 시작할 때 한 번 정해지고 끝까지 안 바뀌는 것,
 * 뒤쪽은 틱마다 바뀌는 것이다.
 *
 * ⚠️ **제자리에서 고친다**: `stepDefensePlay` 는 이 객체를 **그대로 고쳐 같은 객체를 돌려준다**.
 * 주자(`runners`)·기록(`ticks`·`log`)·동작 기억(`previousActions`)은 원래부터 제자리에서 바뀌던 것이라
 * 겉만 불변으로 꾸며 봐야 거짓말이 된다. **지난 상태를 들고 있지 말고 늘 돌려받은 것을 써라.**
 */
export interface DefensePlayState {
  // ── 시작할 때 정해지는 것 ──
  readonly input: DefensePlayInput
  trajectory: BattedBallTrajectory
  readonly abilities: readonly (number | null)[]
  readonly maximumTicks: number
  /** 아무도 잡지 못하는 타구인가 (필살타법 0x51800) */
  uncatchable: boolean
  /** 뜬 채로 잡히는 타구인가 */
  onTheFly: boolean
  /** 공을 쫓는 야수 칸 */
  chaserSlot: number
  /** 포구 지점 — 펌블로 포구 틱이 밀려도 **자리는 그대로다** (원본 그대로) */
  catchPoint: WorldPoint
  /** 루 커버 배정 (0xd85a8 + 0xb1e24) */
  readonly covers: readonly number[]
  readonly defenseIsCpu: boolean
  /** 필살수비 창 — 시작할 때 한 번만 굴린다 (0x66b30 / 0x66be4) */
  readonly specialDefense: { readonly jumpUnlocked: boolean; readonly slideUnlocked: boolean }
  /** 주자들 — **제자리에서 바뀐다** */
  readonly runners: readonly MutableRunner[]
  /** 매 틱 화면 스냅샷 — **제자리에서 쌓인다** */
  readonly ticks: DefensePlayView[]
  /** 진행 기록 — **제자리에서 쌓인다** */
  readonly log: string[]
  /** `actionTick` 을 세는 동작 기억 — **제자리에서 바뀐다** */
  readonly previousActions: ActionMemory

  // ── 틱마다 바뀌는 것 ──
  /** 다음에 돌릴 틱 번호 */
  tick: number
  fielders: readonly FielderState[]
  play: PlayView
  /** 2아웃 보류 득점 state[0] */
  held: HeldRunState
  outs: number
  outsAdded: number
  /** 지금(마지막) 송구의 목표 루 · 도착 틱 · 던진 야수 — 송구가 없었으면 −1 */
  throwBase: number
  throwArrivalTick: number
  throwFromSlot: number
  /** 공이 손을 떠난 틱 — 포구 틱에 던졌으면 포구 틱, 키·아웃 뒤에 던졌으면 그 틱. 송구가 없으면 −1 */
  throwReleaseTick: number
  /** 이 판에서 나간 송구 수 — 받은 야수가 이어 던지면 2 이상이 된다 */
  throwCount: number
  /** 첫 송구의 목표 루 · 도착 틱 — 결과(`DefensePlayResult.throwBase`)로 내보낸다 */
  firstThrowBase: number
  firstThrowArrivalTick: number
  /** 결과 코드 9 의 메시지 0xbba 가 마지막으로 간 판 틱 (`DefensePlayResult.safeCallTick`). 없으면 −1 */
  safeCallTick: number
  /** state[0x1f] — 쥐기 0xb2710 의 아웃 판정이 타자주자를 뜬공 아웃(결과 1)으로 죽였다 */
  flyOut: boolean
  /** 판 끝 정산 0xa8024 가 세는 사건 — 6(안타 · 결과 코드 6·10) · 8(홈런 · 8·12)이 났나, 0xd(아웃 · 결과 코드 13) 몇 번 */
  hitEvent: boolean
  homeRunEvent: boolean
  outEvents: number
  /** state[0x25] — 타자주자가 판 안에서 홈을 밟았고 그때 홈런 사건(8 · 12)이 없었다 (0xaa1e2, `DefensePlayResult.groundHomeRun`) */
  groundHomeRun: boolean
  /** 포구 틱 — 펌블이 나면 15틱 뒤로 밀린다 */
  catchTick: number
  fumbled: boolean
  errantThrow: boolean
  /**
   * **경기+0x24** (전역 경기 구조체 `[0x1552d0c]` 의 바이트 한 칸) — "주자가 뛰는 중" 표시다.
   *
   * ⚠️ **자동 주루 스위치가 아니다.** `.text` 를 전부 훑어(오프셋 0x24 바이트 접근 24곳) 확인한
   * 쓰는 곳·읽는 곳 전부:
   *   - 쓰기 `0x3d960`(상태 0xf 진입 = 매 투구 시작) = 0, 같이 경기[0x14+i]·경기[0x90+i] 도 0
   *   - 쓰기 `0x4648a`(상태 0x17 진입 0x46418) = 설정+0xbd
   *   - 쓰기 `0x520b6`(진루 키 0x582) = 0 · `0x52240`(귀루 키 0x584) = 0 · `0x521dc`(도루) = 0
   *   - 쓰기 `0xa9b86`·`0xa9ba8`(0xa9b04 가 주자를 실제로 움직인 순간) = **1** · `0xa9c40`(0xa9bd4) = 1
   *   - **읽기는 딱 둘** — `0x3e0e6` 과 `0x521fa`. 그게 전부다.
   * `0x3e0e6` 은 상태 0x12 진입(공 도착·스윙 판정) 안이고, 하는 일은
   * "경기+0x24 ≠ 0 이고 (아웃 ≤ 1 또는 판정 ≠ 5) 이면 **플레이 종류 5(주자 움직임만) + 상태 0x17**",
   * 곧 **투구가 끝난 뒤 수비 화면을 열지 말지**를 가른다(S8 5-3 의 state[0x24] "도루 중"과 같은 칸).
   * `0x521fa` 는 도루 메시지 처리에서 경기[0x14+루]·경기[0x90+루] 를 세울지 가른다.
   * → **자동 진루 0xaf918 을 막는 곳은 한 군데도 없다.** 그 갈림은 `input.runningMode` 주석의
   *   `0xae690` 이다. 여기서는 원본이 세우고 지우는 칸을 그대로 들고만 있는다(읽는 쪽이 아직 없다 —
   *   웹판에는 "종류 5 로 수비 화면 열기" 가 없다).
   */
  autoBaserunning: boolean
  /** 주자관리+0x31c — 이번 플레이에서 이미 슬라이딩 효과음을 냈다 */
  slidingSoundPlayed: boolean
  /**
   * **방금 돈 틱에서 슬라이딩 효과음 10 을 낸다.** 진행기는 순수 함수라 소리를 못 내므로
   * 틱을 실제로 돌리는 수비 재생(`DefensePlayback`)이 이 칸을 보고 그 틱에 낸다.
   * 사람 키 0x5199c(+0x31c 잠금으로 한 플레이 한 번) · 자동 0x5268c(잠금 없음, 슬라이딩시킨 수 > 0) 둘 다 여기로 온다.
   */
  slidingSoundThisTick: boolean
  /**
   * **방금 돈 틱에서 필살타법 타구에 맞은 야수의 효과음 53 을 낸다.** 틱 끝 b4588 플레이.vt74 = 0xb3420 → 야수.vte4 = 0xa1e60 이
   * 자세 13 · +0xb4 = 15 뒤 a1e82 에서 **즉시 재생** 0x6ea6c(소리, 0x35, −1, 0) 한다(예약이 아니다). 진행기는 소리를 못 내므로
   * 수비 재생(`DefensePlayback`)이 이 칸을 보고 그 틱에 낸다.
   */
  hitStaggerSoundThisTick: boolean
  /**
   * 이번 틱의 메시지 0x13(주자 하나 홈인 — 점수판에 1점) 인자 차례 — 바로 득점 0xaa1b0 은 그 주자 칸(0 = 타자주자),
   * 보류 해제 0xaa39e 는 0x64(100). 수비 장면 득점 점수판(0x51fb8 → 0x52030 홈런 갈래 · 0x52074 보통 갈래)이 본다
   */
  runInsThisTick: readonly number[]
  /**
   * **방금 돈 틱의 소리 차례** — 진행기는 소리를 못 내므로 틱을 돌리는 수비 재생(`DefensePlayback`)이 이 차례대로 낸다.
   * 한 그림의 원본 차례(직접 뜸):
   * 1. 키 처리 0x498d4(52d9e) — OK 슬라이딩 0x585 → 0x518da → 0x5199c 의 10 (`sound`)
   * 2. 그림 머리 0x3f060(52e16) 카메라 3f17e — 메시지 0x13(타자주자) → 0x51fb8 함성 (`runIn`)
   * 3. 슬롯 2 플레이 틱 vt48(525e8) 꼬리 — b4562 결과 메시지 0xbba → 0x51a56 판정 콜(`judgeCall`, `sound`) → b4588 vt74 → 0xa1e60 의 53
   * 4. 슬롯 2 주자관리 vt18 0xaa0a8(525fc) — 바로 득점 aa1b0 · 보류 해제 aa39e 의 메시지 0x13 → 0x51fb8 함성 (`runIn`)
   * 5. 슬롯 2 자동 슬라이딩 0x52670 → 0x5268c 의 10 (`sound`)
   * 6. 건너뛰는 동안 52b26 의 0x3f060 카메라 3f17e (`runIn`) — 그 뒤 슬롯 2 꼬리 52b62 의 깊은 낙구 함성 60 (`deepLanding`)
   * 0xbfbac 는 큐가 아니라 받는 곳 vt+0xc 를 곧바로 부르므로(0xbfb78 bfb9a — 경기 장면 vtable 0xcfa30 +0xc = 0x509a0) 메시지 0x13 · 0xbba 의
   * 소리는 보낸 그 자리에서 난다. 펌블 함성 29 는 그리기 G3(0x4381a) 몫이라 여기 없다 — 화면이 그린 틱마다 낸다.
   */
  tickSounds: readonly DefenseTickSound[]
  /** 경기+0x19ad(반짝임) */
  laserShining: boolean
  /** **그림 전용** 야수 +0xb8(펌블 표시, 칸별) — 펌블 b4280 이 6, 야수 틱 a12da 가 잠금 없을 때 −1 */
  fumbleMarks: number[]
  /** **그림 전용** 야수 +0xc0(송구 실수 표시, 칸별) — 악송구 a1908 · 원바운드 a17fc · 예보 두 번째 패스 b188e 가 4, a12e6 이 −1 */
  throwErrorMarks: number[]
  /** 경기+0x19ae(레이저 확정) */
  laserConfirmed: boolean
  /** 경기+0x19af — 한 플레이에 한 번만 굴린다 */
  laserRolled: boolean
  /** 플레이+0x1f4(레이저 송구가 나갔다) */
  laserThrow: boolean
  /**
   * 플레이+0x1f4 — 레이저 발사 0x400bc 가 vt64(1) 로 세운 칸. 서 있으면 다음 송구 0xb2e38 이 b2f06 에서 레이저(vtb0 0xa222c)로
   * 던지고 vt64(0) 으로 내린다(내야 → 내야 송구 b2ee6 도 내린다).
   */
  laserArmed: boolean
  /**
   * **그림 전용** 장면 +0x1991 — 레이저 발사 0x400bc 가 세우고, 슬롯 2 의 5254c 가 포구 관문 0xb4c9d(동작 시작 틱 − 1 == 공 틱)에서
   * 내린다(그 그림의 필살 포구 켜기도 건너뛴다). 서 있으면 공 그리기 0x37076 이 잔상을 그린다
   */
  laserTrailOn: boolean
  /** **그림 전용** 지금 공 궤적의 t = 0 점(0xa25b1(공, 0)) — 판 시작 · 다시 쏘기 · 송구가 새 궤적을 깔 때마다 바뀐다 */
  ballSegmentStart: WorldPoint
  /** 장면 +0x1993 — 경기 멈춤. 0x400bc 가 세우고 연출 0x4403c 단계 1 · 0x441c4 · 0x44398 끝(그리기)이 내린다 */
  gamePaused: boolean
  /**
   * 수비 장면 연출 칸 (`defenseScene`) — 결과 판 0x46844 · 연출 단계 +0x1992(−1 일 때만 슬롯 2 머리 524c4 가 0x523bc · 0x4e858 ·
   * 0x400bc 를 돈다) · 레이저 0x4403c · 필살 포구 B 0x441c4 · C 0x44398 · 줌 펀치
   */
  scene: DefenseScene
  /** 플레이+0x1f7 — 필살 점프 캐치 동작이 걸렸다(0xd87f4 종류 3, b4178). 예보 vt34(0xb3b38) · B 끝이 내린다 */
  deadlyJumpArmed: boolean
  /** 플레이+0x1f8 — 필살 슬라이딩 캐치 동작이 걸렸다(종류 4, b4198). C · B 끝이 내린다 */
  deadlySlideArmed: boolean
  /** state[0x8b] — 결과 판이 큰 OUT 을 그리며 +0x1999 를 보고 세운다 (46932) */
  laserOutFlag: boolean
  /** 앞 틱 끝 G2 앞의 +0x120 (`PlayGateFrameResult.counterBeforeHead`) — 이 틱 머리에서 멈추면 G2 를 안 부른 것으로 되돌린다 */
  counterBeforeHead: number
  /** 협살 기록칸 P+0x1ec~+0x1f3 (0xb3a04). 대상이 −1 이면 협살 중이 아니다 */
  rundown: RundownPlan
  rundowns: number
  rundownOuts: number
  /** 원본 `state[0x87]` — 마지막 아웃 판정이 태그였나 (`runOutJudgement` 주석) */
  tagOut: boolean
  /** 플레이+0x126 — 판 시작 vt20(b11fe)이 1, 키스톤 야수가 중계 자리를 잡으면(b22f6) 0 */
  relayFlag: boolean
  /** 송구 계획 [4](+0x150) — 지금 계획이 중계([0] = 1)면 최종 받는 야수, 아니면 −1. 중계맨이 쥐면 b4616 이 그에게 던진다 */
  relayFinalSlot: number
  /** 그 중계의 목표 루 [7](+0x153) */
  relayBase: number
  /** +0x15c — 0xb2e38 이 송구를 미룰 때(AI 9) 적은 받을 야수 */
  deferredThrowReceiver: number
  /** +0x158 — 미룬 송구의 목표 루 */
  deferredThrowBase: number
  /** 플레이 +0x120 — 판 진행 관문 0xb0d28 의 판 끝 세기 (`passPlayGate`) — 한 그림에 서너 번 오른다(`passPlayGateBetweenTicks`) */
  endCounter: number
  /** 판을 닫은 관문 다음 그림의 G1(3f0b8)이 열렸나 — 그 목록 틱 a1330 이 +0xcc 를 하나 더 줄인다(`fielderSlackAtPlayEnd`, r196) */
  closingListTickOpen: boolean
  /**
   * 플레이 +0x13c[칸] — 마지막 예보 0xb12d0 이 아홉 칸에 같게 적은 움직임 허용(`CatchForecast.movable`, r196). 판 시작 예보는
   * vt24(1)이라 참이고, 송구 예보 vt24(0)(b307c)는 악송구 · 원바운드(공+0xaac)거나 두 번째 패스로 갈 때만 참이다
   */
  forecastMovable: boolean
  /**
   * 이 틱 그림의 그리기 쪽 관문(0x46e3c, G3) — HOMERUN 글자가 이것을 본다. 판 시작 전 · 건너뛰기(+0xfe7) 중엔 null.
   * 틱 끝 G2 와 다를 수 있다 — +0x120 세기로 닫히는 판은 G3 이 열리고 그 뒤 G1 · G2 에서 닫힐 수 있다.
   */
  drawGateOpen: boolean | null
  /**
   * 장면 +0xfe7 — 0x17 키 건너뛰기(0x519cc). 서면 판 끝까지(닫힌 뒤 +0x1094 11 번까지) 한 그림 안에서 돈다(52b26~52b40) —
   * 틱 사이 관문이 G1 · G2 둘뿐이다(`passPlayGateBetweenTicks`). 판 시작 0 · 0x35108 이 끝에서 0 으로 둔다.
   */
  fastForward: boolean
  /** state[0xb] — 사건 코드 처리 0xb2bc4 가 마지막으로 받은 결과 코드 */
  lastEventCode: number
  /** 플레이 +0x112 — 공을 쥐었거나 공이 땅에 닿았거나 담장선을 넘었다 (6d 절) */
  ballContacted: boolean
  /** 플레이 +0x110 — 사건 코드 7(파울) */
  foulFlag: boolean
  /** state[0x1c] — 쏜 공의 파울 각 (511b8 0x9d660(a) 의 반대). 표시 패턴으로 바꿔 쏘면 바꾼 각이다 */
  foulAngle: boolean
  /**
   * state[7] — 넓은 페어 각(0x9d640). 0 이면 커버 0xb1c90 이 머리(b1cc6)에서 끝난다(`coverTick` 머리말).
   * 타구 0x511ae = 1 · state[0x19] == 0 이면 0x511ce = 0x9d640(쏜 a) · 사건 7 b2c06 = 0x9d640(공+0x70) · 아웃 꼬리 b3716 = 1
   */
  wideFair: boolean
  /** 플레이 +0x111 — 사건 코드 8(홈런). `PlayView.finished` 는 이 진행기의 판 끝 표시라 따로 든다 */
  homeRunFlag: boolean
  /** 플레이 +0x124 — 사건 코드 10(바운드로 담장을 넘은 2루타) */
  groundRuleFlag: boolean
  /**
   * **플레이 +0x127** — 타구 시작 0x51408 이 패턴 플래그 비트 1(0xb07c8)이면 세우고(0x514e6), 쥐기 0xb2710 이 지운다.
   * 서 있으면 예보 0xb12d0 의 복제(b1416)와 추적야수 AI 1(0xb4afe)이 낙구 틱까지 **낙구 지점**으로 달린다.
   */
  landingChase: boolean
  /**
   * 지금 공의 공+0xaa0 을 판 틱으로 옮긴 값 — AI 1(0xb4afe)이 `aa0 ≥ 공+0x68` 로 본다. 다시 쏘면(0xb3148) 공 칸이 새로
   * 깔리므로 새 궤적의 낙구 틱이다(`trajectory.landingTick` 은 state[0x1e] 처럼 처음 낙구를 지킨다).
   */
  ballLandingTick: number
  /**
   * 지금 공을 깐 판 틱 — 공+0x68(재생 틱)이 0 인 그림. 판 시작 vt18(b27ec → vt24(1) 0xb12d0 의 b12da)이 0 으로 두므로 처음은 0,
   * 송구 0xb2e38(b307c) · 다시 쏘기 0xb3148(b3294)이 그 틱으로 옮긴다(`takeLooseBall`). 그림의 공+0x68 = 판 틱 − 이 값 —
   * 0x3f378(3f3c6)이 그리기 뒤에만 +1 하므로 깐 그림은 0 이고 0x36dfc 36e24 가 공을 안 그린다(`DefenseBall.isPlaybackStart`).
   * 쥔 동안은 +1 이 멈추지만(3f3b2 +0x12c) 쥔 공은 어차피 안 그리고, 놓는 길은 모두 0 으로 다시 둔다.
   */
  ballLaunchTick: number
  /**
   * 플레이 +0x178[칸] — 지금 공의 예보가 적은 다이빙 후보 틱(공 틱, 없으면 1000 — `catchForecast.diveTicks`, r180). 송구 · 다시 쏘기의
   * 예보(`takeLooseBall`)가 새로 채운다 — 첫 점이 표준 배팅 지점이 아니라 모두 1000 이 된다.
   */
  diveTicks: readonly number[]
  /** 플레이 +0x174 — 고르기 0xb3b38 이 적은 포구 틱(공 틱, 웹 판 틱 끝으로 자르기 전 값). AI 고리 b470a 가 `ldrsh` 로 읽는다 */
  diveCatchTick: number
  /**
   * 지금 쫓는 공이 **받을 야수에게 던진 송구공**(공+0xaac == 0 — 보통 · 흔들린 · 레이저 송구)인가. 받는 것도 포구 틱 갈래(1 절)다.
   */
  receivingThrow: boolean
  /**
   * 야수 +0x3b(칸 = 야수 칸) — 마지막 목록 틱(6 절 이동)에서 목표점에 막 닿았다. 결과 코드 9(b4412, 6c 절)가 본다.
   * 이동 0xbf0dc 가 머리에서 지우고 닿은 갱신에서만 세우므로 목록 틱이 안 돈 그림(경기 멈춤)에는 앞 값이 남는다
   */
  fielderArrivals: readonly boolean[]
}
