import { useState } from 'react'
import { TeamSelectScreen } from '@/pages/create-player/ui/TeamSelectScreen'
import { MY_LEAGUE_TEAM_GRID_SHAPE } from '@/pages/create-player/lib/teamSelectLayout'
import { hiddenTeamHintMessage } from '@/pages/general-mode/lib/hiddenTeam'
import { MessageBox } from '@/shared/ui'
import type { ScreenFrameTitle } from '@/widgets/screen-frame/lib/screenFrameLayout'

/** 나만의리그 모드 번호 — 타자편 4 · 투수편 3 (히든 팀은 일반모드 1 에서만 고른다) */
const MY_LEAGUE_MODE = { 타자편: 4, 투수편: 3 } as const

interface MyLeagueTeamSelectScreenProps {
  readonly side: keyof typeof MY_LEAGUE_MODE
  readonly title: ScreenFrameTitle
  /** 히든 팀(10~14) 해금 기록 — 전역 기록 +0x70+idx */
  readonly openedHiddenIds: readonly number[]
  readonly gamePoint?: number
  readonly onSelect: (teamId: number) => void
  readonly onCancel: () => void
}

/**
 * 나만의리그 팀 고르기 101 (두 편 공용 — 키 0x14114).
 *
 * 확인 키(−5 · '5')에서 격자 줄 [+0x10] 이 2(히든 줄)가 아니면 등록 0x66 으로 가고(1423e), 히든 줄이면 **열렸든 잠겼든**
 * 힌트 팝업 0x74ef5 만 띄운다(1416c~1423c — 글은 `hiddenTeamHintMessage`). 팝업이 떠 있는 동안은 키를 안 받는다
 * (14116~14124 `[[0x140005c]+9] ≠ 0` 이면 끝 — 웹은 `MessageBox` 가 키를 먼저 가져간다).
 */
export function MyLeagueTeamSelectScreen({ side, title, openedHiddenIds, gamePoint, onSelect, onCancel }: MyLeagueTeamSelectScreenProps) {
  const [hint, setHint] = useState<string | null>(null)
  const showHint = (teamId: number) => setHint(hiddenTeamHintMessage(teamId, { openedHiddenIds, mode: MY_LEAGUE_MODE[side] }))
  return (
    <TeamSelectScreen
      title={title}
      openedHiddenIds={openedHiddenIds}
      gridShape={MY_LEAGUE_TEAM_GRID_SHAPE}
      hiddenTeamsSelectable={false}
      {...(gamePoint === undefined ? {} : { gamePoint })}
      onSelect={onSelect}
      onSelectLocked={showHint}
      onCancel={onCancel}
      overlay={hint !== null && <MessageBox text={hint} buttons={['확인']} onAnswer={() => setHint(null)} />}
    />
  )
}
