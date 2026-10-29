export interface ParticleConfig {
  /** 방향(도) */
  readonly ang: number
  /** 방향 폭 — `ang + rand(spread+1) − spread/2` (360 = 사방) */
  readonly spread: number
  readonly spd: number
  readonly spdR: number
  /** 틱마다 새로 만들 입자 수 */
  readonly emit: number
  readonly emitR: number
  readonly life: number
  readonly lifeR: number
  /** 시작 A (16.16) */
  readonly a0: number
  readonly a0R: number
  /** 끝 A (16.16) — 틱마다 `A += (a1−a0)/life` */
  readonly a1: number
  readonly a1R: number
  /** 틱마다 `vx += ax` */
  readonly ax: number
  /** 틱마다 `vy += ay` (+면 아래 = 중력) */
  readonly ay: number
  /** 발생 범위 — 처음 위치가 `±(rand(w+1) − w/2)/4` px 흩어진다 */
  readonly w: number
  readonly h: number
  /** 이 이미터가 평생 만들 입자 총수 */
  readonly total: number
  /**
   * 그리기 가상함수(+0x14) 의 4번째 인자 **그대로**(설정 +0x32 바이트 — 0x6dd14 · 0x6dd20). 001 만 0, 나머지 25개는 2.
   * 확정(웹 r83 · 2026-10-16 다시 뜸): 0x6dc4c 가 파트 그림의 vtbl+0x14(그림, x, y, **mode**, **A >> 8**, 0) 을 부르고(0x6dd26~0x6dd38),
   * 두 그림 클래스(0xda914 → 0xc9f08 · 0xda960 → 0xca54c) 모두 넷째 · 다섯째 인자를 그리기 **효과 번호 · 인자**로 넘긴다 —
   * 0 = 효과 0 그냥 복사 · 2 = 효과 2 더하기(`widgets/particles` 의 `particleEffectOf`).
   */
  readonly mode: number
}

/** 입자 한 알. 좌표는 이미터 자리 + 1/512 px 눈금의 누적 오프셋이다 */
export interface Particle {
  /** 이미터가 있던 화면 x (px) */
  x: number
  y: number
  /** 누적 오프셋 (1/512 px) — 그릴 때 `>> 9` 로 px 을 뽑는다 */
  offX: number
  offY: number
  /** 속도 (1/512 px/틱) */
  vx: number
  vy: number
  /**
   * A (16.16). 그리기는 `A >> 8`(0x6dd26 `asrs #8`)을 효과 인자 b 로 넘긴다 — mode 2(효과 2 더하기)면 화면 + (그림 · b) >> 8 의
   * **더하는 세기**다(불투명도 섞기가 아니다 — `widgets/particles` 의 `particleEffectOf`). mode 0 이면 쓰이지 않는다.
   */
  a: number
  /** 틱마다 A 에 더하는 값 = `(a1 − a0)/life` */
  da: number
  /** 남은 수명(틱). 그림은 `파트[ life % 파트수 ]` 로 고른다 (0x6dc6a) */
  life: number
}

/**
 * 입자 공용 풀 (0x6d07c) — 앱 초기화 0x2f9c 가 `0x6d284(mgr, "ptc/ptcimg.pzx", 0x200, 1)` 로 **512 알**을 한 번 만든다.
 * 이미터마다 따로가 아니라 관리자 하나가 모든 이미터에 나눠 준다. 알은 빈 칸 목록([pool+4])에서 꺼내고(0x6d58a)
 * 수명이 다하면(0x6d878 의 life == 0 갈래) 그 목록 머리로 돌려준다. 알에는 이름이 없어 웹은 **남은 수**만 센다.
 */
export interface ParticlePool {
  /** 빈 칸 수 — 0 이면 [pool+4] == 0 */
  free: number
}

/** 0x2f9c 의 0x200 */
export const PARTICLE_POOL_SIZE = 512

export function createParticlePool(size = PARTICLE_POOL_SIZE): ParticlePool {
  return { free: size }
}

/**
 * 이미터 상태 +0x58 — 틱 0x6dad0 이 돌려주고 그대로 적는 값.
 * 0 풀이 바닥(굴림 없음) · 1 뿌리는 중 · 2 이번 틱에 다 못 만들었다(총수 · 풀) · 3 끝(알이 없고 누계 > 0).
 * 새 이미터는 calloc(0x2ac4) · 0x6d2f8 로 0 에서 시작한다.
 */
export type EmitterState = 0 | 1 | 2 | 3

export interface ParticleEmitter {
  readonly config: ParticleConfig
  /** 이미터가 선 화면 좌표 (px) */
  readonly x: number
  readonly y: number
  /** ptcimg.pzx 의 프레임 번호 — 그 프레임의 파트들이 입자 그림이 된다 (호출 인자 img) */
  readonly img: number
  /** 이 이미터가 만들 입자 총수 (호출 인자 total ≠ −1 이면 파일 값을 덮어쓴다, 0x6d32c) */
  readonly total: number
  /** 알을 꺼내 쓰는 관리자의 공용 풀 */
  readonly pool: ParticlePool
  /** 지금까지 만든 누계 (+0x40) */
  spawned: number
  /**
   * 살아 있는 알 — 원본 +0x3c 목록 차례(**새 알이 머리**: 0x6d5e0 이 머리에 끼운다). 갱신 · 그리기가 이 차례로 돈다.
   */
  readonly particles: Particle[]
  /** +0x58 — 마지막 틱이 적은 상태 */
  state: EmitterState
  /** 다 뿌리고 입자도 없어진 상태 3 (0x6dad0) — 관리자가 지운다 */
  done: boolean
}
