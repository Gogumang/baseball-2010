import type { PickoffBase } from '@/entities/defense-controls/model/pickoff'
import type { FielderRecordSeat } from '@/entities/fielding/model/fielderRecords'
import type { RunnerState } from '@/entities/fielding/model/fieldingState'
import type { BaseState } from '@/entities/game/model/baseState'
import type { ManualAutoMode } from '@/entities/settings/model/gameSettings'
import type { DefensePlayView, HolderPlate } from '@/features/defense-play/model/defensePlayView'
import type { DefenseScene } from '@/features/defense-play/model/defenseScene'
import type { DefenseKeyPress, DefensePlayControls, DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { RunnerAces } from '@/features/defense-play/model/runnerAces'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 결과 코드 — 9 세이프(0xb4292) · 13 아웃(0xb4556) */
export const PICKOFF_RESULT = { SAFE: 9, OUT: 13 } as const
export type PickoffResultCode = (typeof PICKOFF_RESULT)[keyof typeof PICKOFF_RESULT]

export interface PickoffPlayInput {
  /** state[0x27] — 견제 대상 루 */
  readonly targetBase: PickoffBase
  /** 견제 때 루 상황 */
  readonly bases: BaseState
  readonly outs: number
  /** 수비 9명 능력치 (칸 순서). 칸 0(투수)은 원본 그대로 레코드 칸 2 를 읽는다(`defenseAbilitiesOf`) */
  readonly defenseAbilities?: readonly (number | null)[]
  /**
   * **수비 팀 보너스** (판 시작 0xb0fb4 b10d0 — `defenseTeamBonusOf`): 모드 1·2·8·9 에서 수비 팀 '집중' 등급.
   * 아홉 칸(칸 0 포함) 송구 속도에 더한다. 안 주면 0(모드 3~7 과 같다)
   */
  readonly defenseTeamBonus?: number
  /**
   * **주자 속도의 팀 등급** (주자 만들기 0xa93ac a9488 — `runnerTeamGradeOf`): 모드 1·2·8 에서 공격 팀 '근성' 등급.
   * 모든 주자(타자주자 포함) 속도에 더한다. 안 주면 0(그 밖의 모드와 같다)
   */
  readonly runnerTeamGrade?: number
  /** 주자들의 주루 능력치 */
  readonly runAbility?: number
  /** 루별 주자 주루 (1~3). 없는 루는 `runAbility` — 루에 선 주자는 제 타석 0xa93ac 가 적은 주자+0xa4 를 들고 있다 */
  readonly runAbilities?: Partial<Record<1 | 2 | 3, number>>
  /** 주면 악송구 굴림(0xa1828)이 돈다 */
  readonly random?: RandomPort
  /** 수비 9명의 스킬 번호 (칸 순서) — 레이저 굴림 0x66a8c 의 초감각(21) +3%p (`DefensePlayInput.fielderSkillIds`). 안 주면 없음 */
  readonly fielderSkillIds?: readonly (readonly number[])[]
  /** `0xae690` 앞 항 — 공격이 CPU 인가 (자동 진루 제어기 0xaf918 을 켜는 조건) */
  readonly offenseIsCpu?: boolean
  /** 주루 설정 +0xbd. 안 주면 자동 */
  readonly runningMode?: ManualAutoMode
  /**
   * `0xae6c8` 앞 항 — 수비가 CPU 인가. 송구 설정(`throwMode`)과 함께 슬롯 2 의 매 틱 CPU 송구 결정 0xafa60 을 켠다.
   * 안 주면 사람 수비(그 갈래가 안 돈다 — 지금까지와 같다).
   */
  readonly defenseIsCpu?: boolean
  /** 송구 설정 +0xf4 (원본 기본 수동) — `0xae6c8` 뒤 항 */
  readonly throwMode?: ManualAutoMode
  readonly aceIndexes?: readonly (number | null | undefined)[]
  /** 수비 칸별 이름 판 선수 (0x43cb0 — `DefensePlayInput.fielderPlates`) */
  readonly fielderPlates?: readonly (HolderPlate | null | undefined)[]
  /** 공격 팀 타자 · 루 위 주자의 마선수 번호 (`DefensePlayInput.runnerAces`) */
  readonly runnerAces?: RunnerAces
  readonly defenseTeamIndex?: number
  /** 야수 +0xec — 칸별 선수 레코드(판 시작 뒤 값, `entities/fielding/model/fielderRecords`). 그림이 야수마다 싣는다. 안 주면 싣지 않는다 */
  readonly fielderRecords?: readonly (FielderRecordSeat | null)[]
  readonly offenseTeamIndex?: number
  /**
   * 앞 판에서 넘어온 수비 장면 연출 칸 (`DefensePlayInput.scene`). 견제는 투구(0x10 · 0x11)를 안 지나 +0x1997 · 판정 애니를
   * 되감지 않는 것으로 본다(유력 — 견제 키 0xf → 0x17 길을 다 뜨지 않았다)
   */
  /**
   * 경기 +0xfd4 — 이 판이 열릴 때 남아 있던 스윙 판정 결과 코드(`sceneResultCode`). 튐 파티클(0x37022 ∉ {9,10,11}) ·
   * 홈런성(0x357e0, 24~26)이 본다. 모르면(헛스윙의 정해지지 않은 값 · 안 줌) null — 두 조건 모두 거르지 않는다
   */
  readonly sceneResultCode?: number | null
  readonly scene?: DefenseScene
  /**
   * 사람 조작 — 이 판 동안 틱마다 눌린 키. 상태 0x17 키 0x53420 은 판 종류를 안 가린다 — 사람이 수비면 0x533c8 이
   * 메시지 0x588 → 플레이 vt60 → +0x160, 종류 4 는 vt4c 가 도니 b4660 이 준비된 쥔 야수를 그 루로 보낸다.
   * 사람이 공격(`side: '공격'`)이면 같은 키가 주루 0x5331c(0x582 진루 · 0x584 귀루 → 0xa9b04, 종류 4 는 마스크 0x232 안이라
   * 먹는다) · OK 슬라이딩 0x585(0x518da — 종류 2 · 3 만 막는다)다(`entities/fielding/model/baserunningKey`).
   */
  readonly controls?: DefensePlayControls
}

export interface PickoffPlayResult extends DefensePlayResult {
  readonly targetBase: PickoffBase
  /** 9 세이프 · 13 아웃 · null(포구 판정 없이 끝남 — 악송구) */
  readonly resultCode: PickoffResultCode | null
}

export interface PickoffRunner {
  state: RunnerState
  counted: boolean
  /** 주자 +0x3b — 마지막 목록 틱(이동)에서 목표 루에 막 닿았다. 득점 0xaa0a8(aa12a)이 본다 */
  arrivedThisListTick: boolean
  /** 주자 +0x84 — 직전 목표 루 (`runnerPlayEngine` 의 같은 칸). 사람 진루 키의 앞길 검사가 본다 */
  previousTarget: number
}

/**
 * 견제 한 판을 끝까지 돌린다. 경기 상태는 건드리지 않고 결과(`advance`)만 돌려준다.
 */
/** 견제 판을 한 틱씩 돌리는 손잡이 (`runnerPlayEngine.RunnerPlayStepper` 와 같은 꼴) */
export interface PickoffPlayStepper {
  readonly tick: number
  readonly finished: boolean
  readonly ticks: readonly DefensePlayView[]
  /** 방금 돈 틱에서 슬라이딩 효과음 10 을 낸다 — 사람 슬라이딩 키 0x518da → 0x5199c(+0x31c 잠금, 한 판 한 번) */
  readonly slidingSoundThisTick: boolean
  /** 방금 돈 틱에 낸 소리 — 낸 차례대로 (슬라이딩 키 → 결과 메시지 0xbba 의 판정 콜, `runnerPlayEngine.RunnerPlayStepper` 와 같다) */
  readonly soundsThisTick: readonly number[]
  step(press: DefenseKeyPress | null): void
  result(): PickoffPlayResult
}
