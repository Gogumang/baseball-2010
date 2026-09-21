import { Button, RawScreen } from '@/shared/ui'
import type { PostseasonSeries } from '@/entities/league/model/league'
import { SEASON_END_CHAIN, SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { PostseasonBracketWindow } from '@/widgets/season/ui/PostseasonBracketWindow'
import * as styles from '@/widgets/season/ui/SeasonEndWindow.css'

export interface PostseasonStartScreenProps {
  /** 정규시즌이 끝나고 짜인 대진 (`entities/league` 의 `startPostseason` 결과) */
  readonly series: PostseasonSeries | null
  /** 확인 — 다음은 **타자시상 0xeb** 다. 그 사이에 이벤트 392 가 먼저 뜬다 (0xd3) */
  readonly onNext: () => void
}

/** 0xee 가 트는 이벤트 — 392 "정규시즌 종료, 올해 목표 확인" (P4 2b 표) */
const STEP = SEASON_END_CHAIN.find((step) => step.state === SEASON_SCENE_STATE.포스트시즌시작)

/**
 * 포스트시즌 시작 (장면 0x105 상태 **0xee**, 갱신 `0x6d6c` — P4 1a·2b).
 *
 * 마지막 정규시즌 경기 뒤 리그가 포스트시즌(SR+0xb4)으로 넘어가 경기수가 0 이 되면
 * `0xe9`(관중·수입) → **0xee** 로 온다. 하는 일은 `phase = 0xb` 를 세우고 **이벤트 392**
 * (올해의 목표 확인, SYS(1,8))를 튼 뒤 **0xeb 타자시상**으로 넘기는 것이다.
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ⚠️ **대진표 자리에 대한 판단 (문서가 서로 다르다 — 판단하고 진행했다)**
 *
 * R13 1절의 그리기 표는 **0xee → `0xa008` → 공통 틀**, **0xef → `0xb7b8` → 대진표 0x853ac** 로
 * 적는다. 즉 원본에서 대진표를 그리는 상태는 **0xef(시즌 결산)** 하나뿐이고 0xee 는 공통 틀이다.
 * 그런데 이 화면을 요청한 작업 지시는 대진표를 0xee 에 붙이라고 했다.
 *
 * → **둘 다 대진표를 그리게 두었다.** 대진표 위젯은 `widgets/season` 에 있어 두 화면이 함께 쓰고,
 *   `SeasonSummaryScreen`(0xef) 은 R13 대로 같은 대진표 + 우승 팝업을 그린다.
 *   0xee 쪽이 원본과 다르다는 것만 여기 적어 둔다 — 고칠 때는 이 화면에서 대진표만 빼면 된다.
 *
 * ⚠️ **원본 배치 미해독 — 근사**: 아래 설명 줄과 확인 단추는 원본에 없다(원본은 상태판·커맨드 줄과
 * 소프트키가 맡는다). 대진표 자체의 좌표는 P6 4a-1 **확정값**이라 근사하지 않았다.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
export function PostseasonStartScreen({ series, onNext }: PostseasonStartScreenProps) {
  return (
    <RawScreen>
      <PostseasonBracketWindow series={series} />

      <div className={styles.caption} style={{ left: 0, top: 276, width: 240 }}>
        {`포스트시즌 시작\n올해의 목표 확인 (이벤트 ${STEP?.eventId ?? 392})`}
      </div>

      <Button variant="corner" className={styles.cornerButton} onClick={onNext}>
        다음
      </Button>
    </RawScreen>
  )
}
