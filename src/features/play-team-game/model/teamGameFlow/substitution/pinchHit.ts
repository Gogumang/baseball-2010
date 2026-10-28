import type { RandomPort } from '@/shared/api/random/randomPort'
import { NO_ACE_BATTER } from '@/features/play-team-game/model/teamGameRoster'
import { appendLog } from '@/features/play-team-game/model/teamGameFlow/log/appendLog'
import { enterConfirmWait, substitutionSceneAfter, withCheerRestore } from '@/features/play-team-game/model/teamGameFlow/scene/sceneConfirm'
import { withOurPinchHitter } from '@/features/play-team-game/model/teamGameFlow/substitution/pinchHitterSwap'
import { substituteBatter } from '@/features/play-team-game/model/teamGameFlow/substitution/substituteBatter'
import { isBatterTurn } from '@/features/play-team-game/model/teamGameFlow/turn/turns'
import { BATTING_ORDER_SIZE } from '@/features/play-team-game/model/teamGameFlow/types/constants'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/* ── 대타 (0xaf06c → 0xaebe4 의 +0x291 가지) ──────────────────────────────────── */

/**
 * 지금 올릴 수 있는 우리 벤치 타자의 **명단 칸** — 타순 아홉 칸 뒤가 그대로 벤치다.
 * 칸 수는 원본과 같이 `team+0x28c`(= `ourBenchBatters`)가 정한다.
 */
export function availablePinchHitters(progress: TeamGameProgress): readonly number[] {
  const count = Math.min(progress.ourBenchBatters, progress.ourEntry.length - BATTING_ORDER_SIZE)
  return Array.from({ length: Math.max(0, count) }, (_unused, k) => BATTING_ORDER_SIZE + k)
}

/**
 * `#` 로 **대타** 화면(경기 상태 0xb)을 열 수 있는가 — `canOpenPitcherChange` 와 같은 '#' 가지의
 * 공격 쪽이다 (R4 1a): 경기 상태 0xe·0xf 이고 **벤치 타자 수 `팀+0x28c` > 0**.
 *
 * 원본은 한 경기 대타 횟수를 사람에게 제한하지 않는다 — 벤치가 남아 있는 만큼 낼 수 있다
 * (CPU 대타 `0xac228` 쪽에도 경기당 횟수 제한은 없다 — `state[0xe]` 는 다음 공까지만 막는 칸이다).
 */
export function canOpenPinchHit(progress: TeamGameProgress): boolean {
  if (progress.game.isFinished) return false
  if (!isBatterTurn(progress)) return false
  return availablePinchHitters(progress).length > 0
}

/**
 * **대타를 낸다** — 예약 `0xaf06c(team, k, 0)`(`team+0x291 = 1`, `team+0x293 = 9 + k`)이 서고,
 * 교체 연출(상태 0x16)을 지나 **다음 타석 시작(상태 0xd) 진입 `0x48d50` 이 `0xaebe4(team, 0)`**
 * 으로 확정한다. 여기서는 그 한 줄기를 한 번에 돌린다.
 *
 * 확정 `0xaebe4` 의 대타 가지(`aecac~aedec`) 그대로:
 *   1. 수비 위치 니블을 맞바꾼다 — 나가는 선수가 벤치 자리(0)를, **들어오는 선수가 그 수비 자리**를
 *      받는다 (`aecde~aecfe`: `0xb8e85(옛 타자, pb, 1)` · `0xb8e85(새 타자, pa, 1)`).
 *   2. 명단 두 칸을 맞바꾼다 (`aed02~aed14`).
 *   3. `0xb95b1` 로 뒤를 한 칸 당겨 **빠진 선수를 명단에서 지운다** — 재출장은 없다 (`aed16`).
 *      (원본은 타순별 경기 기록 24바이트도 같이 옮기고 당긴다. 리그 기록표 `leaguePlateAppearances`
 *      는 명단 칸이 든 **로스터 칸**(`TeamEntryBatter.rosterSlot`)으로 쌓으므로 선수를 따라간다.)
 *   4. 벤치 타자 수 `team+0x28c` 를 하나 줄인다 (0 밑으로는 안 간다, `aed9c~aedae`).
 *
 * **볼카운트는 이어받는다** — 원본 그대로다. 상태 0x16 다음이 0xd 인데 그 진입 `0x48d50` 은 이전 상태
 * (`scene+0x28`)가 0x16 이면 카운트 지우기 `0xb6764(state)`(state[4]·[5]·[0x14..0x17]·[0xa4..0xa7] = 0)와
 * 타석 초기화 `0xa5bcc(ctx)` 를 **건너뛴다** (48e94 `cmp r3,#0x16 ; beq 48eb8`). 곧 볼 셋에서 대타를 내면 새 타자가
 * 볼 셋에서 친다. (앞 판은 "0-0 으로 돌아간다" 로 옮겼는데 이 건너뛰기를 안 읽은 것이었다.)
 *
 * 같은 까닭으로 **대타 홈런 칸 `ctx+0x160`** 이 그 타석 동안 살아 있다: 0x16 진입 `0x3d458` 이 대타 예약을 보고
 * `0xa5bf0(ctx, 0)`(3d57e)으로 세우고(공격 팀이 사람일 때만), 다음 0xd 가 안 지운다 → 이 타석의 홈런은 기록 5
 * (`pinchHitHomeRunHalf` · `finishBatterOutcome`).
 *
 * 그 뒤 0xd → 0xe → 메시지 1(돌발 0x8f158) → 0xf 진입 `0x3d954` 를 다시 지난다 (`readyAtBat`, `changePitcher` 와 같은
 * 길) — 사람 공격이라 0x3d954 는 상대 CPU 투수 교체 `0xac428`(3da3e)를 묻는다.
 */
