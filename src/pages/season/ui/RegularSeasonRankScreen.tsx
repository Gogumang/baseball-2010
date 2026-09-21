import { Button, RawScreen } from '@/shared/ui'
import { rankingOf } from '@/entities/league/model/league'
import type { League } from '@/entities/league/model/league'
import { regularSeasonRankEventId } from '@/entities/season-mode/model/seasonStateMachine'
import { StandingsWindow } from '@/widgets/standings/ui/StandingsWindow'
import * as styles from '@/widgets/season/ui/SeasonEndWindow.css'

export interface RegularSeasonRankScreenProps {
  /** 정규시즌이 끝난 리그 (`entities/league`) */
  readonly league: League
  /** 내 팀 번호 (SR[1]) */
  readonly teamId: number
  /** 확인 — 다음은 **시즌 결산 0xef** 다 */
  readonly onNext: () => void
}

/**
 * 정규시즌 순위 (장면 0x105 상태 **0xf0**, 갱신 `0x6c90` — P4 1a·2b 절).
 *
 * `phase = 0x10` 을 세우고 내 팀의 정규시즌 순위 `0xb7aa0(리그, 팀, 1)`(0부터)로
 * **이벤트 401 / 402 / 403** 을 갈라 튼 뒤 **0xef 시즌 결산**으로 넘긴다:
 *   0 → **401** 정규시즌 1위, 한국시리즈 직행 (인기도 +15 · 평판 +20 · 소지금 +30)
 *   1~3 → **402** 4위 이내, 플레이오프 (인기도 +10 · 평판 +10 · 소지금 +10)
 *   4 이상 → **403** 플레이오프 탈락 (인기도 −5 · 평판 −20)
 * 갈림은 `entities/season-mode` 의 `regularSeasonRankEventId` 가 가진다 (보상 적용은 부르는 쪽 몫).
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ⚠️ **화면 그림에 대한 판단**: R13 1절 표에서 **0xf0 의 그리기는 `0x9ff0` → 공통 틀** 이다 —
 * 순위표를 그리지 않고, 순위는 이어지는 이벤트 401~403 대사로만 알려 준다.
 * 순위표 그림 `0x7f070`(P6 4a-2 확정)을 쓰는 상태는 **0xd8(다음경기)·0xf4** 다.
 *
 * 그래도 "정규시즌 순위" 화면에 순위가 안 나오면 화면이 빈 칸이 되므로, **확정 배치인 0x7f070
 * 순위표**(이미 `widgets/standings` 에 옮겨져 있다)를 깔고 그 위에 내 순위·이벤트 번호를 한 줄
 * 얹었다. 원본과 다른 점은 이 한 가지다.
 *
 * ⚠️ 설명 줄과 확인 단추는 **원본 배치 미해독 — 근사**다 (원본은 커맨드 줄·소프트키가 맡는다).
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
export function RegularSeasonRankScreen({ league, teamId, onNext }: RegularSeasonRankScreenProps) {
  // 0xb7aa0(리그, 팀, 1) 과 같은 값 — 순위는 **0부터**다
  const rank = rankingOf(league).indexOf(teamId)
  const eventId = regularSeasonRankEventId(rank)

  return (
    <RawScreen>
      <StandingsWindow league={league} onClose={onNext} />

      <div className={styles.caption} style={{ left: 0, top: 28, width: 240 }}>
        {`정규시즌 순위 ${rank + 1}위 — 이벤트 ${eventId}`}
      </div>

      <Button variant="corner" className={styles.cornerButton} onClick={onNext}>
        다음
      </Button>
    </RawScreen>
  )
}
