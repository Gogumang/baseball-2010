import { RawScreen } from '@/shared/ui'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import type { League } from '@/entities/league/model/league'
import { StandingsWindow } from '@/widgets/standings/ui/StandingsWindow'
import { useSeasonCursor } from '@/widgets/season/model/useSeasonCursor'

export interface NextGameStandingsScreenProps {
  /** 리그 `S+0x80` — 순위표가 그대로 그린다 */
  readonly league: League
  /** 편 — 머리띠 제목 `[장면+0xcc] == 4 ? 8 : 9` (0x16928) */
  readonly edition: '타자편' | '투수편'
  /** 확인(−5 · '5') → 142 경기 준비 (웹은 142 가 없어 곧바로 경기) */
  readonly onConfirm: () => void
  /** 취소(−16) — **이전 상태가 105(관리)일 때만** 105 로. 그 밖에는 아무 일도 없다 (0x1060e~0x10612) */
  readonly onCancel: () => void
  /** 이전 상태가 105 인가 — 바닥 5(되돌아가기) / 1 (0x16928 의 0x6d 갈래) */
  readonly isFromManagement: boolean
  readonly gamePoint: number
}

/**
 * **나만의리그 다음경기 앞 순위표 (상태 109)** — 진입 `0x10d8c` · 키 `0x105f0` · 그림 `0x168a4` (직접 떴다, R9).
 *
 * ```
 * 진입 0x10d8c:  이전 ≠ 105 → 0x6ea6d(소리, 4, −1, 1) 배경음 4
 *                S+0x50 = 4 · 이전 ≠ 142 → 저장(0x1fded · 0x22755(g, 1)) · 커서 [+0x9c] vt+0x14(0, 0)
 * 그림 0x168a4:  0x7f070(ui, L) 순위표 + 0x7f4ed(머리띠 — 틀 0x16928 이 맡긴 제목 8/9 · 바닥 (이전 == 105 ? 5 : 1))
 * 키   0x105f0:  −5 · '5'(0x35) → 142
 *                −16             → 이전 == 105(0x69) 일 때만 105
 *                그 밖           → [+0x9c] vt+0x18 (커서 — 그림이 안 읽어 보이는 일이 없다)
 * ```
 * 시즌 0xd8(`NextGameScreen`)과 같은 짜임이다. 난수는 안 쓴다.
 */
export function NextGameStandingsScreen({
  league, edition, onConfirm, onCancel, isFromManagement, gamePoint,
}: NextGameStandingsScreenProps) {
  useSeasonCursor({ count: 1, onSelect: onConfirm, onCancel })

  return (
    <RawScreen>
      <StandingsWindow league={league} onClose={onConfirm} />
      <ScreenFrame title={edition === '타자편' ? '나만의리그타자편' : '나만의리그투수편'} gamePoint={gamePoint}
        onBack={isFromManagement ? onCancel : null} />
    </RawScreen>
  )
}
