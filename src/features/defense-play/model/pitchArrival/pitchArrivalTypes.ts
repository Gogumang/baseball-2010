import type { FielderRecordSeat } from '@/entities/fielding/model/fielderRecords'
import type { PassedBallStrikeout } from '@/entities/fielding/model/passedBall'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import type { BaseState } from '@/entities/game/model/baseState'
import type { ManualAutoMode } from '@/entities/settings/model/gameSettings'
import type { HolderPlate } from '@/features/defense-play/model/defensePlayView'
import type { DefenseScene } from '@/features/defense-play/model/defenseScene'
import type { PassedBallPlayInput, PassedBallPlayResult } from '@/features/defense-play/model/passedBallPlay'
import type { RunnerAces } from '@/features/defense-play/model/runnerAces'
import type { RunnerPlayEngineInput } from '@/features/defense-play/model/runnerPlayEngine'
import type { StealPlayInput, StealPlayResult } from '@/features/defense-play/model/stealPlay'
import { type WalkPlayResult, runWalkPlay } from '@/features/defense-play/model/walkPlay'

export interface PitchArrivalPlayInput {
  /** 전역 모드 (`[scene+0x1104]`) — 7(홈런더비)이면 0.1% 굴림을 안 한다 */
  readonly gameMode: number
  /** 0x9d57c 투구 판정 v (`pitchJudgementOf`) */
  readonly pitchJudgement: number
  /** 이번 투구에 출발한 주자들의 루 (state[0x14+루]) */
  readonly stealingFrom: readonly StealBase[]
  /** 투구 때 루 상황 */
  readonly bases: BaseState
  /** 이 투구 전의 아웃 수 (state[6]) — 판 종류 고르기(0x3e0ee)가 읽는다. 판은 삼진이 서면 + 1 로 연다(`playOutsOf`) */
  readonly outs: number
  /**
   * 지금 타자의 손 `0xb63c0`(1 = 좌타) — 밀어내기 · 낫아웃 판의 타자주자가 서는 타석 자리(0x4650e 0xa93ac a9446 → vt94 0xa0884,
   * `batterBoxPosition`)를 고른다. 사람 타석은 판정 공의 `PitchOutcomeDetail.batterHand`, CPU 타석은 공의 화면 배치 `Pitch.stageSide`
   * (`simulateBatter` 가 맞은 공의 손으로 쓰는 값과 같다)
   */
  readonly batterHand: number
  readonly defenseAbilities?: readonly (number | null)[]
  /**
   * **수비 팀 보너스** (판 시작 0xb0fb4 b10d0 — `defenseTeamBonusOf`): 모드 1·2·8·9 에서 수비 팀 '집중' 등급.
   * 아홉 칸(칸 0 포함) 송구 속도에 더한다. 안 주면 0(모드 3~7 과 같다)
   */
  readonly defenseTeamBonus?: number
  /** 루별 주자 주루 (0 = 낫아웃 타자주자) */
  readonly runAbilities?: Partial<Record<0 | 1 | 2 | 3, number>>
  readonly runAbility?: number
  readonly runnerTeamGrade?: number
  readonly defenseIsCpu?: boolean
  readonly throwMode?: ManualAutoMode
  readonly offenseIsCpu?: boolean
  readonly runningMode?: ManualAutoMode
  readonly aceIndexes?: readonly (number | null | undefined)[]
  /** 수비 칸별 이름 판 선수 (0x43cb0 — `DefensePlayInput.fielderPlates`) */
  readonly fielderPlates?: readonly (HolderPlate | null | undefined)[]
  /** 수비 칸별 스킬 번호 — 레이저 굴림 0x66a8c 의 초감각(21) +3%p (`DefensePlayInput.fielderSkillIds`, `defenseSkillIdsOf`) */
  readonly fielderSkillIds?: readonly (readonly number[])[]
  /** 공격 팀 타자 · 루 위 주자의 마선수 번호 (`DefensePlayInput.runnerAces`) */
  readonly runnerAces?: RunnerAces
  readonly defenseTeamIndex?: number
  /** 야수 +0xec — 칸별 선수 레코드(판 시작 뒤 값, `entities/fielding/model/fielderRecords`). 그림이 야수마다 싣는다. 안 주면 싣지 않는다 */
  readonly fielderRecords?: readonly (FielderRecordSeat | null)[]
  readonly offenseTeamIndex?: number
  /**
   * 장면 +0xfdc — 공이 도착할 때의 번트 종류(0 = 없음). 판 시작 리드 `0x3d7b8`(3d8e0 이 장면 +0xfdc 를 바로 읽는다)이
   * 도루 안 한 주자에게 +3 틱을 더한다 — 도루 판(종류 5)의 `runStealPlay` 로 넘긴다. 못 맞힌 번트(번트 헛스윙 · 번트 자세로 맞이한 볼)면
   * 그 공의 번트 종류가 서 있다. 기본 0.
   * 종류 9(폭투·포일) 판도 같은 리드를 돈다(`passedBallPlay` 의 `leadRunnersForPassedBall`).
   * +0xfdc 를 쓰는 곳은 CPU 스윙 결정 0x34436(휘두를 때만 0 → 번트면 rand(1, 4)) · 사람 키 0x51dce · 0x51e2c(스윙 0) ·
   *   0x51e84(번트 종류) · 0x51eba(번트 거두기 0) 다섯이고 모두 상태 0x11 안이다. 그 0x11 **진입** 0x3de10 이 3deb8 에서
   *   0x340dc = `memset(장면+0xfd8, 0, 12)` 로 공마다 지우므로 안 휘두른 공은 0 이다 — 부르는 쪽은 이 공의 값을 넘긴다.
   */
  readonly buntKind?: number
  /** 앞 판에서 넘어온 수비 장면 연출 칸 (`DefensePlayInput.scene`) — 열린 판이 이어받고 결과의 `scene` 으로 돌려준다 */
  /**
   * 경기 +0xfd4 — 이 판이 열릴 때 남아 있던 스윙 판정 결과 코드(`sceneResultCode`). 튐 파티클(0x37022 ∉ {9,10,11}) ·
   * 홈런성(0x357e0, 24~26)이 본다. 모르면(헛스윙의 정해지지 않은 값 · 안 줌) null — 두 조건 모두 거르지 않는다
   */
  readonly sceneResultCode?: number | null
  readonly scene?: DefenseScene
}

