/**
 * **장면 들여다보기 칸** (웹 개발 도구 — 원본에 없다). 화면 부품이 장면 바로가기 진행기(`app/dev/sceneRunner`)와 e2e 도우미에게
 * 지금 상태 몇 개를 알린다 — 버튼 글자나 화면 구조를 더듬지 않고 "타석 OK 대기 · 구질 고르기 · 수비 판" 같은 자리를 기다리게.
 *
 * **게임 상태를 바꾸지 않는다** — 읽기 전용 사본만 둔다. 부르는 곳은 스위치를 그 자리에
 * `import.meta.env.DEV || import.meta.env.MODE === 'e2e'` 로 쓴다(`app/dev/sceneShortcut` 머리말과 같은 까닭 — 배포 빌드에서 접힌다).
 */
export interface TeamGamePeek {
  /** 경기 시작 인트로(상태 0xc)를 다 봤는가 */
  readonly isIntroDone: boolean
  /** 사람 공격 타석 · 사람 수비 타석 */
  readonly canBat: boolean
  readonly canPitch: boolean
  /** 0xe — OK 를 기다리는 중(투수 · 타자 소개 판) */
  readonly isAwaitingConfirm: boolean
  /** '#'(교체 · 대타)가 먹는 자리 — 0xe · 0xf, 덮개 없음 */
  readonly acceptsChangeKey: boolean
  /** 구질 고르기(0xf) 누름 칸이 서 있다 */
  readonly isPitchSlotPickerShown: boolean
  /** 수비 판(상태 0x17)이 떠 있다 — 그 판을 사람이 받는 쪽 */
  readonly defensePlaySide: '수비' | '공격' | null
  /** 자동진행 중계(상태 0x21 — `TeamAutoRelay`)가 돌고 있다 */
  readonly isAutoRelay: boolean
}

/** 나리 투수편 경기 (경기 장면 모드 3 — `PitcherGameScreen`) */
export interface PitcherGamePeek {
  readonly isIntroDone: boolean
  /** 내 투수가 마운드에 선 수비 타석 */
  readonly canPitch: boolean
  /** 0xe — OK 를 기다리는 중(투수 · 타자 소개 판) */
  readonly isAwaitingConfirm: boolean
  /** 구질 고르기(0xf) 누름 칸이 서 있다 */
  readonly isPitchSlotPickerShown: boolean
  /** '#' 강판 물음이 먹는 자리 — 0xe · 0xf */
  readonly acceptsGiveUpKey: boolean
  /** 내 수비 판(상태 0x17)이 떠 있다 */
  readonly isDefensePlayShown: boolean
}

/** 미션 경기 (경기 장면 모드 5 투수 `PitchingScreen` · 6 타자 `MissionPlayScreen`) */
export interface MissionPeek {
  readonly side: '타자' | '투수'
  /** 0xe — OK 를 기다리는 중 */
  readonly isAwaitingConfirm: boolean
  /** 구질 고르기(0xf) 누름 칸이 서 있다 — 투수 미션만 */
  readonly isPitchSlotPickerShown: boolean
  /** 결과 판(0x19 — `MissionResultBoard`)이 떠 있다 */
  readonly isResultShown: boolean
}

/** 홈런더비 타석 (경기 장면 모드 7) */
export interface HomeRunDerbyPeek {
  /** 0xe — 사람 OK 를 기다린다(다음 공 앞) */
  readonly acceptsConfirm: boolean
  /** 비거리 판(0x17)이 도는 중 */
  readonly isPlayRunning: boolean
  /** 결과 창(0x1a) */
  readonly isResultShown: boolean
}

export interface ScenePeeks {
  readonly teamGame?: TeamGamePeek
  readonly homeRunDerby?: HomeRunDerbyPeek
  readonly pitcherGame?: PitcherGamePeek
  readonly mission?: MissionPeek
}

let peeks: ScenePeeks = {}

/** 한 칸을 갈아 끼운다 — `null` 이면 거둔다 */
export function publishScenePeek<K extends keyof ScenePeeks>(name: K, value: ScenePeeks[K] | null): void {
  const next: Record<string, unknown> = { ...peeks }
  if (value === null) delete next[name]
  else next[name] = value
  peeks = next as ScenePeeks
}

export function scenePeeksNow(): ScenePeeks {
  return peeks
}

let isFastForward = false

/**
 * 장면 바로가기 진행기가 단계를 밟는 동안만 참 — 그동안 **연출만 하는 판**(경기 로딩 판 `LoadingTip`)은 기다리지 않고 닫는다.
 * 난수를 굴리지 않는 판에만 쓴다. 부르는 곳은 역시 `import.meta.env.DEV || import.meta.env.MODE === 'e2e'` 안에서만 읽는다.
 */
export function setSceneFastForward(next: boolean): void {
  isFastForward = next
}

export function isSceneFastForward(): boolean {
  return isFastForward
}
