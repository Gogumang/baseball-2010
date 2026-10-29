import type { FielderRecordSeat } from '@/entities/fielding/model/fielderRecords'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import type { BaseState } from '@/entities/game/model/baseState'
import type { ManualAutoMode } from '@/entities/settings/model/gameSettings'
import type { HolderPlate } from '@/entities/fielding/model/defenseView/holderMark'
import type { DefenseScene } from '@/features/defense-play/model/defenseScene'
import type { DefensePlayControls } from '@/features/defense-play/model/runDefensePlay'
import type { RunnerAces } from '@/features/defense-play/model/runnerAces'
import type { RunnerPlayEngineResult } from '@/features/defense-play/model/runnerPlayEngine'
import type { RandomPort } from '@/shared/api/random/randomPort'

export interface StealPlayInput {
  /** 투구 때 루 상황 */
  readonly bases: BaseState
  /** 출발한 주자들의 루 — 0xa9bd4 가 받아들인 것만 (`canStartSteal`) */
  readonly stealingFrom: readonly StealBase[]
  /**
   * state[6] — 판이 열릴 때의 아웃 수 = **이 투구 전의 아웃 수**. 0x3dfac 는 투구 판정 v 를 판정 칸
   * `[scene+0x10ac]` 에 적어 둘 뿐 아웃은 올리지 않고 곧장 상태 0x17 로 간다 — 1아웃 이하 삼진이면
   * 그 삼진 아웃은 판이 끝난 뒤 판정 칸을 읽는 쪽이 올린다(읽는 자리는 안 떴다 — 유력).
   */
  readonly outs: number
  /** 수비 9명 능력치 (칸 순서) */
  readonly defenseAbilities?: readonly (number | null)[]
  /**
   * **수비 팀 보너스** (판 시작 0xb0fb4 b10d0 — `defenseTeamBonusOf`): 모드 1·2·8·9 에서 수비 팀 '집중' 등급.
   * 아홉 칸(칸 0 포함) 송구 속도에 더한다. 안 주면 0(모드 3~7 과 같다)
   */
  readonly defenseTeamBonus?: number
  /** 주자 주루 능력치 — 루별로 줄 수 있다. 없으면 `runAbility` */
  readonly runAbilities?: Partial<Record<1 | 2 | 3, number>>
  readonly runAbility?: number
  /** 주자 속도에 더하는 팀 등급 (전역 모드 1·2·8 에서만, R3 4절) */
  readonly runnerTeamGrade?: number
  /** 장면 +0xfdc — 이번 투구의 번트 종류 (도루 안 한 주자의 리드 +3, `0x3d7b8`). 기본 0 */
  readonly buntKind?: number
  /** 주면 악송구(0xa1828)·특수 송구(0xafa60) 굴림이 돈다 */
  readonly random?: RandomPort
  /** 수비 9명의 스킬 번호 (칸 순서) — 레이저 굴림 0x66a8c 의 초감각(21) (`DefensePlayInput.fielderSkillIds`) */
  readonly fielderSkillIds?: readonly (readonly number[])[]
  readonly defenseIsCpu?: boolean
  /** 송구 설정 +0xf4 (기본 수동) */
  readonly throwMode?: ManualAutoMode
  /** 사람이 방향키로 고른 송구 루 (+0x160). 안 주면 자동 규칙 */
  readonly manualThrowBase?: number
  readonly offenseIsCpu?: boolean
  /** 주루 설정 +0xbd (기본 자동) */
  readonly runningMode?: ManualAutoMode
  readonly aceIndexes?: readonly (number | null | undefined)[]
  /** 수비 칸별 이름 판 선수 (0x43cb0 — `DefensePlayInput.fielderPlates`) */
  readonly fielderPlates?: readonly (HolderPlate | null | undefined)[]
  /** 공격 팀 타자 · 루 위 주자의 마선수 번호 (`DefensePlayInput.runnerAces`) */
  readonly runnerAces?: RunnerAces
  readonly defenseTeamIndex?: number
  /** 야수 +0xec — 칸별 선수 레코드(판 시작 뒤 값, `entities/fielding/model/fielderRecords`). 그림이 야수마다 싣는다. 안 주면 싣지 않는다 */
  readonly fielderRecords?: readonly (FielderRecordSeat | null)[]
  readonly offenseTeamIndex?: number
  /** 앞 판에서 넘어온 수비 장면 연출 칸 (`DefensePlayInput.scene`) */
  /**
   * 경기 +0xfd4 — 이 판이 열릴 때 남아 있던 스윙 판정 결과 코드(`sceneResultCode`). 튐 파티클(0x37022 ∉ {9,10,11}) ·
   * 홈런성(0x357e0, 24~26)이 본다. 모르면(헛스윙의 정해지지 않은 값 · 안 줌) null — 두 조건 모두 거르지 않는다
   */
  readonly sceneResultCode?: number | null
  readonly scene?: DefenseScene
  /** 사람 조작 — 틱마다 눌린 키 (`RunnerPlayEngineInput.controls`) */
  readonly controls?: DefensePlayControls
}

export interface StealPlayResult extends RunnerPlayEngineResult {
  readonly stealingFrom: readonly StealBase[]
  /** 루를 옮긴 도루 주자의 출발 루 (정산 0xa8024 @a83c6 — 잡힌 주자가 없을 때만 기록 8) */
  readonly stolenFrom: readonly StealBase[]
  /** 잡힌 도루 주자의 출발 루 (@a83de — 기록 24) */
  readonly caughtFrom: readonly StealBase[]
}
