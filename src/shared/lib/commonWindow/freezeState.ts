/**
 * **공용 창 · 경기 장면 멈춤의 앱 전역 칸** — 원본 공용 창 [0x140005c]+9 와 경기 장면 프레임 0x52c50 의 게이트(52cc6 · 52efe · 53048)가 보는 값.
 * 여러 파일(멈춤 · 시계 · 표지)이 함께 읽고 고치므로 객체 하나에 둔다. 칸마다 뜻은 아래 주석 — 옛 `commonWindow.ts` 의 모듈 칸 그대로다.
 */

/**
 * **경기 장면 시계로 재는 setTimeout** — 경기 장면의 상태 길이(상태 틱 [장면+0x2c] 를 세는 갱신 · 진입 · 그 그림의 소리)는
 * 공용 창이 서 있는 동안 52cc6 이 장면 틱 0xbc9c9 · 진입 표 0xd04bc · 갱신 표 0xd0530 을 통째로 건너뛰어 서고, 닫히면 그 자리에서
 * 이어 센다(따라잡지 않는다). 웹 시계도 그동안 남은 시간을 붙잡아 두었다가 닫히면 남은 만큼만 더 기다린다.
 * 장면이 멈춰 있지 않으면 `setTimeout` 과 같고, 멈춘 동안 건 시계는 풀린 때부터 잰다. 경기 장면 밖에서는 늘 그냥 흐른다.
 */
export interface SceneTimer {
  readonly callback: () => void
  /** 아직 남은 장면 시간(ms) — 틱으로 건 시계(`dueTick`)는 쓰지 않는다 */
  remaining: number
  /** 틱으로 건 시계(`setGameSceneTickTimeout`)가 울릴 장면 틱 — 그 틱 머리(앱 틱 격자)에 울린다. ms 시계면 null */
  readonly dueTick: number | null
  /** 지금 도는 실제 시계를 건 실제 시각 — 붙잡혀 있으면 null */
  startedAt: number | null
  handle: ReturnType<typeof setTimeout> | null
}

export interface PendingFreeze {
  readonly appTick: number
  bumpsFirstDraw: boolean
  handle: ReturnType<typeof setTimeout> | null
}

