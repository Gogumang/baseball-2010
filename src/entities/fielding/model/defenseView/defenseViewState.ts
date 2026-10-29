/**
 * 수비 화면 한 틱치 스냅샷의 모양 (R3-field-view 2·7절 · R2-game-effects 2절).
 * 만드는 쪽은 진행기(`features/defense-play/model/defensePlayView`), 그리는 쪽은 `pages/defense` 다 — 둘 다 이 모양을 본다.
 */

import type { DefenseFielder, DefenseRunner } from '@/entities/fielding/model/defenseView/defenseFigures'
import type { HolderMark, HolderPlate } from '@/entities/fielding/model/defenseView/holderMark'

/** 월드 한 점 — x+ 는 1루 쪽(오른쪽), z+ 는 홈 쪽(아래) (R3 2-1). 화면 카메라의 `WorldPoint` 와 같은 모양 */
interface GroundPoint {
  readonly x: number
  readonly z: number
}

/** 공 (카메라 대상은 (x, z − 높이) 다 — R3 1-3) */
export interface DefenseBall extends GroundPoint {
  /** 월드 단위 높이 */
  readonly height: number
  /**
   * 진행기가 보는 "아직 날아가는 중(포구 · 송구 도착 전)" 표시. **카메라는 이것을 안 본다** — 0x3f060 은 공.vt18(멈춤)과
   * 홈런 칸만 본다(`cameraTargetOf`). 옛 화면이 "날지 않으면 타자주자" 로 읽던 칸이다.
   */
  readonly isFlying: boolean
  /**
   * 공.vt18 = 0xa27f0 — **멈췄는가**(지금 점의 속도 · 수직 속도 워드가 0, 목표가 있으면 목표점에 닿음 — I-controls 2b).
   * 야수가 쥔 공도 손에 붙어 안 움직여 멈춘 것으로 본다(관문 파울 갈래와 같은 읽기 — 유력). 안 주면 거짓.
   */
  readonly isStopped?: boolean
  /** 플레이 +0x12c — 야수가 쥐고 있다. 공 그리기 0x36dfc 가 공 · 그림자를 안 그린다(36e90). 안 주면 거짓 */
  readonly isHeld?: boolean
  /**
   * 담장을 넘어 사라졌다 — 공+0x68(재생 틱)이 낙구 aa0 + 2 와 담장선 aa4 + 6 을 **둘 다** 넘었고, 담장선이 있거나(aa4 > 0, 36e5c)
   * 홈런(+0x111, 36e32)이다. 0x36dfc 가 공 · 그림자를 안 그린다(36e9e). 안 주면 거짓
   */
  readonly isBeyondFence?: boolean
  /**
   * 공+0x68(재생 틱) ≤ 0 — 공을 막 깐 그림이다. 0x36dfc 머리 36e24 `공+0x68 > 0` 이 거짓이면 3738c 로 곧장 빠져 공 · 그림자(37268) ·
   * 두 번째 비거리 판(37388 0x36cd4)을 모두 안 그린다. 공+0x68 은 판 시작 vt18(b27ec — 종류 1 · 9 는 vt24(1) 0xb12d0 의 b12da,
   * 2 · 3 · 4 · 5 는 0xa276d) · 송구 0xb2e38(b307c vt24(0)) · 다시 쏘기 0xb3148(b3294 vt24(1))이 0 으로 두고, 그 그림 그리기 **뒤**
   * 0x3f378(3f3c6 — 안 쥐었고 G4 가 열렸을 때)만 0xa2594 로 +1 한다. 곧 공을 깐 그 그림만 0 이다. 안 주면 거짓
   */
  readonly isPlaybackStart?: boolean
}

/**
 * 필살 포구 번쩍임 (R2 2절 — `features/defense-play/model/defenseScene`).
 * A(0x4403c)는 줌 펀치만 하고 **그리지 않으므로** 여기 종류에 없다.
 */
