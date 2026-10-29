import type { BattedContact, PitchResolution, SwingMode } from '@/entities/pitching/model/simulateBatter/otherSlices'

/**
 * 0x34334 가 보는 상황. 원본은 경기 state 에서 바로 읽는다 —
 * state[+4] 스트라이크 · state[+5] 볼 · state[+6] 아웃 · 주자 수 0xa9599(scene[+0x20c]).
 * 주자는 u8 로 잘라 0 인가 아닌가만 본다.
 */
export interface BatterSituation {
  readonly strikes: number
  readonly balls: number
  readonly outs: number
  readonly hasRunner: boolean
}

/** 0x34334 가 휘두르기로 정한 뒤의 갈래 — 표에서 뽑은 choice 0(치기)·1(번트) */
export type CpuSwingChoice = '치기' | '번트'

/** 0x34468 의 마타자 필살 판단에 드는 값 */
export interface CpuSpecialSwingInput {
  /** 마선수인가 (0xb633d = 선수 레코드 [10] 비트6) */
  readonly isMagicBatter: boolean
  /** 고른 필살 번호 — 선수 +0x18 (u8). 0 이면 안 고른 것 */
  readonly swingNumber: number
  /** 이 경기 남은 횟수 — s8 팀[+0x29 + 타순(+0x32)] */
  readonly remaining: number
}

/** 제구 · 구속 한 쌍 — 던지는 사람 투수의 경기 능력 */
export interface PitcherStats {
  readonly control: number
  readonly velocity: number
}

/** 부르는 쪽이 넘기는 CPU 타자의 성질 */
export interface CpuBatterTraits {
  /** 마선수인가 (0xb633d = 선수 레코드 [10] 비트6) — 마선수는 번트하지 않는다 */
  readonly isMagicBatter?: boolean
  /**
   * 이 공이 실투인가 — 투구 순간 0x33cbc(`isMistakePitch`)가 정한 값. 부르는 쪽이 궤적을 만든 뒤
   * (0x4dea0 은 궤적 준비 0x9e669 다음) 이 함수보다 **먼저** 굴려 넘긴다.
   * 참이면 표 선택이 치기로 강제되고 타이밍이 늘 d = 0 이다.
   */
  readonly isMistakePitch?: boolean
  /**
   * 마타자 필살 (0x34468~0x34488). `isMagicBatter` 일 때만 본다. 안 넘기면 필살을 쓰지 않는다(예전 동작).
   *   swingNumber = 선수 +0x18 (마타자 5~9) · remaining = 이 경기 남은 횟수 s8 팀[+0x29 + 타순]
   *   aceOrder·aceLevel = 0x34d6c 의 k = 레벨·5 + 순번 (`mgr[0x13f + 순번]`)
   */
  readonly specialSwing?: {
    readonly swingNumber: number
    readonly remaining: number
    readonly aceOrder?: number
    readonly aceLevel?: number
  }
  /**
   * 0x34d6c 투수 쪽 — 사람 투수의 공에 실린 마구(`pitch.magicNumber` = P+0x10)를 볼 때 마투수 레벨.
   * 공에 번호가 없으면(사용자 투구는 아직 안 실음) 쓰이지 않는다.
   */
  readonly pitcherAceLevel?: number
  /**
   * 판정 모드 (0x1552d10 묶음) — 투수편(모드 3) '나만의리그' · 투수 미션(모드 5) '투수미션' · 팀 경기 '일반'.
   * 넘기면 이 타석의 수비 팀이 사람이라는 것도 함께 판정에 싣는다 — 모드 3·4 밖이면 hit·power 쪽 −10
   * (0xab5c0, state[0x31 + 수비] == 0). **안 넘기면 예전처럼 '일반' 이고 팀 조작 보정을 하지 않는다.**
   */
  readonly swingMode?: SwingMode
  /** 던지는 사람 투수가 육성·명전(비트7)인가 — 나리 보너스(모드 3)·투수 미션 +100(모드 5). 안 넘기면 거짓 */
  readonly isPitcherOwnPlayer?: boolean
  /** 나리 연차 idx (저장 레코드 +0xb3) — 투수 보너스 400 − 40 × 연차. 안 넘기면 0 */
  readonly careerYearIndex?: number
  /**
   * **파울 각 공도 수비 판으로 돌리는가** — 원본은 맞은 공이면 파울 각이라도 판(상태 0x17)을 돌아 낙구 · 담장선 틱에 0x9d5bc 가 7 을
   * 내야 파울이고, 그 전에 잡히면 뜬공 아웃(13)이다. 참이면 파울 각 공을 `foulContact` 로 돌려주고 필살타법 굴림(0x517e6)도
   * 판 시작에 맡긴다. 안 넘기면 예전처럼 여기서 곧장 파울로 끝낸다(판을 아직 안 잇는 부르는 쪽 — 웹 근사).
   */
  readonly playsFoulBall?: boolean
  /**
   * 던지는 사람 투수의 체력% `0xaebb0` — **이번 공을 깎은 뒤** 값(0x11 진입 0x3dec6 → 0xa5e14 가 스윙보다 앞).
   * 0xab214 의 ab838 이 `[sp+0xc8] == 0` 이면 B · C 에 +2000 을 더한다(사람 타석 `resolvePitch` 와 같은 칸).
   * 안 넘기면 지치지 않은 것으로 본다.
   */
  readonly pitcherStaminaPercent?: number
  /**
   * **CPU 타자 레코드 +0x14 의 장착 스킬 번호** — 0xab214 의 스킬 갈래(ab91c~)가 모드 검사 없이 `0xb62b4(타자, n)` 로 읽는다
   * (`skillIdsOfBits(비트, 타자)` — 붙박이 표 줄은 Xls 행 그대로, 마타자는 `aceSkillIdsOf`). 안 넘기면 없음
   */
  readonly batterSkillIds?: readonly number[]
  /**
   * **던지는 사람 투수 레코드 +0x14 의 장착 스킬 번호**(비트 + 16) — 같은 스킬 갈래가 `0xb62b4(투수, n)` 로 읽는다(모드 검사 없음).
   * 나리 · 미션 투수는 장착 비트(`PitcherCareer.equippedSkillIds`), 팀 경기 명단 투수는 제 줄 비트(마투수는 제 행). 안 넘기면 없음
   */
  readonly pitcherSkillIds?: readonly number[]
  /**
   * 그 스킬들이 보는 경기 상황(이닝 · 공격 팀이 지는가(ab966: 수비 점수 > 공격 점수) · 주자 · 2루 · 타자 결과 링 · 타자 레코드 칸
   * 0xb6394). 볼카운트는 `situation` 의 것을, 손은 공 · 화면 배치를 쓴다. 안 넘기면 1회 · 이기는 중 · 주자 없음 · 빈 링 · 칸 0
   */
  readonly skillSituation?: CpuSwingSkillSituation
}

