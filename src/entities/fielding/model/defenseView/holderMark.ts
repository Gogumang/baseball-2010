// 공 가진 야수 고리 (0x43cb0) — 애니 번호 표는 `shared/config/original/defenseAnimations` 의 `HOLDER_MARK_ANIM`.

export interface HolderMark {
  /** 공 가진 야수의 수비 칸 (플레이+0x130) */
  readonly slot: number
  /** game_ui 애니 1(하늘) · 2(노랑, 반짝임) · 3(빨강) */
  readonly anim: number
}

/**
 * 이름 판에 적을 것 — 0x43e3e: 야수 +0x88(수비 칸) == 0 이면 **지금 마운드 투수**(0xae83d(팀[state[0xa]]))의
 * 보직(0xb6ded → 0xb6705 = 레코드 +0xb & 3 — 대결 판의 0xb6704 와 **같은 함수**다, 썽크일 뿐)으로 0x545e8,
 * 아니면 야수 +0xec 선수 레코드의 `+0x1c & 0xf` 로 0x54590 을 부른다. 이름은 같은 레코드의 0xb62c1.
 */
export interface HolderPlate {
  readonly name: string
  /** 칸 0(투수)일 때 — 레코드 +0xb & 3 (0 선발 · 1 중계 · 2 구원) */
  readonly pitcherRole?: number
  /** 칸 1~8 일 때 — 레코드 +0x1c & 0xf */
  readonly positionCode?: number
}
