import type { FielderRecordSeat } from '@/entities/fielding/model/fielderRecords'
import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import type { FielderState, RunnerState } from '@/entities/fielding/model/fieldingState'
import type { BallParticleFacts, DefenseViewState } from '@/entities/fielding/model/defenseView/defenseViewState'
import type { HolderMark, HolderPlate } from '@/entities/fielding/model/defenseView/holderMark'
import type { ActionMemory } from '@/features/defense-play/model/defensePlayView/actionMemory'

/** 진행기가 내주는 한 틱 — 화면이 쓰는 스냅샷(`entities/fielding/model/defenseView`)에 틱 번호만 붙였다 */
export interface DefensePlayView extends DefenseViewState {
  readonly tick: number
}

/** 진행기가 한 틱마다 `viewStateOf` 에 넘기는 것 — 공 · 사람 · 그림에만 쓰는 칸 */
export interface ViewStateInput {
  readonly tick: number
  readonly ball: WorldPoint
  readonly ballIsFlying: boolean
  /** 공.vt18(멈춤) — 카메라가 홈런 판에서 타자주자로 넘어가는 조건(0x3f106). 안 주면 거짓 */
  readonly ballStopped?: boolean
  /** 플레이 +0x111(홈런) · +0x129(폴 홈런) — 카메라 0x3f0f0 이 본다. 안 주면 거짓 */
  readonly homeRunFlag?: boolean
  readonly poleHomeRunFlag?: boolean
  /** 플레이 +0x12c(쥠) — 공 그리기 0x36dfc 가 공 · 그림자를 안 그린다. 안 주면 거짓 */
  readonly ballHeld?: boolean
  /** 공이 담장 뒤로 사라졌다(0x36dfc 36e2a~36e80 — `DefenseBall.isBeyondFence`). 안 주면 거짓 */
  readonly ballBeyondFence?: boolean
  /**
   * 공+0x68 — 이 그림에서 공이 재생 중인 틱(`DefenseBall.isPlaybackStart`). 판 틱에서 지금 공을 깐 판 틱을 뺀 값이다.
   * 0 이하면 0x36dfc 가 36e24 에서 공 · 그림자 · 두 번째 비거리 판을 건너뛴다. 안 주면 1(그린다)
   */
  readonly ballPlaybackTick?: number
  /** 이 그림은 카메라가 안 움직인다(머리에서 경기 멈춤 +0x1993 — 0x3f0a4). 안 주면 움직인다 */
  readonly cameraFrozen?: boolean
  readonly fielders: readonly FielderState[]
  readonly runners: readonly RunnerState[]
  /** 이번 틱에 포구 동작 중이면 그 종류, 아니면 null */
  readonly catchKind: number | null
  readonly chaserSlot: number
  /** 이번 틱에 송구 동작 중인 야수 칸. 없으면 −1 */
  readonly throwingSlot: number
  /** 송구가 가고 있는 루. 없으면 −1 */
  readonly throwBase: number
  readonly previousActions: ActionMemory

  // ── 아래 셋은 **그림에만 쓰인다**. 안 주면 지금까지와 똑같이 논다. ──
  // (필살 포구 번쩍임은 여기서 안 고른다 — 진행기의 `defenseScene` 이 연출 단계대로 싣는다)

  /** 수비 칸별 마선수 번호 0~4 (없으면 null·undefined). 이름 표 0xd3f0c("ace/defender_medica"), 20바이트 간격 — 읽는 함수 0x79a5c · 0x79cbc */
  readonly aceIndexes?: readonly (number | null | undefined)[]
  /**
   * 레이저 송구 반짝임(경기+0x19ad)을 띄울 야수 칸. 안 주면 아무도 안 반짝인다.
   * 세 조건(공 쥔 야수 · +0x19ad · deadly_effect A 안 돎)은 **진행기가** 본다 — `defenseView.ts` 주석.
   */
  readonly laserShiningSlot?: number | null
  /** 수비 팀 번호 0~14 — 야수 그림 팔레트 (C-1) */
  readonly defenseTeamIndex?: number | null
  /** 야수 +0xec — 칸별 선수 레코드(`entities/fielding/model/fielderRecords`). 안 주면 싣지 않는다 */
  readonly fielderRecords?: readonly (FielderRecordSeat | null)[]
  /** 공격 팀 번호 0~14 — 주자 그림 팔레트 */
  readonly offenseTeamIndex?: number | null
  /** 공 가진 야수 고리 (0x43cb0) — 진행기가 `holderMarkOf` 로 고른다. 안 주면 없다 */
  readonly holderMark?: HolderMark | null
  /** 고리와 같이 그리는 이름 판에 적을 선수. 고리가 없으면 버린다 */
  readonly holderPlate?: HolderPlate | null
  /** 칸별 야수 +0xb8(펌블 표시) — 진행기가 센다. 안 주면 0 */
  readonly fumbleTicks?: readonly number[]
  /** 칸별 야수 +0xc0(송구 실수 표시) — 진행기가 센다. 안 주면 0 */
  readonly throwErrorTicks?: readonly number[]
  /** 주자 칸 → +0x84(직전 목표 루). 슬라이딩 먼지 방향 0x9ff40 의 0x9fe80 이 본다. 안 주면 +0x8c(닿은 루) */
  readonly previousTargetOf?: (runnerIndex: number) => number
  /** 주자 칸 → 마선수 번호(+0x9c), 아니면 null (`runnerAces`). 안 주면 아무도 마선수가 아니다 */
  readonly runnerAceIndexes?: readonly (number | null)[]
  /** 타석 교대 때 실린 주자 마선수 그림 번호 (`loadedRunnerAceOf`) */
  readonly runnerAceSprite?: number | null
  /** 레이저 잔상(장면 +0x1991)이 서 있으면 지금 공 궤적의 t = 0 점(월드 x · y 높이 · z) */
  readonly laserTrailFrom?: WorldPoint | null
  /** 공 그리기 0x36dfc 파티클의 진행기 쪽 조건 (`BallParticleFacts`). 안 주면 안 쏜다 */
  readonly ballParticles?: BallParticleFacts | null
  /** 경기 +0xfd4 — 주자 판이 열린 때의 스윙 판정 결과 코드(`sceneResultCode`). 안 주면 싣지 않는다(타구 판) */
  readonly sceneResultCode?: number | null
}
