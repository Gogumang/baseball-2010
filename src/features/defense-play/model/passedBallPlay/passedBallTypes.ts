import type { FielderRecordSeat } from '@/entities/fielding/model/fielderRecords'
import type { PassedBallShot } from '@/entities/fielding/model/passedBall'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import type { BaseState } from '@/entities/game/model/baseState'
import type { ManualAutoMode } from '@/entities/settings/model/gameSettings'
import type { HolderPlate } from '@/features/defense-play/model/defensePlayView'
import type { DefenseScene } from '@/features/defense-play/model/defenseScene'
import type { DefensePlayControls } from '@/features/defense-play/model/runDefensePlay'
import type { RunnerAces } from '@/features/defense-play/model/runnerAces'
import type { RunnerPlayEngineResult } from '@/features/defense-play/model/runnerPlayEngine'
import type { RandomPort } from '@/shared/api/random/randomPort'

export interface PassedBallPlayInput {
  /** 0x3507c 가 굴린 값 — `passedBallShot(random)` 을 rollPassedBall 이 선 투구에서 그대로 */
  readonly shot: PassedBallShot
  /** 투구 때 루 상황 */
  readonly bases: BaseState
  /**
   * state[6] — 판이 열릴 때의 아웃 수 = **이 투구 전의 아웃 수** (`StealPlayInput.outs` 와 같다).
   * 낫아웃 갈래의 0xa7c4c 는 삼진 기록(이벤트 5 · 투수/타자 칸)만 올리고 state[6] 은 안 건드린다.
   */
  readonly outs: number
  /** `passedBallStrikeoutOf` 가 `'batterRuns'` 면 참 — 타자주자를 맨 앞에 만든다 (state[0x1a]) */
  readonly batterRuns?: boolean
  /** 지금 타자의 손 `0xb63c0`(1 = 좌타) — 낫아웃 타자주자가 서는 타석 자리(`batterBoxPosition`, vt94 0xa0884)를 고른다 */
  readonly batterHand: number
  /**
   * 이번 투구에 출발한 도루 주자들의 루 — state[0x14 + 루] (`0xa9bd4`, 종류 마스크 0xae794 = {1, 4, 5, 9}). 출발한 주자는 목표가
   * 이미 다음 루이고, 판 시작 리드(0x3d7b8)가 `0xcffa8`[루] + rand(0,9)(2 이하 → 3) 틱 몰아 돌린다. 안 주면 아무도 출발 안 했다
   */
  readonly stealingFrom?: readonly StealBase[]
  /** 장면 +0xfdc — 이번 투구의 번트 종류(0 = 없음). 서 있으면 도루 안 한 주자 리드가 +3 틱(`0x3d7b8` 3d8e0). 기본 0 */
  readonly buntKind?: number
  readonly defenseAbilities?: readonly (number | null)[]
  /**
   * **수비 팀 보너스** (판 시작 0xb0fb4 b10d0 — `defenseTeamBonusOf`): 모드 1·2·8·9 에서 수비 팀 '집중' 등급.
   * 아홉 칸(칸 0 포함) 송구 속도에 더한다. 안 주면 0(모드 3~7 과 같다)
   */
  readonly defenseTeamBonus?: number
  /** 주자 주루 능력치 — 루별(0 = 낫아웃 타자주자) */
  readonly runAbilities?: Partial<Record<0 | 1 | 2 | 3, number>>
  readonly runAbility?: number
  readonly runnerTeamGrade?: number
  /** 주면 펌블(0xb41d0) · 악송구(0xa1828) · 특수 송구(0xafa60) 굴림이 돈다 */
  readonly random?: RandomPort
  /** 수비 9명의 스킬 번호 (칸 순서) — 레이저 굴림 0x66a8c 의 초감각(21) (`DefensePlayInput.fielderSkillIds`) */
  readonly fielderSkillIds?: readonly (readonly number[])[]
  readonly defenseIsCpu?: boolean
  readonly throwMode?: ManualAutoMode
  readonly manualThrowBase?: number
  readonly offenseIsCpu?: boolean
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

export interface PassedBallPlayResult extends RunnerPlayEngineResult {
  readonly shot: PassedBallShot
  readonly batterRuns: boolean
}
