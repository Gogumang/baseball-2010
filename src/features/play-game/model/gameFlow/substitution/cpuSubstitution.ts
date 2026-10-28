import type { RandomPort } from '@/shared/api/random/randomPort'
import { tryQuickCpuPinchHit, rosterSlotAt } from '@/entities/game/model/quickLineup'
import { runnerCountOf } from '@/entities/game/model/baseState'
import { ACE_BATTER_ROSTER_SLOT } from '@/features/play-game/model/gameAces'
import { changePitcherIfNeeded } from '@/entities/game/model/simulateHalfInning'
import { heldCpuMagicAfterPitcherChange, FRESH_HELD_CPU_MAGIC } from '@/entities/pitching/model/magicPitchGame'
import { freezeRunnerPitchers } from '@/entities/game/model/runnerPitchers'
import { runnersOfGame } from '@/entities/game/model/gameState'
import { chargePitcherLine } from '@/entities/game/model/gamePitcherLines'
import { decisionsAfterPitcherChange } from '@/features/play-game/model/gameDecisions'
import { appendLog } from '@/features/play-game/model/gameFlow/log/appendLog'
import { opponentQuickDefenseOf } from '@/features/play-game/model/gameFlow/quick/quickDefense'
import { withStaminaAt } from '@/features/play-game/model/gameFlow/quick/stamina'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/**
 * 동료 간이 타석 시작의 **CPU 대타** `0xac228` — 공격 팀(우리)을 두고 한 번 물어본다 (`0xc1c50`).
 *
 * 들어오면 그 타순 칸의 이 경기 기록도 들어온 선수 것(벤치라 비어 있다)으로 바뀐다 — 원본은
 * 24바이트 기록을 선수와 함께 옮긴다 (`aed02~aed16`). 그래서 동료 기록(`teammateLogs`)도 그
 * 칸을 비운다.
 */
export function applyOurCpuPinchHit(progress: GameProgress, random: RandomPort): GameProgress {
  if (progress.game.isFinished) return progress
  const slot = progress.game.battingOrderIndex
  const pinch = tryQuickCpuPinchHit(
    progress.ourLineup,
    slot,
    {
      alreadyUsedThisGame: progress.pinchHitUsed,
      runnerCount: runnerCountOf(progress.game.bases),
      // ac23e~ac26e — 타석 타자가 마선수(0xae89c → 0xb633c)면 굴림 없이 안 낸다
      batterIsAce: rosterSlotAt(progress.ourLineup, slot) === ACE_BATTER_ROSTER_SLOT,
    },
    random,
  )
  if (pinch === null) return progress
  const teammateLogs = { ...progress.teammateLogs }
  delete teammateLogs[slot]
  return appendLog(
    {
      ...progress,
      ourLineup: pinch.lineup,
      // state[0xe] = 1 (ac33e) — 다음 공(0xa5e14 a5e7c)이 나갈 때까지 다시 묻지 않는다
      pinchHitUsed: true,
      teammateLogs,
    },
    `${progress.game.inning}회${progress.game.half} ${slot + 1}번 CPU 대타`,
    false,
  )
}

/**
 * 우리 공격 타석 하나를 시작하기 전에 **상대 투수**를 바꿀지 본다 — `0xac428` 한 번.
 *
 * 부르는 자리는 원본 둘이다: 동료 타석(간이 엔진 `0xc1ba4` 의 `0xc1ce2`)과 내 타석 시작
 * (`0x3d954` 의 `0x3da3e` — 수비가 CPU 이고 `0x66864` 가 참일 때. 리그 경기는 미션이 아니라 참이다).
 * 바꾸면 카운터(+0x27c·+0x280·+0x284)가 한꺼번에 0 이 된다 (교체 0xaec64).
 */
export function changeOpponentPitcher(
  progress: GameProgress,
  random: RandomPort,
  /**
   * 경기 장면(내 타석 시작 3da3e)에서 바뀌었는가 — 그러면 세이브 후보 `0xa60c0` 을 잡는다. 3da3e 가 참이면 3da94 에서 0x16 으로
   * 가고, 0x16 진입 0x3d458 이 팀 +0x290/+0x291(0xae9a0)을 보고 +0x195c 를 세운 뒤 0xe 그림 0x38b64 가 메시지 0xbc0 을 보내
   * 0x5227c 가 0xa60c0 을 부른다(그 사이 플레이가 없어 이닝·아웃·주자·점수는 교체 순간과 같다).
   * 동료 타석의 간이 엔진 교체(c1ce2 → c262c)는 c268e~c26b2 가 수비 팀 +0x296 과 함께 `engine[1]` 을 보는데, 경기 장면(3fa06)·
   * 자동진행(3c93a)은 시뮬 초기화 0xc0dac 에 0 을 넘기고(c0e18) 1 은 CPU 끼리 경기 0xc2760(c2858)만 쓴다 — **후보를 안 잡는다**
   * (r114 가 직접 떴다 — 0xa60c0 을 부르는 곳은 0x52284 · 0xc26a2 둘뿐). 세이브는 어차피 +0x64 때문에 기록되지 않는다(S1 4-1).
   */
  inScene: boolean,
): GameProgress {
  if (progress.game.isFinished) return progress
  const before = progress.opponentMound
  const after = changePitcherIfNeeded(opponentQuickDefenseOf(progress), before, {
    // 원본 이닝은 0-기준이다 (state+0x6b)
    inningIndex: progress.game.inning - 1,
    lead: progress.game.opponentScore - progress.game.ourScore,
    runnerCount: runnerCountOf(progress.game.bases),
    inningRunsAllowed: progress.opponentInningRunsAllowed,
    random,
  })
  if (after === before) return progress
  return appendLog(
    {
      ...progress,
      opponentMound: after,
      // 교체 가지 0xaebe4 aec7a `0xae9c4(팀, −1)` — 새 투수는 다음 타석 교대(aeea8)에서 다시 찬다. 공 +0x10 은 그대로
      opponentCpuMagic: heldCpuMagicAfterPitcherChange(progress.opponentCpuMagic ?? FRESH_HELD_CPU_MAGIC),
      // 루에 남은 주자는 책임 투수(주자+0x30)를 그대로 든다 — 모르는 루는 내려가는 투수 몫으로 굳힌다
      runnerPitchers: freezeRunnerPitchers(progress.runnerPitchers, runnersOfGame(progress.game), before.pitcherSlot),
      // 내려간 투수의 +0x2c 는 레코드에 남는다 — 다음 경기(리그 표)로 이어진다
      opponentPitcherStaminas: withStaminaAt(progress.opponentPitcherStaminas, before.pitcherSlot, before.stamina),
      // 그 투수의 투구 수(+0x27c)를 줄에 얹는다 — 교체 0xaec64 가 0 으로 돌린다
      pitcherLines: chargePitcherLine(progress.pitcherLines, progress.opponentTeamId, before.pitcherSlot, {
        pitches: before.pitches,
      }),
      opponentInningRunsAllowed: 0,
      // 교체 자리에서 세이브 후보를 잡는다 (0xa60c0 — 수비 측 = 상대) — 장면 교체만(`inScene`)
      decisions: inScene
        ? decisionsAfterPitcherChange(progress.decisions, progress.game, {
            our: progress.ourMound.pitcherSlot,
            opponent: after.pitcherSlot,
          })
        : progress.decisions,
    },
    `${progress.game.inning}회${progress.game.half} 상대 투수 교체`,
    false,
  )
}
