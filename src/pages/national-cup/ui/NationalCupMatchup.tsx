import { Button } from '@/shared/ui'
import { TEAMS } from '@/shared/config/original/teams'
import type { NationalCup, NationalCupMatchup as Matchup } from '@/entities/national-cup/model/nationalCup'
import {
  MATCHUP_BUTTONS, MATCHUP_HINT, MATCHUP_LOGO_SIZE, MATCHUP_PANEL, MATCHUP_SIDES, MATCHUP_TITLE,
  MATCHUP_VS, nationalCupRoundLabelOf,
} from '@/pages/national-cup/lib/nationalCupLayout'
import * as styles from '@/pages/national-cup/ui/NationalCupMatchup.css'

interface NationalCupMatchupProps {
  readonly cup: NationalCup
  readonly matchup: Matchup
  /** 제 n 회 */
  readonly edition: number
  /** 확인(−5/0x35) → 경기 준비 (나리 142 · 시즌 221) */
  readonly onStart: () => void
  /** 취소(−16) → 순위 화면으로. 시즌모드 `0x4a18` 에만 있는 길이다 (유력) */
  readonly onBack?: () => void
}

/**
 * 국가대항전 매치업 화면 (나만의리그 상태 135 · 시즌모드 상태 244).
 *
 * 원본에는 **들어옴 처리가 없고 키 처리만** 있다 (`0x10680` 나리 / `0x4a18` 시즌):
 * 확인(−5/0x35)이면 경기 준비 상태(142 / 221)로, 취소(−16)면 순위 화면으로 돌아간다.
 * 경기 자체는 `0x1c46c` 가 `내 팀 = 0xb7614(L,n,0)`·`상대 = (L,n,1)` 로 세운다 —
 * 대한민국이 칸 0 이 아니면 둘을 맞바꾸므로 **사람 경기는 늘 대한민국 경기**다.
 *
 * ⚠️ **원본 배치 미해독 — 근사.** 무엇을 그리는지 짚은 문서가 없어 공용 판 (24, 54, 192, 212)
 * 관례로 두 팀 로고와 이름을 세웠다 (`nationalCupLayout.ts` 참고).
 */
export function NationalCupMatchup({ cup, matchup, edition, onStart, onBack }: NationalCupMatchupProps) {
  const mine = TEAMS[matchup.myTeam]
  const theirs = TEAMS[matchup.opponent]

  return (
    <div role="group" aria-label="국가대항전 대진">
      <div className={styles.panel}
        style={{ left: MATCHUP_PANEL.x, top: MATCHUP_PANEL.y, width: MATCHUP_PANEL.width, height: MATCHUP_PANEL.height }} />

      <div className={styles.title} style={{ left: MATCHUP_TITLE.x, top: MATCHUP_TITLE.y, width: MATCHUP_TITLE.width }}>
        제{edition}회 국가대항전
      </div>
      <div className={styles.round} style={{ left: MATCHUP_TITLE.x, top: MATCHUP_TITLE.y + 16, width: MATCHUP_TITLE.width }}>
        {nationalCupRoundLabelOf(cup.stage)}
      </div>

      <img className={styles.logo} src={mine.logoUrl} alt={mine.name}
        style={{ left: MATCHUP_SIDES.leftX, top: MATCHUP_SIDES.logoY, width: MATCHUP_LOGO_SIZE, height: MATCHUP_LOGO_SIZE }} />
      <div className={styles.teamName}
        style={{ left: MATCHUP_SIDES.leftX + MATCHUP_LOGO_SIZE / 2 - MATCHUP_SIDES.nameWidth / 2, top: MATCHUP_SIDES.nameY, width: MATCHUP_SIDES.nameWidth }}>
        {mine.name}
      </div>

      <div className={styles.vs} style={{ left: 0, top: MATCHUP_VS.y }}>VS</div>

      <img className={styles.logo} src={theirs.logoUrl} alt={theirs.name}
        style={{ left: MATCHUP_SIDES.rightX, top: MATCHUP_SIDES.logoY, width: MATCHUP_LOGO_SIZE, height: MATCHUP_LOGO_SIZE }} />
      <div className={styles.teamName}
        style={{ left: MATCHUP_SIDES.rightX + MATCHUP_LOGO_SIZE / 2 - MATCHUP_SIDES.nameWidth / 2, top: MATCHUP_SIDES.nameY, width: MATCHUP_SIDES.nameWidth }}>
        {theirs.name}
      </div>

      <div className={styles.hint} style={{ left: MATCHUP_HINT.x, top: MATCHUP_HINT.y, width: MATCHUP_HINT.width }}>
        대표팀 투수진이 모두 회복되었습니다
      </div>

      <div className={styles.buttons} style={{ left: MATCHUP_BUTTONS.x, top: MATCHUP_BUTTONS.y, width: MATCHUP_BUTTONS.width }}>
        <Button onClick={onStart}>경기 시작</Button>
        {onBack !== undefined && <Button variant="corner" onClick={onBack}>돌아가기</Button>}
      </div>
    </div>
  )
}
