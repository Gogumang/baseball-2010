import type { MutableRefObject } from 'react'
import type { useMissionSession } from '@/app/model/useMissionSession'
import type { MissionRun } from '@/entities/mission/model/missionRun'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import type { DefenseSceneMemory } from '@/pages/defense/lib/defenseHomeRunEffects'
import type { WalkerLineSeats, WalkerSeat } from '@/widgets/field-walk/lib/walkerAces'
import type { MissionPitchSceneBeforePlay } from '@/app/ui/missionRoutes/useMissionPitchSceneBeforePlay'

/** 공 사이 화면 갈래가 보는 재료 */
export interface MissionOverlayInput {
  readonly session: ReturnType<typeof useMissionSession>
  readonly defenseScene: MutableRefObject<DefenseSceneMemory>
  /** 지금 장면의 판 — 자동진행 0x21 중계를 띄울지 본다 */
  readonly playingRun: MissionRun | PitcherRun | null
  /** 결과 띠(상태 0x12) — 내려간 뒤에야 0x18 → 0x21 */
  readonly bannerText: string
  /** 재생 칸의 판을 세워도 되나 — 밀어내기 판(종류 2)은 0x12 대기 0x1f 틱 뒤 (`useFreePassPlayStart`) */
  readonly isFreePassReady: boolean
  /** 미션 타자 이름 (`missionBatterNameOf`) — 0x21 · 첫 0x18 DUE UP 의 그 선수 줄 */
  readonly missionBatterName?: string | null
  /** 미션 투수 이름 (`missionPitcherNameOf`) — 투수 미션 첫 0x18 판의 PITCHER */
  readonly missionPitcherName?: string | null
  /** 장면 두 줄의 +0xec — 판 앞 값 · 벤치 클리어링 때 수비 줄 (`useWalkerLineSeats`) */
  readonly walkerSeats?: { readonly boardBefore: WalkerLineSeats; readonly benchDefense: readonly WalkerSeat[] }
  /** 투수 미션 판이 섰지만 아직 0x17 전(0x11 끝 · 0x13 · 공 도착 판의 0x12 틱 0) — 그동안은 투구 화면이 그린다 */
  readonly pitchScene?: MissionPitchSceneBeforePlay
  /** 타자 미션 벤치 클리어링의 타자 손 — 사구를 맞은 사람 칸 타자 (`missionStageBatterOf` 의 폼) */
  readonly benchBatterHand?: number
}
