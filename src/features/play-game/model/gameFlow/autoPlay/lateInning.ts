import type { RandomPort } from '@/shared/api/random/randomPort'
import { runnerCountOf, type BaseState } from '@/entities/game/model/baseState'
import { isBugFixed } from '@/shared/config/bugfixes'
import { runnersBehindCursor } from '@/entities/game/model/baseRunners'
import type { GameState } from '@/entities/game/model/gameState'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/**
 * **자동진행이 멈출 때의 `0xc22b4(sim)`** — 상태 0x21 갱신 `0x48480` 이 `0xc2198(sim, 1)` 거짓(내 차례)을 보면
 * `+0x1784 = 0` · 다음 상태 0x18 을 걸고, **경기 끝(0xb68fc)이 아니면** `0xc0ee8(sim)` → `0xc22b4(sim)` 를 부른다
 * (0x48538~0x48564). `0xc0ee8` 은 명단 확정(0xaebe4)·마선수 칸·카운트 지우기(0xb6764)·플레이 칸 지우기(0xb68bc) —
 * 간이 타석이 타석째로 끝나 웹에서는 이미 그 상태라 할 일이 없고 굴림도 없다. `0xc22b4` 는 **모드 4 만**:
 * ```
 * c22c0  st[1] != 4 → 끝                         ; 나만의리그 타자편만 (팀경기·투수편은 아무것도 안 한다)
 * c22d4  st[0x6b](이닝) < st[0x69](8) → 끝        ; 9회부터
 * c22dc  st[9](공격 측) != 1 → 끝                  ; 말 공격
 * c230a  d = 점수(측 0) − 점수(측 1) ; (u32)d > 3 → 끝   ; 후공이 0~3점 뒤지거나 동점
 * c2310  t = st[6](아웃) + 주자 수 ; t < d → 끝
 * c2318  n = rand(d, t + 1)                       ; 주자 수를 다시 정한다 — r0 은 c230a 의 d 그대로 (d ~ t)
 * c232e  st[6] = max(0, t − n)                    ; 남은 몫이 아웃
 * c2338  0xa9250 주자 지우기
 * c2342  루 i = 0(1루)·1·2: n == 3 − i 이면 세움(n−1) · 아니면 rand(0, n + 1) == 0 일 때 세움(n−1)
 * c237a  0xa9a9c(주자관리, 공격 팀, 수비 팀, 1루, 2루, 3루)  ; 0xa9a10 — 앞선 찬 루부터 바로 앞 타자 · 그 앞 타자 … (굴림 없음)
 * ```
 * 곧 9회 이후 말 공격에서 뒤진(또는 동점) 후공 팀의 내 타석 앞, `아웃 + 주자` 를 주자·아웃으로 다시 나눠
 * 끝내기 판을 차린다. n 이 0 일 때 rand(0, 1) 은 늘 0 이라 주자를 세우고 n 이 −1 이 되는 것까지 원본 그대로다.
 */
/** 경기 상태 초기화 0xb6814 가 `state+0x69`(마지막 정규 이닝, 0-기준)에 넣는 값 — 9회 */
const LAST_REGULAR_INNING_INDEX = 8

/** B-13 고친 길 — 내 타석이 오는 반 이닝의 아웃 상한(3아웃이면 이닝이 끝났다) */
const MAXIMUM_OUTS_BEFORE_MY_AT_BAT = 2

/** 9회 이후 말 공격인가 — 말 공격이 내 차례이므로 우리가 측 1(후공)이다 */
function isLateBottomHalf(game: GameState): boolean {
  return game.inning - 1 >= LAST_REGULAR_INNING_INDEX && game.half === '말'
}

/**
 * c232e st[6] = max(0, t − n) — t 가 5(2아웃 만루)까지라 n 이 작으면 아웃이 3~5 로 선다(원본 버그 B-13).
 * 고친 길은 내 타석 앞 아웃의 상한 2 로 자른다 — 굴림 · 주자 세우기는 원본 그대로다
 */
function lateInningOutsOf(total: number, runners: number): number {
  const outs = Math.max(0, total - runners)
  return isBugFixed('B-13') ? Math.min(MAXIMUM_OUTS_BEFORE_MY_AT_BAT, outs) : outs
}

/** c2342 — 루 i = 0(1루)·1·2: n == 3 − i 이면 세움(n−1) · 아니면 rand(0, n + 1) == 0 일 때 세움(n−1) */
function rollLateInningBases(runners: number, random: RandomPort): BaseState {
  let left = runners
  const placed: boolean[] = []
  for (let base = 0; base <= 2; base += 1) {
    const seated = left === 3 - base || random.rand(0, left + 1) === 0
    placed.push(seated)
    if (seated) left -= 1
  }
  return { first: placed[0] === true, second: placed[1] === true, third: placed[2] === true }
}

/**
 * c237a 0xa9a9c → 0xa9a10(주자관리, 공격 팀 sim+0x74, 수비 팀 sim+0x78, 루표) — 찬 루를 3 → 1 루로 세며 k 번째 루에
 * 공격 팀 지금 타자 칸(team+0x32 = 내 칸)에서 거꾸로 k 번째 타순 칸을 세운다 (`runnersBehindCursor`). 굴림 없음
 */
function withSeatedLateRunners(progress: GameProgress, outs: number, bases: BaseState): GameProgress {
  const game = progress.game
  const seated = runnersBehindCursor(bases, game.battingOrderIndex)
  // 0xa9a10 a9a44 — 새로 세운 주자의 책임 투수(주자+0x30)는 지금 마운드 투수 0xae83d(수비 팀)다
  const pitcher = progress.opponentMound.pitcherSlot
  const pitchers = {
    first: seated.first === null ? null : pitcher,
    second: seated.second === null ? null : pitcher,
    third: seated.third === null ? null : pitcher,
  }
  return { ...progress, game: { ...game, outs, bases, runners: seated }, runnerPitchers: { runners: seated, pitchers } }
}

export function withAutoStopLateInningSetup(progress: GameProgress, random: RandomPort): GameProgress {
  const game = progress.game
  if (!isLateBottomHalf(game)) return progress
  // 측 0 점수 = 상대, 측 1 = 우리
  const deficit = game.opponentScore - game.ourScore
  if (deficit < 0 || deficit > 3) return progress
  const total = game.outs + runnerCountOf(game.bases)
  if (total < deficit) return progress
  const runners = random.rand(deficit, total + 1)
  const outs = lateInningOutsOf(total, runners)
  return withSeatedLateRunners(progress, outs, rollLateInningBases(runners, random))
}