export interface DefenseFlash {
  /** 'b' = 0x441c4 (플레이 +0x1f7 필살 점프 캐치) · 'c' = 0x44398 (플레이 +0x1f8 필살 슬라이딩 캐치) */
  readonly kind: 'b' | 'c'
  /** deadly_effect 애니 0 의 칸 0~3 */
  readonly step: number
  /** +0x1996 = 공 가진 야수 +0xa8 동작 0xf 아래 · 0x10 위 · 0x11 왼 · 0x12 오른 — kind 'c' 에서만 쓴다 */
  readonly direction?: number
  /**
   * 그리는 점 — 공 가진 야수(0xb0c91 = 플레이+0x130)의 +0x20 월드 (x, z − y). 없으면 공 화면점에 그린다(옛 스냅샷).
   */
  readonly x?: number
  readonly z?: number
}

/**
 * 공 그리기 0x36dfc 의 파티클 두 갈래 중 **진행기 쪽 조건** (직접 뜬 것 — 화면 쪽 조건 · 좌표는 `lib/ballParticles`):
 * ```
 * 36e24  공+0x68(공 틱) > 0 이 아니면 끝                    ; 그 앞 36e0a · 36e12 는 공 그림판이 있나
 * 36e86  쥔 공 · 담장 뒤로 사라진 공이면 그림 없음(→ 3736c)
 * 36f76  경기+0x199a && state[0x26](판 종류) ∈ {1, 8} → 0xbbc85(…, 4, 10)            ; 큰 타구
 * 36fe0  … 높이 투영 == 0 이면: 공+0x6c − 1 > 공+0x68 && !0x357e0 && +0xfd4 ∉ {9,10,11}
 *          && 0xa25fd(공 틱 + 1 점)의 높이 투영 ≠ 0 → 공+0xab4 = 1 · 0xbbc85(…, 0, 8)   ; 튐
 * ```
 */
export interface BallParticleFacts {
  /** 큰 타구 갈래 0x36f76~0x36f92 — 경기+0x199a(0x392ac) && 판 종류 ∈ {1, 8} */
  readonly bigHit: boolean
  /**
   * 튐 갈래의 화면 밖 조건(궤적 안 끝남 · 0x357e0 거짓 · 결과 코드 ∉ {9,10,11})이 다 맞으면 **다음 점(공 틱 + 1)의 높이**(월드 y),
   * 아니면 null. 높이 투영(0xb94b5 의 둘째 값)은 화면 쪽이 한다.
   */
  readonly bounceNextHeight: number | null
}

