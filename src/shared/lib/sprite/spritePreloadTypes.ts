/** 폴더 하나에서 받을 것 */
export interface SpriteFolderPreload {
  /** `./sprites/num` · `./sprites/img_text/frames` 처럼 PNG 가 놓인 폴더 */
  readonly folder: string
  /** 받을 프레임 번호. `'all'` 이면 origins.json 의 칸을 모두 받는다 */
  readonly frames: readonly number[] | 'all'
  /** 같이 받을 JSON (폴더 기준 이름) — 합성 프레임 폴더면 보통 `origins.json` */
  readonly json?: readonly string[]
  /**
   * CSS `mask-image` 로 쓰는 프레임 번호 — `?mask` 주소를 CORS 모드로 받는다 (`spriteMask` 머리말: `<img>` 몫과 캐시 칸이 갈린다)
   */
  readonly masks?: readonly number[]
  /**
   * 이 폴더의 `origins.json` 에 **있는 프레임만** 받는다 — 그리기(`placedFrame`)가 원점 없는 칸을 아예 안 받는 것과 같게.
   * 계산으로 만든 목록(자세표 × 겹 규칙)은 파일이 없는 칸(번트 앞몸 · 덧그림 없는 투구 단계 따위)을 낼 수 있어 이것으로 거른다.
   * 번호 지도 폴더(`frames/index`)는 원점 표가 없으니 그림 폴더(`frames`)를 가리킨다.
   */
  readonly framesListedIn?: string
  /** 번호가 아닌 이름의 PNG (`management/icon_selected_5` 따위) — 확장자 없이 */
  readonly names?: readonly string[]
  /**
   * 이 애니 번호들이 쓰는 프레임도 받는다 — `animationsIn`(없으면 이 폴더)의 `animations.json` 칸의 `frame` 을 모은다.
   * 이벤트 초상화처럼 **애니 번호만 아는** 계산 목록(`afterGameEventPreload`)이 프레임 번호를 손으로 옮겨 적지 않게 한다.
   */
  readonly animations?: readonly number[]
  /** `animations.json` 이 놓인 폴더 — 번호 지도 폴더(`frames/index`)는 그림 폴더(`frames`)를 가리킨다 */
  readonly animationsIn?: string
}

export type SpritePreloadPriority = 'scene' | 'idle'

export interface SpritePreloadDeps {
  /** 그림을 받아 decode 까지 — 실패해도 거부하지 않고 끝나기만 하면 된다 */
  readonly loadImage: (url: string, isLowPriority: boolean) => Promise<unknown>
  readonly loadJson: (url: string) => Promise<unknown>
  /** 브라우저가 한가할 때 부른다 */
  readonly scheduleIdle: (callback: () => void) => void
  /** 장면 줄 동시 요청 수 */
  readonly sceneConcurrency?: number
  /** 유휴 줄 동시 요청 수 (기본 4 — 2 로는 지연 80ms 에서 메뉴에 머무는 동안 다음 화면 목록에 닿지 못했다, r124 측정) */
  readonly idleConcurrency?: number
}

export interface SpritePreloader {
  /** 받기를 줄 세운다. 돌려주는 약속은 다 받으면(실패 포함) 풀린다 — 게임은 이것을 기다리지 않는다 */
  readonly preload: (requests: readonly SpriteFolderPreload[], priority: SpritePreloadPriority) => Promise<void>
}
