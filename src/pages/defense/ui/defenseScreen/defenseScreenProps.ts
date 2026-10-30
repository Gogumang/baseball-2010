import type { ReactNode } from 'react'
import type { CameraState } from '@/pages/defense/lib/defenseCamera'
import type { DefenseViewState } from '@/entities/fielding/model/defenseView/defenseViewState'

export interface DefenseScreenProps {
  /** 한 틱치 스냅샷 — 야수·주자·공을 굴리는 모델이 넘겨 준다 */
  readonly state: DefenseViewState
  /**
   * 따라가기 비율(%/틱). 기본 20 이고, 경기 끝 직전에 투수판으로 도는 구간은 1 이다
   * (R3 1-3 — 0xc0558(cam, 1)).
   */
  readonly followPercent?: number
  /** 꺼 두면 카메라·애니가 멈춘다 (테스트·일시정지) */
  readonly isRunning?: boolean
  /**
   * 수비 바탕의 **잔디 팔레트 줄** — `stadium/defense.mpl` 의 줄 (`0x7885c`, S3 6-2).
   *
   * 타석 바닥을 칠하는 `0x786c8` 과 **명령어까지 같은 함수**다 (슬롯만 구장 `+0x2c` → `+0x14`,
   * 문자열만 `stadium/attack.*` → `stadium/defense.*`). 셋째 인자 뒤집기 `줄 = 1 − idx` 도 같고,
   * 리터럴 `0x0007885d` 는 온 파일에 딱 하나(풀 `0x352cc`)뿐이라 부르는 곳도 하나다 —
   * 수비 화면 준비 `0x35218` 의 `0x3529c` 가 `(SR[0x1ba] − 1, 1)` 을 넘긴다. 곧 **줄 = 2 − 칸**
   * 으로 타석 잔디와 **같은 값**이라, 줄을 내는 곳은 `grassPaletteRowOf` 하나면 된다.
   * (예전 메모의 "주/야간 3벌" 은 틀렸다 — 벌 셋은 거친인조·인조·천연 잔디다.)
   *
   * null 이면 구운 그림 그대로다 = PZX 기본 팔레트 = 칸 3 특급천연잔디, 그리고 시즌 홈경기가
   * 아닐 때의 색이기도 하다. ⚠️ 타석 준비(`0x352e8`)에 있는 **대전 모드 8·9 갈래가 여기엔 없다** —
   * 수비 바탕은 `[app+0x1104] == 2`(시즌) 이고 홈경기일 때만 바뀐다.
   */
  readonly grassPalette?: number | null
  /**
   * 그림자 위 · 선수 아래에 깔 것 — 비거리 판 0x36cd4 자리다. 0x46c88 머리(46cb6)가 그리기 목록보다 먼저 곧바로 칠하고(바탕은
   * 프레임 0x52c50 의 0x41230 → 0x411e0 이 그 앞), 공 그리기 0x36dfc 끝(37388)이 그림자 뒤에 한 번 더 칠한다 — 곧 바탕 · 그림자
   * 위, 야수 · 주자 · 공 아래이고 줌 펀치(46e24 0xbb84c)가 함께 늘린다.
   */
  readonly underActors?: ReactNode
  /**
   * 이 그림의 **카메라 오프셋**(+0xfec, +0xff0 — 0x41230)을 적어 둘 칸. 공 그리기 0x36dfc 의 파티클(`lib/ballParticles`)은
   * 화면 좌표로 쏘는데 파티클 장면은 재생 쪽(`DefensePlayback`)이 들고 있어서, 그쪽이 이 값을 읽는다. 그릴 때마다 덮어쓴다.
   */
  readonly cameraOffsetRef?: { current: { readonly x: number; readonly y: number } | null }
  /**
   * 지금까지 든 **창이 선 첫 그림([창+0x250])** 의 수 (`useGameSceneRedrawCount`). 그 그림은 갱신 없이 0x46c88 을 한 번 더 돌아 그리기에서
   * 0x93d91 로 넘기는 애니 — 부착 효과(0x43278 의 애니 0~4 · 13 · 15 · 0x43a0c 의 5~8)와 공 가진 야수 고리(0x43cb0 43e38) — 가 한 칸 더 간다.
   * 웹은 그 애니 칸을 화면 갱신 수로 고르므로(근사) 이 수를 더한다. 카메라(갱신 0x3f060)는 안 움직인다. 안 주면 0
   */
  readonly drawRedraws?: number
  /** 화면 위에 얹을 것 — 조작 버튼·점수판 같은 것 */
  readonly children?: ReactNode
  /**
   * 부르는 쪽이 정한 이 그림의 **필드 카메라**(+0x1e8 현재 자리). 주면 화면이 따라가기를 굴리지 않고 이 자리로 그린다 — 홈런더비 판처럼
   * 카메라를 미리 셈해 두는 화면(이벤트 존 조건이 카메라 오프셋을 본다, `pages/home-run-derby/lib/derbyField`)
   */
  readonly camera?: CameraState
  /**
   * 바탕(0x41230 → 0x411e0 의 구장 0x78931) 바로 위 · 공 그림자 아래에 깔 것 — 같은 0x411e0 이 구장 다음에 부르는 0x41098(이벤트 존 ·
   * 200G)의 자리다. 줌 층 안이다
   */
  readonly overBackground?: ReactNode
  /** 작은 지도 0x395f4 를 안 그린다 — 0x46844 가 판 종류([[+0x200]+0x118]) 8(홈런더비 판)이면 건너뛴다 */
  readonly hidesFieldMap?: boolean
  /** `RawScreen` 을 따로 세우지 않는다 — 이미 원본 화면 판(`RawScreen`) 안에 겹쳐 놓을 때 */
  readonly isEmbedded?: boolean
}
