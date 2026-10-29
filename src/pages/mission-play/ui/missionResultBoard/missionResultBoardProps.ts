import type { MissionResultExit } from '@/pages/mission-play/lib/missionResultBoard'
import type { SettlementEffectLayers } from '@/widgets/batting-stage/model/stageRefs'

export interface MissionResultBoardProps {
  /** [미션+0xbc] — 0xa5368(obj, 목표 달성?) 이 적은 성공 여부 */
  readonly isSuccess: boolean
  /**
   * 마선수 대결(전역 기록 g[0x11f] 타자편 · g[0x176] 투수편)인가 — 그리면 앞부분(띠 · YOU WIN/LOSE)만, 키는 커서를 안 뒤집는다.
   * `flag11f` · `flag176` 은 어느 칸이 섰는지다 (키 0x407f0 의 OK 는 둘 다 서야 대결 끝 길로 간다).
   */
  readonly aceMatch?: { readonly flag11f: boolean; readonly flag176: boolean }
  /** [+0x17f4] — 진입 0x4ea0c 가 적은 이번에 번 G (`missionResultEarnedOf`) */
  readonly earnedGamePoint: number
  /** g[0x64] — 진입이 보상을 더한 뒤의 보유 G (`missionResultHeldOf`). 안 주면 그 줄 숫자를 비운다 */
  readonly heldGamePoint?: number
  /**
   * 판을 나간다 — '다시'(0x140006c = 3, 같은 미션 곧바로) · '목록'(1, 미션 목록) · '대결끝'(0x4090e).
   * 마선수 대결은 0x4b100 이 원래 모드로 돌려보내므로 부르는 쪽이 어느 값이든 대결 끝으로 다룬다.
   */
  readonly onExit: (exit: MissionResultExit) => void
  /**
   * 정산 효과 층 — 밑의 결과 배경 타석 캔버스(`BattingStage` 의 `settlement.layers`)와 같은 묶음. 0x4ea0c 꼬리(4f41a~)는 모드를
   * 안 가려 미션도 성공 = 이김(밤이면 불꽃) · 실패 = 비를 깐다. 원본 그리기 0x4a384 차례대로 비 층은 실패 덮개(4a404) 바로 위 ·
   * 띠(4a448) 아래(효과 틱 0x4a452), 파티클 층은 판 맨 위(프레임 끝 0x6dd69)다.
   */
  readonly effectLayers?: SettlementEffectLayers
}
