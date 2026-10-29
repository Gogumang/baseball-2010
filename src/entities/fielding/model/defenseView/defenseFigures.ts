import type { FielderRecordSeat } from '@/entities/fielding/model/fielderRecords'

// 수비 화면 스냅샷의 사람 둘 — 야수 · 주자 (`DefenseViewState`). 동작 번호 표는 `shared/config/original/defenseAnimations`.

/** 야수 한 명 */
export interface DefenseFielder {
  /** 수비 칸 0 투수 · 1 포수 · 2 1루 · 3 2루 · 4 3루 · 5 유격 · 6 우익 · 7 좌익 · 8 중견 (R3 2-2) */
  readonly slot: number
  readonly x: number
  readonly z: number
  /**
   * 높이(야수 +0x24). 그림 · 결과 판 자리는 (x, z − y) 다(0x43278 의 432f0~43318 — 0xb94b4(카메라, x, z − y)). 안 주면 0.
   * 원본에서도 늘 0 이다 — 이동체 틱 0xbf0dc 의 높이 식(bf204~bf226: y = +0x18 + v·t − g·t²/2, 0 아래 자름)에 수직 속도
   * v(+0x40)를 넣는 0xbec7c(속도, v)를 야수는 v = 0 으로만 부른다(a0dca 판 시작 · a155c 송구 뒤). 그래도 식대로 싣는다.
   */
  readonly y?: number
  /** FIELDER_ACTION */
  readonly action: number
  /** 그 동작이 걸린 뒤 흐른 갱신 횟수 (한 칸 = 1틱) */
  readonly actionTick: number
  /*
   * 좌우 반전 칸(`isFlipped`)은 **지웠다** — R3 7-3 이 "그리기 플래그 +0x11 = 좌우 반전 비트" 라고
   * 읽은 것이 틀렸다(S12 8절). `+0x11` 은 프레임에 더하는 17 이고, 야수 그리기 `0x79b48` 에는
   * 뒤집기를 거는 자리가 아예 없다 — 좌/우는 동작 3·4 가 **다른 프레임 묶음**으로 처리한다.
   */
  /** 마선수 번호 0~4, 마선수가 아니면 null (R3 7-1) */
  readonly aceIndex?: number | null
  /** 수비 팀 번호 0~14 — 그림 색을 갈아 끼우는 데 쓴다. 안 주면 구운 색 그대로다 (C-1) */
  readonly teamIndex?: number | null
  /** 야수 +0xec 선수 레코드 — 실책 그림 0x43278 이 [+0xec]+0x2e 를 올리는 대상(`entities/fielding/model/fielderRecords`). null = 0(안 올린다), 안 주면 모른다 */
  readonly record?: FielderRecordSeat | null

  // ── player_effect 부착 효과 칸 (0x43278 이 본다 — `playerEffectMarksOf`). 안 주면 아무것도 안 붙는다 ──

  /** +0xb0 — 가슴 높이 포구(7, 0xa1490) · 점프 캐치(0xe, 0xa14ac) 세터가 세우고 동작 끝(0xa143e)에 지운다 → 애니 4 */
  readonly catchFlag?: boolean
  /** +0xb4 동작 잠금 — 필살타법 타구에 맞은 야수 15(0xa1e60). > 0 이면 애니 4 + 머리 위 애니 15 */
  readonly lockTicks?: number
  /** +0xb8 — 펌블(b4280)이 6 으로 세우고 야수 틱이 잠금 없을 때 −1. > 0 이면 "!"(애니 13) */
  readonly fumbleTicks?: number
  /** +0xc0 — 악송구(a1908) · 원바운드(a17fc) · 아무도 못 받는 송구(예보 b188e, 던진 야수)가 4. > 0 이면 "!" */
  readonly throwErrorTicks?: number
  /** 달리기 먼지 자국 (vt6c~vt84) — 이번 그림에 찍을 점(바닥 x, z − y)과 player_effect 프레임. 없으면 null */
  readonly dustTrail?: { readonly x: number; readonly z: number; readonly frame: number } | null
}

/** 주자 한 명 */
export interface DefenseRunner {
  /** 주자 칸 0 = 타자주자 (R3 1-3 이 카메라 대상으로 쓰는 주자다) */
  readonly index: number
  readonly x: number
  readonly z: number
  /** RUNNER_ACTION */
  readonly action: number
  readonly actionTick: number
  /** 슬라이딩 프레임을 고르는 루 번호 (vt40 이 `루 % 4` 로 쓴다) */
  readonly base: number
  /** 진루 중인가 — 슬라이딩 표 둘 중 하나를 고른다 */
  readonly isAdvancing: boolean
  /** 아웃돼 퇴장 중이어도 걸어 나가는 동안은 그린다(R3 3-4). 아예 안 그릴 때만 false */
  readonly isVisible?: boolean
  /** 공격 팀 번호 0~14 — 주자도 `defender.pzx` 를 쓰므로 같은 팔레트 표를 탄다. 안 주면 구운 색이다 */
  readonly teamIndex?: number | null
  /** +0x96 처리 끝 — 아웃이 됐거나 홈을 밟았다. 작은 지도(0x395f4)가 이 주자를 안 찍는다. 안 주면 아직이다 */
  readonly isFinished?: boolean
  /**
   * 슬라이딩 먼지 방향 — 주자 +0xb8(슬라이딩 중, 0x9ff39)이 서 있을 때 0x9ff40 이 주는 1~4, 아니면 0.
   * 그리기 0x43b18 이 1 → player_effect 애니 5 · 2 → 6 · 3 → 8 · 4 → 7 을 주자 자리에 붙인다.
   */
  readonly slideDirection?: number
  /**
   * 주자 +0x9c ≠ −1 — 마선수 주자. 그림은 이 주자의 것이 아니라 장면에 **하나 실린** 그림(`runnerAceSprite`)이다(0x79d10).
   */
  readonly isAce?: boolean
}