/** 화면 한 틱치 스냅샷 */
export interface DefenseViewState {
  readonly ball: DefenseBall
  readonly fielders: readonly DefenseFielder[]
  readonly runners: readonly DefenseRunner[]
  /** 번쩍임이 돌고 있으면 그 상태, 아니면 null */
  readonly flash?: DefenseFlash | null
  /**
   * 레이저 송구 반짝임(경기+0x19ad)을 띄울 **야수 칸**. 아무도 안 반짝이면 null 이다.
   *
   * 원본 0x43278 은 야수 9명을 도는 그 자리(0x43406~0x4342c)에서 세 조건을 모두 볼 때만
   * 이 야수를 효과 12 + 빨강으로 그린다 (I-controls 1c 끝 · R2 2절):
   *   1. 이 야수가 **공을 쥔 야수**(플레이+0x130) 이고,
   *   2. 경기+0x19ad(반짝임)가 켜져 있고,
   *   3. deadly_effect A(+0x1990)가 **안 돌고 있다**.
   * 셋을 보는 쪽은 진행기다 — 화면은 "몇 번 칸" 한 칸만 받아서 그린다.
   *
   * ⚠️ **번쩍임(`flash`)과 헷갈리지 마라.** 저쪽은 `deadly_effect.pzx` 를 공 자리에 겹치는
   * 필살 포구 연출이고, 이쪽은 야수 몸 색이다. 원본에서도 함수가 다르다(0x441c4/0x44398 대 0x43278).
   */
  readonly laserShiningSlot?: number | null
  /**
   * 레이저 연출 단계 1 의 **줌 펀치**(0xbb84c → 0xbb43c) — 이 그림을 그린 뒤 화면을 늘리는 배율(110 · 110 · 105 · 100%)과 중심(바탕 그림 좌표).
   * 늘리는 것은 결과 판까지다(`features/defense-play/model/laserPresentation`). 없으면 그대로.
   */
  readonly zoom?: { readonly percent: number; readonly centerX: number; readonly centerY: number } | null
  /**
   * 결과 판 0x46844 의 **큰 OUT** — game_judge 애니 2 의 이 그림 프레임과, 자리를 정하는 공 가진 야수 칸(−1 이면 화면 가운데).
   * 야수 그림 자리에서 y − 60 에 그린다.
   */
  readonly bigOut?: { readonly frame: number; readonly holderSlot: number } | null
  /**
   * 결과 판 0x46844 의 **보통 판정 글자** — 0x393b4(x, y − 30, v, 1, 0) 가 그리기 목록에 넣고 0x46844 꼬리가 그린 game_judge
   * 애니 칸(SAFE · OUT · FOUL · GROUND RULE DOUBLE …)과 dx · dy, 자리를 정하는 공 가진 야수 칸(−1 이면 화면 가운데).
   */
  readonly judgeText?: { readonly frame: number; readonly dx: number; readonly dy: number; readonly holderSlot: number } | null
  /**
   * **공 가진 야수 고리** — 0x43cb0(그리기 0x46c88 의 0x46cbc, 비거리 판 뒤 · 야수 목록 앞에 곧바로 그린다).
   * 경기+0x19ac(쥐기 0xb2710 의 메시지 0x15 가 1 로 세우고 0x17 진입 0x467de 가 0 으로 내린다)가 서 있고
   * 공 가진 야수(플레이+0x130, 0xb0c91)가 있을 때만 뜬다. 고르는 쪽은 진행기다(`holderMarkOf`).
   */
  readonly holderMark?: HolderMark | null
  /**
   * 고리와 같이 그리는 **오른쪽 아래 이름 판** — 공 가진 야수의 선수 이름과 수비 칸 표시(0x43e3e~0x43fc2).
   * 고리가 없으면 판도 없다. 판을 그릴지(칸 아이콘 > 0)는 화면 쪽이 표(0x54590 · 0x545e8)로 정한다.
   */
  readonly holderPlate?: HolderPlate | null
  /**
   * 마선수 주자를 그릴 그림판 — 타석 교대 0x483a0 이 실은 타자 마선수 번호 0~4(`ACE_BATTER_DEFENDER_FRAMES`). 없으면 null.
   * `isAce` 인 주자는 모두 이 그림 하나로 그린다(원본 그대로) · 팔레트 없음 · 프레임은 vt40 날값 그대로.
   */
  readonly runnerAceSprite?: number | null
  /**
   * **레이저 잔상** (공 그리기 0x36dfc 의 0x37076~0x3724a) — 장면 +0x1991 이 서 있으면 지금 공 궤적의 t = 0 점(0xa25b1(공, 0)).
   * 화면이 그 점에서 공까지 공 그림을 반투명으로 늘어놓는다(`laserTrailMarksOf`). 없으면 null
   */
  readonly laserTrailFrom?: { readonly x: number; readonly z: number; readonly height: number } | null
  /**
   * 공 그리기 0x36dfc 가 **파티클을 쏠지** 보는 것 중 화면(카메라) 밖의 조건 — 진행기가 정한다(`lib/ballParticles`).
   * 없으면 아무것도 안 쏜다(재생 · 주자 판).
   */
  readonly ballParticles?: BallParticleFacts | null
  /**
   * 경기 +0xfd4 — **주자 판**(밀어내기 · 견제 · 도루 · 폭투 · 포일)이 열린 때 남아 있던 스윙 판정 결과 코드(`features/defense-play/model/sceneResultCode`).
   * 득점 함성 · 점수판의 홈런성(0x357e0, 24~26)이 본다. null 이면 원본에서 정해지지 않은 값(헛스윙) · 없으면(undefined) 타구 판이다
   */
  readonly sceneResultCode?: number | null
  /**
   * 카메라가 따로 볼 곳. 원본은 상태 0x18(경기 끝 직전)에 투수판 (20000, 24500) 의
   * (x, z − 2000) 을 1%/틱 으로 본다 (R3 1-3). 없으면 아래 규칙대로 공/타자주자를 본다.
   */
  readonly cameraTarget?: GroundPoint | null
  /**
   * 이 그림에서 카메라가 **안 움직인다** — 0x3f060 이 대상 · 따라가기(3f1c0 vt20 · vt28)까지 가지 않는 그림이다(직접 뜸):
   * ```
   * 3f0a4  장면 +0x1993(경기 멈춤 — 레이저 발사 0x400bc 다음 그림) → 돌아감
   * 3f0b8  판 진행 관문 0xb0d28(G1) 이 닫혔으면 r6 = 0 → 3f0ea 에서 돌아감(상태 0x17 은 0x33c98 참)
   * ```
   * 진행기는 멈춘 그림(머리에서 +0x1993)에 싣고, 재생 화면은 판이 닫힌 뒤(마지막 그림 다음 갱신부터) 싣는다. 안 주면 움직인다.
   */
  readonly cameraFrozen?: boolean
  /**
   * **판이 슬롯 2 머리 G2(52502)에서만 닫힌 그림** — 공용 갱신 0x3f060 의 G1(3f0b8)은 열려 목록 틱(야수 · 주자 한 걸음)과 카메라 따라가기는
   * 돌고, 슬롯 2 는 529f0(+0x1094 = 1)으로 빠진 그림이다(`playGate.passPlayGateBetweenTicks` 의 `listTickOpen`). 진행기의 마지막 스냅샷이며,
   * 재생 화면은 이 그림을 판이 닫힌 첫 갱신으로 세고(+0x1094) 카메라를 이 그림까지 움직인 뒤 그 다음부터 세운다. 안 주면 거짓.
   */
  readonly closingListFrame?: boolean
  /**
   * **이 판 틱에 진행기가 낸 소리**(차례대로) — 주자 판(도루 · 폭투 · 견제)의 판정 콜(결과 메시지 0xbba → 0x51a56: 9 → 17 · 13 → 62/20)과
   * 슬라이딩 10. 재생 화면 · 실시간 주자 판 화면 모두 그 틱을 그릴 때 낸다(`DefensePlayback` 의 `playRunnerTickSounds`). 없으면 소리 없음
   */
  readonly tickSoundIds?: readonly number[]
  /**
   * **이 판 틱의 득점 0xaa0a8(슬롯 2 525fc)이 `tickSoundIds` 의 몇 번째 자리에 끼는가** — 그 앞(사람 슬라이딩 키 · 플레이 틱 525e8 의
   * 판정 콜)을 낸 뒤 득점 함성(메시지 0x13 → 0x51fb8)을 내고, 그 뒤(자동 슬라이딩 10, 52670)를 낸다. 소리 통로가 하나라 차례가 곧 들리는
   * 소리다. 없으면 `tickSoundIds` 를 다 낸 뒤 함성이다
   */
  readonly tickRunInSoundAt?: number
  /** 플레이 +0x111 — 사건 코드 8(홈런). 안 주면 거짓 */
  readonly homeRunFlag?: boolean
  /** 플레이 +0x129 — 사건 코드 12(폴 홈런). 안 주면 거짓 */
  readonly poleHomeRunFlag?: boolean
}
