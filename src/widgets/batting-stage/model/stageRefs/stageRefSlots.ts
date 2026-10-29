import type { PatternDeck } from '@/entities/batting/model/battedBallOutcome'
import type { ParticleScene } from '@/entities/particle/model/particleScene'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { SceneKeyLatch } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import type { ShownSceneTicks } from '@/shared/lib/sceneKeyLatch/shownSceneTicks'
import type { PendingHit } from '@/widgets/batting-stage/model/stageRefs/pendingHit'
import type { StageLatest } from '@/widgets/batting-stage/model/stageRefs/stageLatest'
import type { BuntStance, StagePhase, SwingReservation } from '@/widgets/batting-stage/model/stageRefs/stagePhase'
import type { MutableRefObject, RefObject } from 'react'

export interface StageRefs {
  readonly canvasRef: RefObject<HTMLCanvasElement | null>
  readonly pitchRef: MutableRefObject<Pitch | null>
  /** 지금 날아가는 공의 구질 번호 1~22 (`game+0xfc8`) — `pitchRef` 와 함께 세운다. 판정 detail 에 실어 보낸다 */
  readonly pitchTypeNumberRef: MutableRefObject<number | null>
  readonly phaseRef: MutableRefObject<StagePhase>
  /**
   * 지금 단계가 선 **경기 장면 틱**(`gameSceneTickOf`) — 단계 안 틱은 (지금 장면 틱 − 이 값)이다. 원본 상태 틱 [장면+0x2c] 를
   * 0 으로 적는 틀(0xbc9c8 bc9ec)과 같은 틀이다(`commonWindow` 의 `gameSceneTickOf` 머리말)
   */
  readonly phaseStartTickRef: MutableRefObject<number>
  /**
   * **예약한 다음 단계** — 갱신이 0xbcb48 로 예약한 상태는 그 틀이 아니라 다음 틀 머리 0xbc9c8 에서 틱 0 으로 선다(bc9e8~bc9f4).
   * 판정 0x6aa → 0x13 · 공 끝 0x4e24e(4e26c `movs r1, #0x12` → 0xbcb49) · 0x13 끝 40786(→ 0xbcb49) 이 이 길이다 — 고리가 예약한 틀은
   * 아직 0x11 · 0x13 으로 그리고, 루프가 `tick` 에 닿은 틀 머리에서 단계를 세운다. 없으면 null
   */
  readonly phaseEntryRef: MutableRefObject<{ readonly phase: StagePhase; readonly tick: number } | null>
  /** 0x13 건너뛰기 키(OK · '5')를 읽는 갱신 틱 — 키는 다음 틀의 0x13 갱신 0x406e8(40708)이 [장면+0x40] 으로 읽는다. 없으면 null */
  readonly hitSkipKeyTickRef: MutableRefObject<number | null>
  readonly resultTextRef: MutableRefObject<string>
  /**
   * 홈런 글자 연출(원본 켜짐 칸 +0x1960)이 켜진 장면 틱. null 이면 꺼짐.
   * 원본은 홈런 판정 가지에서 켜고 다음 플레이가 지울 때까지 돌리므로,
   * 웹도 결과 문구 시간과 따로 두고 **다음 투구가 시작할 때** 끈다.
   */
  readonly homeRunStartTickRef: MutableRefObject<number | null>
  /** 스윙이 나간 장면 틱(F + 1, 0xb9374). null 이면 대기 자세 */
  readonly swingStartTickRef: MutableRefObject<number | null>
  /**
   * 투수 그림 객체가 상태 1 에 든 장면 틱 — 0x11 진입 0x3de10 이 걸고 다음 0xf 진입(0x3d954 → 0x340c0)이 상태 0 으로 되돌린다.
   * null 이면 상태 0(선 자세). 공이 끝난 0x12 · 0x13 동안에도 남아 투수가 마지막 단계 자세에 머문다
   */
  readonly pitcherStartTickRef: MutableRefObject<number | null>
  readonly shiftRef: MutableRefObject<number>
  readonly buntRef: MutableRefObject<BuntStance | null>
  readonly deckRef: MutableRefObject<PatternDeck | null>
  /** 상태 0x13 이 붙잡고 있는 타격 결과. 없으면 이 단계가 아니다 */
  readonly pendingHitRef: MutableRefObject<PendingHit | null>
  /** 이 공의 스윙 예약 · 스윙 (`SwingReservation`). 없으면 null — 새 공(0x11 진입의 memset)마다 지운다 */
  readonly swingRef: MutableRefObject<SwingReservation | null>
  /** 이 공이 판정됐나 — 경기+0xfe5 (0x4e18a · 0x4e216) */
  readonly pitchJudgedRef: MutableRefObject<boolean>
  /** 판정은 났지만 공 끝(0x12)까지 기다리는 결과(헛스윙 · 번트 헛맞음) — 공 끝에서 부른다 */
  readonly heldResultRef: MutableRefObject<((tick: number) => void) | null>
  /** '결과' 단계(0x12)가 서 있을 그림 수 — 결과를 세울 때 정한다 (`resultPhaseTicksOf`) */
  readonly resultTicksRef: MutableRefObject<number>
  /** 지금 '결과' 가 맞은 공 뒤 인플레이(0x17) 자리인가 — 아니면 상태 0x12 (`StagePhaseSnapshot.isInPlay`) */
  readonly isInPlayResultRef: MutableRefObject<boolean>
  /** 지금 '결과'(0x12)가 사구(st[0x12])인가 — 0x49e64 4a0ce 가 0x12 틱 0~7 에 사구 표시를 그린다 (`batterOverlayMarks`) */
  readonly isHitByPitchResultRef: MutableRefObject<boolean>
  /** 살아 있는 파티클 이미터 목록 — 앱 전역 관리자 [0x1400068] 하나(`widgets/particles` 의 `sceneParticleScene`) */
  readonly particlesRef: MutableRefObject<ParticleScene>
  /**
   * 맞은 공이 0x13 을 끝내고 0x17(인플레이)로 넘어간 장면 틱(`commitHit`) — 0x17 진입 0x46418 의 4673e 가 파티클 관리자를 갈래 없이
   * 비운다(0x6dee4). 그 틱 뒤 첫 틱에서 지우고 null 로 되돌린다
   */
  readonly inPlayEnteredTickRef: MutableRefObject<number | null>
  readonly pointerDownAtRef: MutableRefObject<number>
  /**
   * 받은 키 칸 — 키 사건 0xbca05 (`sceneKeyLatch`). 키(누름 · 뗌 · 누름 칸)는 받은 장면 틱과 함께 여기 들고, 루프가 다음 틀의 진입 뒤 ·
   * 갱신 앞(52d9e 키 0x498d4 자리)에서 꺼내 처리한다. 화면이 받은 도루 키도 이 칸에 든다(`pushSceneKey`)
   */
  readonly keyLatch: SceneKeyLatch
  /**
   * 루프가 그린 그림의 (시각, 장면 틱) 기록 — 키는 사건이 난 시각에 화면에 있던 그림의 틱으로 받는다(`keyLatch` 의 `tickAt`).
   * 원본은 키를 받은 틀이 마지막으로 그린 틀이다 — 웹은 그리기가 밀려도 사람이 본 그림으로 센다 (r211)
   */
  readonly shownTicks: ShownSceneTicks
  readonly latestRef: MutableRefObject<StageLatest>
}
