import type { OriginalMission } from '@/shared/config/original/missions'
import { missionKeyOf } from '@/entities/mission/model/missionGoal'

/**
 * **이닝별 점수 칸 `st[0x6c + (이닝 mod 9)·2 + 측]`** (s8) — 점수판 0x41c18 이 `0xb6989(st, 이닝, 측)` 으로 읽는다.
 * 측마다 아홉 칸이고 9회를 넘으면 칸을 돌려 쓴다(0xb6988 의 `mod 9`, 0xca911).
 *
 * 쓰는 곳 (직접 재역어셈):
 * ```
 * 0xb6a9c(st, s)        득점 한 점 — 칸[st[0x6b] mod 9][s] ≤ 0x62 면 +1 · 합 st[0x7e + s] ≤ 0x62 면 (앞 합을 +0x85 에 적고) +1
 *                       ; 부르는 곳: 간이 엔진 0xc100a · 0xc109e(s = st[9]) · 경기 0x51408(51a3e · 51fe2)
 * 0xb6b00(st, s)        한 점 빼기 (칸 > 0 이면 칸 · 합 −1) — 0x51408(51a4c)
 * 0xb6a70(st, i, s, v)  칸[i mod 9][s] = min(v, 99) — 미션 준비 0xaa57c(aa61e) · 반 이닝 넘김 0xb6b6c(b6b92 · b6ba0)
 * 0xb6b6c               아웃 > 2 이고 st[9] == 1(말 끝)이면 st[0x6b]++ 뒤 **새 이닝 두 칸을 0 으로**(0xb6a70(st, 이닝, 0/1, 0))
 * ```
 * 미션 준비 0xaa57c aa608~aa64e 는 측 s = 0, 1 마다 이닝 i = 0..8 칸에 레코드 +0x8e + 9·s + i 를 넣고 그 합을 0xb6b44 로 합 칸에 적는다.
 * 시작 이닝 뒤 칸에 값이 든 레코드도 있다(투수 9 · 13 등) — 그 이닝에 들어설 때 0xb6b6c 가 지운다(말 끝 넘김일 때만). 원본 그대로.
 */
export type MissionInningRuns = readonly [readonly number[], readonly number[]]

const INNINGS = 9
/** 0xb6a9c 의 `cmp #0x62; bgt` — 98 이하일 때만 올린다 */
const SCORE_RAISE_LIMIT = 0x62

/**
 * 레코드 +0x8e(측 0 아홉 칸) · +0x97(측 1 아홉 칸) — 원본 표(`base/extracted/Xls*_MISSION.json` 줄 바이트 142~159)에서 옮겨 적었다
 * (생성기는 합만 싣는다 — `start.ourScore` · `start.opponentScore`). 모두 0 인 미션은 뺐다. 열쇠는 `missionKeyOf`.
 */
export const MISSION_START_INNING_RUNS: Readonly<Record<string, MissionInningRuns>> = {
  '타자:3': [[2, 0, 1, 0, 0, 0, 0, 0, 0], [0, 1, 1, 0, 0, 0, 0, 0, 0]],
  '타자:4': [[0, 0, 0, 3, 0, 1, 0, 0, 0], [0, 0, 0, 0, 1, 2, 0, 0, 0]],
  '타자:5': [[0, 1, 4, 0, 0, 0, 0, 0, 0], [2, 0, 2, 0, 0, 0, 0, 0, 0]],
  '타자:12': [[0, 2, 1, 0, 0, 1, 0, 3, 0], [0, 0, 1, 0, 2, 0, 0, 1, 0]],
  '투수:1': [[0, 0, 0, 1, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 2, 0, 0]],
  '투수:2': [[0, 1, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0]],
  '투수:3': [[0, 0, 2, 1, 2, 0, 0, 0, 0], [1, 1, 1, 0, 1, 0, 0, 0, 0]],
  '투수:4': [[0, 1, 6, 0, 0, 0, 0, 0, 0], [0, 3, 2, 0, 0, 0, 0, 0, 0]],
  '투수:7': [[0, 1, 2, 0, 0, 0, 0, 0, 0], [0, 0, 0, 2, 0, 0, 0, 0, 0]],
  '투수:8': [[0, 4, 0, 0, 0, 0, 0, 0, 0], [0, 0, 4, 0, 0, 0, 0, 0, 0]],
  '투수:9': [[0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 3, 0, 0, 0, 0, 0, 0, 0]],
  '투수:11': [[0, 0, 3, 0, 0, 0, 0, 0, 0], [1, 1, 0, 0, 0, 0, 0, 0, 0]],
  '투수:12': [[0, 1, 2, 0, 3, 0, 2, 0, 0], [0, 4, 0, 0, 0, 2, 0, 0, 0]],
  '투수:13': [[0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 1, 0, 1, 0, 0, 0, 0, 0]],
  '투수:14': [[0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 1, 0, 0, 0, 0, 0, 0]],
  '투수:16': [[0, 0, 1, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0]],
  '투수:17': [[0, 0, 1, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0]],
  '투수:18': [[0, 0, 1, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0]],
  '투수:19': [[0, 0, 1, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0]],
  '투수:20': [[0, 0, 1, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0]],
}

const emptyRow = (): number[] => Array.from({ length: INNINGS }, () => 0)

/** 0xaa57c aa608 — 그 미션의 시작 칸 (0xb6a70 이 99 로 자른다) */
export function missionStartInningRunsOf(mission: OriginalMission): MissionInningRuns {
  const rows = MISSION_START_INNING_RUNS[missionKeyOf(mission)]
  if (rows === undefined) return [emptyRow(), emptyRow()]
  return [rows[0].map((runs) => Math.min(runs, 99)), rows[1].map((runs) => Math.min(runs, 99))]
}

const slotOf = (inning: number) => ((inning % INNINGS) + INNINGS) % INNINGS

/** 점수 칸과 합 — 0xb6a9c 를 한 점씩 `runs` 번 */
export interface MissionScoreboard {
  readonly inningRuns: MissionInningRuns
  readonly scores: readonly [number, number]
}

/** **득점 0xb6a9c** 를 `runs` 번 — 지금 이닝 칸과 합을 98 이하일 때만 하나씩 올린다 */
export function scoreMissionRuns(board: MissionScoreboard, inning: number, side: 0 | 1, runs: number): MissionScoreboard {
  if (runs <= 0) return board
  const slot = slotOf(inning)
  const row = [...board.inningRuns[side]]
  const scores: [number, number] = [board.scores[0], board.scores[1]]
  for (let run = 0; run < runs; run += 1) {
    if ((row[slot] ?? 0) <= SCORE_RAISE_LIMIT) row[slot] = (row[slot] ?? 0) + 1
    if (scores[side] <= SCORE_RAISE_LIMIT) scores[side] += 1
  }
  const inningRuns: MissionInningRuns = side === 0 ? [row, board.inningRuns[1]] : [board.inningRuns[0], row]
  return { inningRuns, scores }
}

/** 0xb6b6c b6b92 · b6ba0 — 말이 끝나 이닝이 오르면 새 이닝의 두 칸을 0 으로 */
export function clearMissionInningRuns(inningRuns: MissionInningRuns, inning: number): MissionInningRuns {
  const slot = slotOf(inning)
  const cleared = (row: readonly number[]) => row.map((runs, index) => (index === slot ? 0 : runs))
  return [cleared(inningRuns[0]), cleared(inningRuns[1])]
}
