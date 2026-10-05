import { Button, RawScreen } from '@/shared/ui'
import type { League } from '@/entities/league/model/league'
import { StandingsWindow } from '@/widgets/standings/ui/StandingsWindow'
import { useSeasonCursor } from '@/widgets/season/model/useSeasonCursor'
import * as styles from '@/widgets/season/ui/SeasonEndWindow.css'

export interface NextGameScreenProps {
  /** 시즌 리그 `SR+0x80` — 순위표가 그대로 그린다 */
  readonly league: League
  /** 확인(−5 · '5') — 포스트시즌이면 결산 0xef, 아니면 경기 쪽(0xd7 → 0xdd → 경기) */
  readonly onConfirm: () => void
  /**
   * 취소(−16) — **이전 상태가 관리 메뉴(0xc9)일 때만** 관리 메뉴로 돌아간다(0x48ea).
   * 그 밖(경기 뒤 홀수 경기·저장에서 바로 들어옴)에는 아무 일도 없다 — 부르는 쪽이 가른다.
   */
  readonly onCancel: () => void
}

/**
 * 다음경기 (장면 0x105 상태 **0xd8**) — 들어옴 `0x4cb8` · 키 `0x48d0` · 그림 `0xae24` (P4 1a · R13 1절).
 *
 * ```
 * 그림 0xae24:  0x7f070(gfx, SR ? SR+0x80 : 0)   ; 리그 순위표 (P6 4a-2, widgets/standings)
 *               0x7f4ec(gfx)                      ; 바탕
 * 키   0x48d0:  −5 · '5'(0x35) → SR+0xb4(포스트시즌) ? 0xef : (this+0x11c = 1, 0xd7 선수단)
 *               −16            → 이전 상태 == 0xc9 이면 0xc9
 *               그 밖          → [this+0x90] 객체 vtable+0x18 로 넘긴다 (아래 — 보이는 일이 없다)
 * ```
 * **`[this+0x90]` = 1×1 격자 커서 객체** (직접 떴다): 장면 생성 0x3cfc 가 `0x6bd7c` 로 만들고(vtable 0xd2e60)
 * 곧바로 `vt+0x10(1, 1, 1, 0, 0)` = 너비 1 · 높이 1 · 키 방식 1 · 플래그 0 · 소리 칸(+0x20) 0 으로 세운다.
 * 들어옴의 `vt+0x14(0, 0)`(0x6c00c)는 커서를 (0, 0) 에 두는 것이고, 키의 `vt+0x18`(0x6c030)은 방향·숫자 키로
 * 커서를 옮기는 공용 격자 처리다 — 1×1 이라 커서가 움직이지 않아 "바뀜" 칸(+0x25)도 안 서고,
 * +0x20 이 0 이라 소리(0x1552d84)도 안 난다. 0xd8 의 그림(0xae24)도 이 커서를 안 읽는다.
 * → **그 밖의 키는 원본에서도 아무 일도 하지 않는다** (웹이 버리는 것과 같다).
 * 곧 이 화면은 **순위표 한 장**이다 — 상대·구장·홈원정 글은 그리지 않는다(공통 틀 0x9f60·
 * 상태판도 안 부른다). 상태별 덧그림 0xef46~0xef98 도 0xd9·0xdc·0xe2 만 본다.
 *
 * ⚠️ **미해결·근사**
 *   - 확인·취소 단추는 원본 소프트키 배치를 안 읽은 근사다 (키 −5·'5'·−16 은 원본 그대로 받는다).
 * *   - 순위표 줄 끝 이미지 106(내 팀 표시로 보임)은 `StandingsWindow` 에 아직 없다(P6 4a-2 조건 미확인).
 */
export function NextGameScreen({ league, onConfirm, onCancel }: NextGameScreenProps) {
  useSeasonCursor({ count: 1, onSelect: onConfirm, onCancel })

  return (
    <RawScreen>
      <StandingsWindow league={league} onClose={onConfirm} />

      <Button variant="corner" className={styles.cornerButton} onClick={onConfirm}>
        확인
      </Button>
      <Button variant="corner" className={styles.cornerButton} style={{ left: 'auto', right: 4 }} onClick={onCancel}>
        취소
      </Button>
    </RawScreen>
  )
}
