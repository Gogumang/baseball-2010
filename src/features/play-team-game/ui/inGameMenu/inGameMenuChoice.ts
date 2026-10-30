import { quitConfirmTextOf, REPLAY_CONFIRM } from '@/features/play-team-game/model/inGameMenu'
import type { InGameMenuAction } from '@/features/play-team-game/model/inGameMenu'
import { autoProgressConfirmOf } from '@/features/play-team-game/ui/inGameMenu/inGameMenuLooks'
import type { InGameMenuProps } from '@/features/play-team-game/ui/inGameMenu/inGameMenuProps'

/** 칸마다 앱이 넘겨야 할 손잡이 — 자동진행은 G포인트도 알아야 한다 */
const HANDLER_READY: Readonly<Record<InGameMenuAction, (props: InGameMenuProps) => boolean>> = {
  계속: () => true,
  조작방법: (props) => props.onOpenHelp !== undefined,
  설정: (props) => props.onOpenSettings !== undefined,
  자동진행: (props) => props.onAutoProgress !== undefined && props.gamePoint !== undefined,
  다시하기: (props) => props.onRestart !== undefined,
  나가기: (props) => props.onQuit !== undefined,
}

/** 앱이 손잡이를 안 넘긴 칸은 잠근다 — 원본에는 없는 웹판 가드다 */
export function isActionEnabled(action: InGameMenuAction, props: InGameMenuProps): boolean {
  return HANDLER_READY[action](props)
}

/** 질문 글 — 나가기는 모드별(`quitConfirmTextOf`), 다시하기 StrGAME[7], 자동진행 StrGAME[3]/[4] 에 비용 */
export function confirmTextOf(action: InGameMenuAction, mode: number, autoProgressCost: number): string {
  if (action === '나가기') return quitConfirmTextOf(mode)
  if (action === '다시하기') return REPLAY_CONFIRM
  return autoProgressConfirmOf(autoProgressCost)
}