export const freeze = {
  /**
   * **공용 창 [0x140005c] 이 지금 떠 있는가([창+9] ≠ 0)** — 앱 전역 한 칸. `MessageBox`(0x74ef4) · `usePopupWindowMotion`(0x741a0) 창이
   * 서 있는 동안, 그리고 경기 중 메뉴의 [조작방법] · [설정](0x3c212 · 0x3c326 이 같은 일시정지 창을 대기 칸으로 다시 띄워 그 위에
   * 뷰어 · 설정 판을 그린다 — I 4c-3)이 떠 있는 동안 센다.
   *
   * 그리기 루프(requestAnimationFrame)가 React 를 거치지 않고 읽는 값이라 문맥(`CommonWindowOpenContext` — 히든 오픈 알림만)과 따로 둔다.
   * 지금 읽는 곳: 경기 장면 0x52c50 의 파티클 게이트(53048~5304c `ldrb r3, [r6, #9]` · `bne 0x53064` — 떠 있으면 관리자 틱 0x6de85 ·
   * 그리기 0x6dd69 를 **둘 다** 건너뛴다). 다른 장면 프레임(0x32dd8 의 32f48 · 0xe9ac 의 f112 · 0x1cdec 의 1d480 · 0x1eb0c 의 1eb2a)은
   * 이 게이트가 없다 — 창이 떠 있어도 굴리고 그린다(2026-10-16 직접 떴다).
   */
  shownCommonWindows: 0,
  /**
   * **경기 장면이 멈췄는가 — 경기 장면(0x104)이 서 있고 공용 창 [0x140005c]+9 가 서 있다**. 경기 장면 프레임 0x52c50 은 그때
   * (2026-10-16 직접 떴다):
   * ```
   * 52cc6  0x754f9(창, 키) ≠ 0 → 52ef2 로 — 장면 틱 0xbc9c9([장면+0x2c] +1 · 진입 표 0xd04bc) · 키 0x498d4 · 갱신 표 0xd0530 ·
   *        목록 틱 0x3f060 · 0xaada5 · 0xbfc8d 를 모두 건너뛴다
   * 52ef2  창이 서 있으면 0x457cc(자르기를 화면 전체로)
   * 52efe  [창+0x24f](경기 장면 1) && [창+9] && [창+0x250] == 0 이면 53032 로 — 0x41230 · 그리기 표 0xd05a0 을 건너뛴다
   *        ([+0x250] 은 창을 띄운 0x74ef4 · 0x741a0 이 1, 같은 그림 끝 창 그리기 0x746cc 가 0 — 창이 선 첫 그림만 장면을 다시 그린다)
   * 53048  창이 서 있으면 파티클 관리자 틱 0x6de85 · 그리기 0x6dd69 를 건너뛴다
   * 53086  창이 서 있으면 0x3f378 을 건너뛴다
   * ```
   * 곧 창이 떠 있는 동안 장면은 한 틱도 안 흐르고(틱을 모아 두었다 따라잡지도 않는다) 화면은 창이 선 첫 그림 모습으로 굳는다.
   * 다른 장면 프레임(메인 메뉴 0x32dd8 · 시즌 0xe9ac · 나리 0x1cdec · 미션 고르기 0x1eb0c)은 이 게이트가 없다.
   */
  gameScenesUp: 0,
  /** 멈추기 시작한 실제 시각(`performance.now()` 기준) — 흐르는 중이면 null */
  frozenSince: null as number | null,
  /** 지금까지 멈춰 있던 실제 시간의 합 */
  frozenTotal: 0,
  /** 멈추기 시작한 때의 앱 틱 — 흐르는 중이면 null */
  frozenSinceAppTick: null as number | null,
  /**
   * 지금까지 멈춰 있던 **앱 틱** 수의 합 — 경기 장면 틱 = 앱 틱 − 이 값 (`gameSceneTickOf`). 원본은 앱 루프 하나가 틀을 돌리고 경기 장면
   * 0x52c50 은 창이 서 있는 틀(52cc6)에 갱신만 건너뛴다 — 틀 머리는 앱 틀 그대로라 장면 틱도 앱 틱 격자 위에 선다.
   */
  frozenTicks: 0,
  /** `resetCommonWindowShownForTest` 마다 오른다 */
  testGeneration: 0,
  /** 멈추기 시작할 때마다 오른다 — 창이 선 첫 그림([창+0x250])을 부품마다 한 번 세는 데 쓴다(`createGameSceneDrawGate`) */
  freezeSerial: 0,
  /** 서 있는 경기 장면 로딩 판(상태 7 · 9 · 8 — `LoadingTip`) 수 (`useMarksGameSceneLoading`) */
  loadingScenesUp: 0,
  /** 멈추기 시작한 횟수 중 로딩 판(상태 7 · 8 · 9)이 아닐 때 선 것 — 그 첫 그림만 배경 0x41230 을 다시 그린다(52f26~52f36) */
  backdropFreezeSerial: 0,
  /**
   * **갱신 뒤에 연 창 — 다음 앱 틱 머리부터 멈춘다**. 경기 장면 프레임 0x52c50 은 창 게이트 0x754f9 를 틀 머리 52cc6 에서 **한 번만**
   * 본다. 그 뒤 키 0x498d4(52d9e — '*' 49918 → 0x741a0 · 0x3c02c) · 진입 표 0xd04bc · 갱신 표 0xd0530(52e14~ — 히든 오픈 알림
   * 0x62368 → 0x74ef5 · 돌발 창 따위)이 창을 세우면 그 틀은 갱신을 끝까지 돌고, 52efe 는 [창+0x250] = 1(창을 띄운 0x74ef4 · 0x741a0)이라
   * 장면을 그대로 그린 뒤 같은 틀 끝 0x746cc 가 [+0x250] 을 지운다. 다음 틀부터 52cc6 이 갱신을, 52efe 가 장면 그리기를 건너뛴다 —
   * **그 틀은 보통 틀이고 창만 얹힌 첫 그림이 따로 없다**. 웹은 그런 창(`noteCommonWindowOpensInSceneUpdate`)을 그 앱 틱이 끝날 때까지
   * 멈추지 않고(그 틱 머리에 걸린 시계 · 틱 고리 · 타석 루프가 마저 돈다) 다음 앱 틱 머리에서 멈추며, 창이 선 첫 그림 셈(`freezeSerial`)을
   * 올리지 않는다. 틀 머리 앞(창 갱신 0x754f8 이 대기 칸 창을 이어 띄움 · 단말 일시정지 0x463ac)에 선 창은 지금처럼 곧바로 멈추고 그 첫
   * 그림이 장면을 한 번 더 그린다. 파티클 게이트 53048 은 같은 틀 뒤쪽이라 둘 다 창이 선 때부터다(`isCommonWindowShown`).
   */
  pendingFreeze: null as PendingFreeze | null,
  /** 이 앱 틱에 경기 장면 갱신(키 · 진입 · 갱신) 안에서 창을 연다고 적어 둔 틱 — 그 틱 안에 서는 창의 멈춤을 늦춘다 */
  inSceneUpdateOpenAppTick: null as number | null,
  nextSceneTimerId: 1,
}

/** 경기 장면 시계로 건 시계들 (`setGameSceneTimeout` · `setGameSceneTickTimeout`) */
export const sceneTimers = new Map<number, SceneTimer>()