export function pinchHit(
  progress: TeamGameProgress,
  benchIndex: number,
  /** 굴림 없음 — 다시 선 0xe 의 OK 뒤에 돈다 (`confirmScene`) */
  _random?: RandomPort,
): TeamGameProgress {
  if (progress.game.isFinished) return progress
  if (!availablePinchHitters(progress).includes(benchIndex)) return progress
  const swapped = substituteBatter(
    progress.ourEntry,
    progress.ourEntryRecords,
    progress.game.battingOrderIndex,
    benchIndex,
    progress.ourHitBases,
    progress.ourBatterLogs,
  )
  if (swapped === null) return progress

  const changed = appendLog(
    {
      // 4. 벤치 타자 수 −1 · 필살 남은 칸 되돌림 (`withOurPinchHitter`)
      ...withOurPinchHitter(progress, swapped, progress.game.battingOrderIndex),
      // 상태 0x16 → 0xd: 이전 상태가 0x16 이라 0xb6764·0xa5bcc 를 건너뛴다 — 카운트를 그대로 둔다
      atBat: progress.atBat,
      // 0x3d458 → 0xa5bf0(ctx, 0): 사람 공격이라 ctx+0x160 = 1
      pinchHitHomeRunHalf: { inning: progress.game.inning, half: progress.game.half },
      scenePinchHit: {
        serial: (progress.scenePinchHit?.serial ?? 0) + 1,
        by: '사람',
        incomingIsAce: swapped.incoming.aceIndex !== NO_ACE_BATTER,
      },
      // 0x496f0 → 0x16 진입 0x3d458 이 대타 예약을 보고 +0x195c 비트0(마선수면 5) → 0xe 타자 등판음.
      // 3d562 0x668cc 는 확정 앞이라 나가는 타자의 레코드 칸 비트를 공격 측(사람)에 다시 세운다
      substitutionScene: withCheerRestore(
        substitutionSceneAfter(progress, '타자', swapped.incoming.aceIndex),
        progress.game.playerSide,
        progress.ourEntry[progress.game.battingOrderIndex],
      ),
    },
    `${progress.game.inning}회${progress.game.half} 대타 — ${swapped.outgoing.name} → ${swapped.incoming.name}`,
    true,
  )
  // 0x16 → 0xd → 0xe — 사람 OK 를 다시 기다린다 (굴림은 OK 뒤, `confirmScene`)
  return enterConfirmWait(changed)
}

/** 지금 타석이 사람 팀이 대타를 낸 그 타석인가 (`ctx+0x160`) — 반 이닝이 바뀌었으면 이미 지워진 칸이다 */
export function isPinchHitAtBat(progress: TeamGameProgress): boolean {
  const armed = progress.pinchHitHomeRunHalf
  return armed !== null && armed.inning === progress.game.inning && armed.half === progress.game.half
}