/** CPU 타자 스윙 판정 0xab214 의 스킬 갈래가 보는 경기 상황 (`CpuBatterTraits.skillSituation`) */
export interface CpuSwingSkillSituation {
  readonly inning: number
  readonly isLosing: boolean
  readonly runnerCount: number
  readonly hasSecondBaseRunner: boolean
  readonly recentAtBatCodes: readonly number[]
  /** 타자 레코드 칸 0xb6394 = +0xa & 0x1f — 투수 스킬 31 만 본다 */
  readonly batterOrderIndex?: number
}

/** 타석 장면이 그리는 CPU 타자의 스윙 — 스윙 프레임 F(+0xfd8) · 번트 종류(+0xfdc, 0 이면 스윙) */
export interface CpuSwingPose {
  readonly frame: number
  readonly buntKind: number
}

/** `pitchAgainstBatterDetailed` 의 결과 — 필살 칸을 부르는 쪽에 돌려준다 */
export interface CpuPitchOutcome {
  readonly resolution: PitchResolution
  /** 이번 스윙이 필살인가 (S+0x10 ≠ 0) */
  readonly isSpecialSwing: boolean
  /**
   * 스윙 뒤 남은 필살 횟수 — 0x4e136 이 스윙 틱에 −1 한 값. 필살을 안 썼으면 넘겨받은 값 그대로,
   * `traits.specialSwing` 을 안 넘겼으면 null.
   */
  readonly specialSwingRemaining: number | null
  /** 필살 성공 — 0x517e6 이 필살타법 표시(공 속성 4)를 단 타구 (야수가 쥐지 못한다). 판을 도는 공은 판 시작이 굴려 늘 거짓이다 */
  readonly isUncatchable: boolean
  /**
   * 판을 돌 파울 각 공(`traits.playsFoulBall`) — 쏜 패턴 · 결과 코드 · 필살 스윙 재료. 부르는 쪽이 이것으로 수비 판을 돌리고,
   * 판이 파울로 닫히면(`DefensePlayResult.foulEnded`) 그제야 스트라이크를 올린다(0x35108 → 0xb6b58).
   */
  readonly foulContact?: BattedContact
  /**
   * 이 공 뒤의 장면 +0xfdc (0 스윙 · 1~3 번트 — `cpuBuntKindOf`). 휘두른 공(헛스윙 포함)은 이 공의 값, 안 휘두른 공은 **0** 이다 —
   * 상태 0x11 진입 0x3de10 이 3deb8 에서 0x340dc = `memset(장면+0xfd8, 0, 12)` 로 공마다 지우고, CPU 타석에서 쓰는 곳은
   * 0x34436(0x11 의 11번째 틱, 휘두를 때만)뿐이다. 판을 도는 맞은 공 — 파울 각 공(`foulContact`)과
   * 페어 타구(`resolution.outcome` 에 쏜 패턴이 묶인 공) — 에 싣는다. 원본 판은 타석이 친 공의 번트 종류를 그대로 본다:
   * 판 끝 결과 코드 0x9d5bc 가 state[4] > 1 이고 번트(state[0x13])면 11(2스트라이크 번트 파울 아웃)을 내고, 판 시작 리드(0x3d7b8)가
   * +3 틱 · 필살수비 관문(50fc8)이 굴림 없음으로 보며, 정산 0xa8024 가 번트 타구(결과비트 B6 · 희생)로 센다.
   */
  readonly buntKind?: number
  /**
   * 스윙 프레임 F = 장면 +0xfd8 (0x340f8 — N − 2 + d). 휘두른 공만 있다. 0x11 갱신 0x4e0dc 가 공 틱 [+0x1098] ≥ F 인 틱에
   * 스윙 객체 [+0xf9c] 의 vtable +0x14(스윙) · +0x18(번트, +0xfdc ≠ 0)을 건다 — 타석 장면의 CPU 타자 자세가 본다
   */
  readonly swingFrame?: number
}
