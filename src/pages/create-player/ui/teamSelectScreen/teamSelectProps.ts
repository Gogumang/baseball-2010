import type { ReactNode } from 'react'
import type { ScreenFrameTitle } from '@/widgets/screen-frame/lib/screenFrameLayout'
import type { AnnalsGridShape } from './otherSlices'

export interface TeamSelectScreenProps {
  /** 히든 팀(10~14) 해금 기록 — 전역 기록 +0x70+idx 자리다 */
  readonly openedHiddenIds?: readonly number[]
  /** 머리띠 제목 — 같은 화면을 여러 모드가 빌려 쓴다 (나만의리그·시즌모드·일반모드) */
  readonly title?: ScreenFrameTitle
  /** 머리띠 G포인트 — 들고 있는 곳에서만 넘긴다 */
  readonly gamePoint?: number
  /**
   * 격자 꼴 — 안 넘기면 `TEAM_GRID_SHAPE`(5×3 · 꼴 0x10: 가로는 같은 줄 안에서 감고 세로는 끝에서 멈춘다).
   * 나만의리그 0x65 · 시즌 0xca · 트레이드 0xe4 · 일반모드 18·19 가 모두 이 꼴이다(셋업 주소는 `TEAM_GRID_SHAPE`).
   */
  readonly gridShape?: AnnalsGridShape
  readonly onSelect: (teamId: number) => void
  /**
   * 잠긴 히든 칸에서 확인했다 — 안 주면 잠긴 칸은 확인을 안 받는다. 시즌 팀 고르기 0xca(0x8da4)처럼
   * 잠긴 칸에서도 확인 키로 힌트 팝업을 띄우는 화면이 넘긴다.
   */
  readonly onSelectLocked?: (teamId: number) => void
  /**
   * 열린 히든 팀(10~14)도 고를 수 있는가 — 안 넘기면 참. **나만의리그 101(0x14114)은 거짓**이다: 격자 줄 [+0x10] == 2 면
   * 열렸든 잠겼든 등록 0x66 으로 안 가고 힌트 팝업을 띄운다(14164~1416a) — 그때는 `onSelectLocked` 로 넘긴다.
   */
  readonly hiddenTeamsSelectable?: boolean
  readonly onCancel: () => void
  /** 화면 위에 얹을 팝업 — 같은 무대(RawScreen) 맨 위에 그린다 */
  readonly overlay?: ReactNode
  /**
   * 어둡게 덮는 칸 — 공용 목록 0x63b14 의 마지막 인자(칸 그리기 0x7a570 넷째 인자). 시즌 트레이드 0xe4(그림 0xa14c)만 내 팀
   * (s8)SR[1] 을 넘기고 그 밖(0xca 등)은 −1 이다. `TEAM_COVER_STEP` 참고.
   */
  readonly coveredTeamId?: number
  /** 처음 커서 칸 — 안 주면 0 (격자 vt+0x14(0, 0)). 일반모드 19 진입 0x23e70 은 (0, 1) = 팀 5 로 둔다 */
  readonly initialCursor?: number
  /**
   * 들어올 때 연출을 도나 — 공용 목록 0x63b15 의 넷째 인자. 0 이면 0x63bd8~0x63be0 이 머리띠 미끄러짐([skin+0x84])과
   * 격자 열림 애니([skin+0xe8])를 끈다. 일반모드 18 ↔ 19 끼리 넘어올 때만 0 이다(0x2de7e · 0x2ddf2). 안 주면 참
   */
  readonly isEntryAnimated?: boolean
}
