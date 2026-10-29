import type { QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import type { PitcherRole } from '@/entities/game/model/simulateHalfInning/otherSlices'

/* ── 수비 쪽: 마운드와 투수 교체 (0xc1ba4 → 0xac428 · 0xabfcc · 0xaf09c) ─────── */

/**
 * 지금 마운드에 선 투수와 그에 딸린 카운터 — 원본 팀 객체 `+0x27c` 묶음과 `team+0x33`(벤치 수).
 * 반 이닝 하나가 끝나면 부르는 쪽이 이것을 그대로 들고 다음 이닝에 다시 넘긴다.
 */
export interface HalfInningMound {
  /** 로스터 투수 칸 (`team[0]`) */
  readonly pitcherSlot: number
  /** 이 투수의 스태미나 `+0x2c` (0~10000) */
  readonly stamina: number
  /** **B(`+0x280`)** 이 투수의 실점 — 투수 교체(0xaec64)에서만 0 이 된다 */
  readonly runsAllowed: number
  /** `+0x27c` 이 투수의 투구 수 */
  readonly pitches: number
  /** 이미 등판했던 투수 칸 — 벤치(`team+0x33`)에서 뺀다 */
  readonly usedSlots: readonly number[]
  /** `state[0xd]` — 교체 직후 한 투구 동안은 다시 안 바꾼다 (0xa5e72 가 투구마다 0 으로) */
  readonly justChanged: boolean
}

/** 반 이닝 안의 투수 교체 한 번 — 바뀐 **뒤**의 투수 칸과 그 순간의 판 */
export interface HalfInningPitcherChange {
  readonly pitcherSlot: number
  readonly outs: number
  readonly runnerCount: number
  /** 이 반 이닝에 교체 전까지 들어온 점수 */
  readonly runsBefore: number
  /** 내려간 투수 칸과 그 순간 스태미나 `+0x2c` — 레코드에 남아 다음 경기로 이어진다 (a583fe0) */
  readonly outgoingPitcherSlot: number
  readonly outgoingStamina: number
}

/** 투수 한 명이 이 이닝에 남긴 줄 */
export interface HalfInningPitcherLine {
  readonly pitcherSlot: number
  readonly outs: number
  readonly runsAllowed: number
  readonly strikeouts: number
  readonly pitches: number
}

/**
 * 반 이닝을 도는 동안 수비 팀이 쓰는 것 — 이것을 넘기면 **타석마다 CPU 투수 교체**(0xc1ba4)가 돌고
 * 투구마다 체력이 깎인다 (0xa5e14). 안 넘기면 예전처럼 투수 하나가 끝까지 던진다.
 */
export interface HalfInningDefense {
  /** 이 이닝을 시작할 때의 마운드 */
  readonly mound: HalfInningMound
  /** 이 팀의 투수 칸 전부 (`team+0x0c` 8명) — 마운드와 이미 쓴 투수를 뺀 나머지가 벤치다 */
  readonly pitcherSlots: readonly number[]
  /**
   * 그 칸 투수의 간이 타석용 능력 — 체력 인자 90(피로 없음)으로 부른 `0xb570c`. `fightingSpirit` 은 이 순간 스킬 14(투지) 갈래의
   * **경기 상태**가 섰는가(`fightingSpiritAt`) — 참이고 그 투수가 비트 14 를 장착했으면 팀 정액 뒤 · 코치 앞에 v/10 을 얹는다(b5a16~b5a72)
   */
  readonly pitcherAt: (pitcherSlot: number, fightingSpirit?: boolean) => QuickAtBatPitcher
  /**
   * 그 칸 투수를 **체력%로 부른** `0xb570c` 의 제구·구속 (`QuickAtBatPitcher.tired`) — 피로 0xb58e6 이 팀 능력치 정액·코치보다
   * 먼저 먹으므로 밑값을 아는 부르는 쪽이 준다. 안 넘기면 `pitcherAt` 값에 피로(`abilityAfterFatigue`)만 먹인다.
   */
  readonly tiredPitcherAt?: (
    pitcherSlot: number,
    staminaPercent: number,
    fightingSpirit?: boolean,
  ) => { readonly control: number; readonly velocity: number }
  /**
   * **스킬 14(투지) 갈래의 경기 상태** (0xb570c b5a4c~b5a66) — 전역 경기 상태 [0x1552d0c] 의 +0x6b > 4 이고 이 수비 팀(팀레코드 +0)이
   * 지는 측인가. `runsThisHalf` 는 이 반 이닝에 지금까지 들어온 점수다 — 사람 경기 장면 안 자동진행은 전역 상태 자체라 득점 0xb6a9c 가
   * 그때그때 점수 칸을 올린다(`inGameFightingSpiritStateOf`). CPU 끼리 경기(0xc239c · 0xc2a48 …)는 제 스택 상태로 굴려 전역 칸을 안 건드리므로
   * 마지막 사람 경기의 값이 그대로다(`isLiveGameFightingSpiritSituation`). 안 넘기면 늘 거짓
   */
  readonly fightingSpiritAt?: (runsThisHalf: number) => boolean
  /** 그 칸 투수의 **체력 실효 능력치(칸 3)** — 스태미나 용량 X 의 바탕 (0x66e44) */
  readonly staminaAbilityAt: (pitcherSlot: number) => number
  /**
   * 그 칸 **벤치 투수의 지금 스태미나** `+0x2c` — 올라올 때 이 값으로 서고, 새 투수 고르기 0xabfcc 가 견준다.
   * 원본 레코드 값은 경기 사이에 이어진다 (a583fe0). 안 넘기면 가득으로 본다.
   */
  readonly staminaAt?: (pitcherSlot: number) => number
  /** 이 반 이닝이 시작될 때의 리드 (수비 점수 − 공격 점수) */
  readonly lead: number
  /** 팀 사기 (0x66e44 의 `V[+2]`). 모르면 100 */
  readonly morale?: number
  /**
   * **그 팀 레코드 +2 의 앞 값** — 이 경기에서 0xb570c 가 아직 그 레코드를 안 덮었을 때 소모 0xa5e14 의 용량 0x66e44 가 읽는 값.
   * 나리(모드 3·4)는 0xb570c 갈래 b5762~b5768 이 넘겨 받은 팀 레코드 +2 에 지금 나리 사기를 쓰는데, 공 하나의 차례가
   * 소모가 먼저다(r101 직접 뜸): 간이 엔진 0xc262c 는 c26cc `0xa5e14` 뒤에 c26f6 `0xc11f0`(c1446 수비 팀) · c26fe `0xc1818`(c1852
   * 수비 팀)이 0xb570c 를 부르고, 사람 장면은 0x11 진입 0x3de10 의 3dec6 `0xa5e14` 뒤 틱 10 놓기 0x4dc78 의 0x4dbac · 0x34968 이
   * 수비 팀을 부른다. 그래서 **1회초 수비 팀(후공)의 첫 투수 첫 공**만 이 값이고(공격 팀은 그 앞 0xe 그리기 0x35b94 · 간이 타석이
   * 덮는다), 그 뒤로는 `morale` 이다. 안 넘기면 늘 `morale`
   */
  readonly staleMorale?: number
  /**
   * 두 팀 다 CPU 조작인가 (`state[0x31+측]`). 참이면 마무리 투입 굴림 0xac360 이 곧장 0 을
   * 돌려준다 (0xb6c20) — **CPU 끼리의 리그 경기가 바로 이 경우다**.
   */
  readonly bothTeamsAreCpu?: boolean
  /**
   * **모드 3(투수편)만** 넘긴다 — `0xac428` 의 다섯째 인자 `[sp+4] = (모드 == 3)`(0xc1cc0·0xc1b64)와
   * 그 칸이 `0xb6389`(레코드 `+0xa` 비트7, 내 육성 선수)인가. 이것을 넘기면 교체 AI 가 내 투수를 새 투수로
   * 고르지 않는다 (아래 `changePitcherIfNeeded` 의 ac45e·ac626 갈래).
   */
  readonly isOwnPlayerAt?: (pitcherSlot: number) => boolean
  /**
   * 그 칸 투수의 보직 `+0xb & 3` (0xb6dec) — 판정 0xac428(마운드 투수)과 새 투수 고르기 0xabfcc(벤치)가 본다.
   * 로스터 칸(팀 안 0~7)이면 `rosterPitcherRoleOf`(칸 0~3 선발 · 4~6 중간 · 7 마무리)를 넘기면 된다. 보직이 없는
   * 칸(마투수 8번 · 투수편 내 투수)은 0xabfcc 의 어느 보직 목록에도 안 든다.
   *
   * ⚠️ **안 넘기면 보직을 모른다** — 마운드는 선발, 새 투수는 "스태미나 최고"(`chooseReplacementPitcher` 근사)로
   * 고른다. 이때는 9회 이후 마무리 상황(교체도 참)에서 마무리 대신 선발형으로 본 투수가 올라와 **다음 타석에
   * 또 바뀐다**(마무리는 보직 2 갈래로 버티지만 보직을 모르면 그 갈래를 못 탄다). 지금은 리그(`entities/league`)·
   * 타자편(`features/play-game`)·투수편(`features/play-pitcher-game`) 모두 `rosterPitcherRoleOf` 를 넘긴다.
   */
  readonly roleAt?: (pitcherSlot: number) => PitcherRole | undefined
  /**
   * 그 칸 투수의 능력 합 `0xb5b50(팀, P)` = 경기용 능력치 네 칸(체력 인자 90)의 합 (`pitcherAbilitySumOf`).
   * 새 투수 고르기 0xabfcc 의 마무리 갈래(ac0be)가 이 값 큰 순으로 줄 세운다. 안 넘기면 그 갈래는
   * 스태미나 순 근사로 고른다.
   */
  readonly abilitySumAt?: (pitcherSlot: number, fightingSpirit?: boolean) => number
  /**
   * 그 칸이 마선수(0xb633c = 레코드 `+0xa` 비트6)인가. 마운드면 특수 문턱(ac4f2), 벤치에 하나라도 있으면
   * 0xb8a8d 가 참이라 마무리 굴림 0xac360 을 지난다. 0xabfcc 는 마선수를 고르지 않는다. 안 넘기면 아무도 아니다.
   */
  readonly isSpecialPitcherAt?: (pitcherSlot: number) => boolean
  /**
   * 그 칸 투수 레코드의 장착 스킬 비트 `+0x14` (u32) — 공 하나 소모 0xa5e14 가 `0xb62b4(투수, 18)`(비겁자 ×2, a5f30) ·
   * `0xb62b4(투수, 10)`(끈기 −1, a5f52)로 본다. 붙박이 팀 줄이면 Xls 행 그대로(0x1ff98 사본 — 표 `RosterPlayer.skillBits`).
   * 안 넘기면 0(둘 다 거짓)이다.
   */
  readonly skillBitsAt?: (pitcherSlot: number) => number
  /**
   * 간이 엔진 0xc1ba4 의 투수 교체 갈래를 막는다 — c1c78 `0x66864()` 가 0 이면 c1cb6 에서 0xac428 을 건너뛴다(미션 모드 6 의
   * 미션 객체 +0xbd ∈ {3, 7}). 안 넘기면 막지 않는다.
   */
  readonly pitcherChangeBlocked?: boolean
}