export type PitchArrivalPlay = (
  | {
      readonly kind: 9
      readonly result: PassedBallPlayResult
      /** 0x3e09e 낫아웃 갈래 — `'batterRuns'` 면 판의 advance 에 타자주자가 들어 있다 */
      readonly strikeout: PassedBallStrikeout
      readonly callSoundId: number | null
      /** 종류 9 정산에는 도루 기록이 없다 */
      readonly recordIds: readonly number[]
    }
  | {
      readonly kind: 5
      readonly result: StealPlayResult
      readonly strikeout: 'none'
      readonly callSoundId: number | null
      /** 0xa8024 @a83c6·@a83de 의 후보 (게이트 전) */
      readonly recordIds: readonly number[]
    }
  | {
      /** 볼넷 · 사구 밀어내기 판 (0x3e1b4 0xb0cb8(플레이, 2)) — 판정 콜 · 판 기록이 없다 */
      readonly kind: 2
      readonly result: WalkPlayResult
      readonly strikeout: 'none'
      readonly callSoundId: null
      readonly recordIds: readonly number[]
    }
) & {
  /**
   * 화면이 이 판을 **실시간으로 이미 보여 주며** 돌렸는가(사람 수비의 키 송구 — `openPitchArrivalPlay`). 서 있으면 경기 흐름이
   * 재생 칸(`lastDefensePlay`)에 다시 넣지 않는다 — 넣으면 같은 판을 한 번 더 튼다.
   */
  readonly shownLive?: boolean
}

/**
 * **판 시작까지 굴린 공 도착 판** — 종류 · 낫아웃 갈래 · 진행기 입력(도루 판은 리드 굴림까지 끝낸 것). 사람이 수비하는 도루 ·
 * 폭투 판은 화면이 이 입력으로 진행기를 실시간으로 돌려(키 → +0x160) 다 돈 결과를 `finishPitchArrivalPlay` 에 넘긴다 —
 * 굴림 차례는 `runPitchArrivalPlay` 와 같다(판 시작 굴림 → 판 안의 굴림, 그 사이에 다른 굴림이 없다).
 */
export type OpenedPitchArrivalPlay =
  | {
      readonly kind: 9
      readonly strikeout: PassedBallStrikeout
      readonly playInput: PassedBallPlayInput
      readonly engineInput: RunnerPlayEngineInput
    }
  | {
      readonly kind: 5
      readonly strikeout: 'none'
      readonly playInput: StealPlayInput
      readonly engineInput: RunnerPlayEngineInput
    }
  | {
      /** 밀어내기 — 굴림 · 키 송구가 없다(종류 2 는 vt4c 가 안 돈다) */
      readonly kind: 2
      readonly walkInput: Parameters<typeof runWalkPlay>[0]
    }
