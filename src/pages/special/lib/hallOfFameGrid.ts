import type { AnnalsGridShape } from '@/pages/record/lib/annalsGrid'
import { HALL_OF_FAME_GRID } from '@/pages/special/lib/specialLayout'
import { isBugFixed } from '@/shared/config/bugfixes'

/** 격자를 가르는 데 쓰는 목록 모드 — `ui/SpecialScreen` 의 `HallOfFameMode` 에서 kind · purpose 만 */
export interface HallOfFameGridMode {
  readonly kind: '보기' | '등록' | '선수고르기'
  readonly purpose?: '미션' | '홈런더비'
}

/** 목록을 연 장면 — `ui/HallOfFameFigure` 의 `HallOfFameListOwner` 와 같다 */
export type HallOfFameGridOwner = '메뉴' | '나리' | '시즌'

/**
 * 명전 목록의 격자 [목록+0x134] (진입이 넣는다) — 모두 `vt+0x1c(5열, 줄, 숫자키 꼴 1, 꼴 0x10)` 로 짓고
 * 막힌 칸 표 [+0x28] 의 몇 칸을 0 으로 지운다 (직접 떴다):
 * ```
 * 메인 메뉴 [메뉴+0x74] — 진입마다 다시 짓는다
 *   16 홈런더비  0x25e6c: (5, 2, 1, 0x10) · 막힘 [열] = 칸 5 (셋째 인자 5 를 더해 슬롯 10)      0x25e86~0x25eaa
 *   17 미션      0x2613c: (5, 3, 1, 0x10) · 막힘 [2·열] = 칸 10 (슬롯 10, 안 쓰는 칸)            0x26156~0x26180
 *   27 스페셜    0x25f8c: (5, 3, 1, 0x10) · 막힘 [0] · [열] · [2·열] = 첫 열(나리 0 · 5 · 슬롯 10) · 커서 (1, 0)  0x25fa6~0x25fe8
 * 나리 145 등록 [장면+0x284] — 나리 장면 생성자 0xf684 가 한 번 짓는다
 *   0xf810~0xf85a: (5, 3, 1, 0x10) · 막힘 [2·열] = 칸 10 — 진입 0x1c8ec 는 [목록+0x134] 에 넣고 커서 vt+0x14(0, 0) 만 (0x1ca06~0x1ca2a)
 * 시즌 0xe2 선수영입 [장면+0x9c] — 시즌 장면 생성자 0x3b14 가 한 번 짓는다
 *   0x3d60~0x3d94: (5, 3, 1, 0x10) · 막힌 칸 없음 — 진입 0xe1dc 는 [목록+0x134] 에 넣고 커서 vt+0x14(0, 0) 만 (0xe302~0xe320)
 *   곧 영입 목록은 안 쓰는 칸 10 에도 커서가 선다 (원본 그대로 — B-98, 고친 길은 칸 10 을 막는다)
 * ```
 * 꼴 0x10 이라 가로는 같은 줄 안에서 감고 세로는 끝에서 멈춘다. 옮기기 0x6c445 는 막힌 칸을 같은 방향으로 건너뛴다.
 */
export function hallOfFameGridOf(mode: HallOfFameGridMode, owner: HallOfFameGridOwner): AnnalsGridShape {
  const base = { columns: HALL_OF_FAME_GRID.columns, rows: HALL_OF_FAME_GRID.rows, wrapsColumns: true, wrapsRows: false } as const
  if (mode.kind === '보기') return { ...base, blockedCells: [0, 5, 10] }
  if (mode.kind === '선수고르기' && mode.purpose === '홈런더비') return { ...base, rows: 2, blockedCells: [5] }
  // B-98 고친 길 — 시즌 영입 목록도 나리 145 · 미션처럼 안 쓰는 칸 10 을 막는다. 굴림 없음
  if (owner === '시즌' && !isBugFixed('B-98')) return base
  return { ...base, blockedCells: [10] }
}
