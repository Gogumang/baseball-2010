import { ACE_BATTER_ROSTER_SLOT } from '@/features/play-game/model/gameAces'
import { rosterSlotAt } from '@/entities/game/model/quickLineup'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { PITCHER_EDITION_MODE } from '@/entities/pitcher-career/model/pitcherRotation'
import { judgeManagerHook } from '@/entities/pitcher-career/model/managerHook'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { inningRunsOf } from '@/features/play-pitcher-game/model/pitcherGameState'
import { enterSceneConfirm, enterSceneHookPassage } from '@/features/play-game/model/sceneConfirm'
import { substitutionEntrySoundIdOf } from '@/features/play-game/model/substitutionScene'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/* ── 타석 준비 ───────────────────────────────────────────────────────────────── */

/**
 * 타석 준비 — 상태 0xe 진입 0x50674 의 **감독 강판 판정**. 강판되면 0x23 으로 빠져 기다리지 않는다.
 * 아니면 0xe 에 서서 사람 OK 를 기다린다 — 돌발 발동 판정(0xe → 0xf 의 메시지 1)과 0xf 진입은 OK 뒤다 (`confirmScene`).
 */
/** 0xb570c(b5768)가 상대 팀 레코드 +2 를 지금 나리 사기로 덮었다 (`PitcherGameProgress.opponentRecordMorale`) */
export function withOpponentRecordTouched(progress: PitcherGameProgress): PitcherGameProgress {
  const morale = progress.options.teamMorale
  return progress.opponentRecordMorale === morale ? progress : { ...progress, opponentRecordMorale: morale }
}

export function prepareAtBat(
  progress: PitcherGameProgress,
  random: RandomPort,
  /** 교체 연출 0x16 뒤의 0xd 인가 — 그러면 0x522d2 가 이전 상태 0x16 을 보고 메시지 0xbc1 의 타석 등장음을 안 낸다 */
  afterSubstitution = false,
): PitcherGameProgress {
  // 사람 장면 상대 타석 — 0xe 그리기 0x4d9ec → 0x35b94(35f70~35fb4)가 공격 팀(상대) 레코드 +2 를 덮는다.
  // 강판(0xe 진입 0x50674 의 506ea 0x504cc 참 → 506fc 0xbcb48(장면+0x18, 0x23))이어도 덮인다(직접 떴다): 0xbcb48 은 다음 상태 칸(+8)만
  // 적어 다음 틀의 0xbc9c8 이 옮기고, 같은 틀의 그리기 표 0xd05a0 은 52f3a 에서 지금 상태 [+0x1c] = 0xe 로 고르므로 0x4d9ec 가 한 번 돈다
  progress = withOpponentRecordTouched(progress)
  const { options } = progress
  const bases = progress.game.bases
  const hook = judgeManagerHook(
    {
      mode: PITCHER_EDITION_MODE,
      role: options.role,
      staminaPercent: staminaPercentOf(progress.stamina),
      reputation: options.reputation,
      runsAllowedThisInning: inningRunsOf(progress.inningRuns, progress.game.inning),
      basesLoaded: bases.first && bases.second && bases.third,
    },
    progress.hookFlags,
    random,
  )
  // 0x16 을 안 거친 0xd 라 48ecc 메시지 0xbc1 → 0x522d2 의 타석 등장음(상대 타자가 142 가 넣은 마타자면 26 · 2·3루 주자 15 · 14).
  // 0xd 는 강판 판정(0xe 진입)보다 앞이라 강판이 나도 낸다
  const atBatEntrySoundId = afterSubstitution
    ? undefined
    : substitutionEntrySoundIdOf({
        isAce: rosterSlotAt(progress.opponentLineup, progress.opponentOrderIndex) === ACE_BATTER_ROSTER_SLOT,
        bases,
      })
  if (hook.hooked) {
    return {
      ...progress,
      // 강판(0xe 진입 0x50674 의 506ea 0x504cc 참 → 506fc 0xbcb48(장면+0x18, 0x23))이어도 앞선 0xd 두 그림(등장음 포함)과
      // 0xe 한 그림(0x4d9ec)은 지난다 — 화면이 이 지나감을 다 센 뒤 강판 창을 세운다(`enterSceneHookPassage`). OK 는 안 받는다
      sceneConfirm: enterSceneHookPassage(atBatEntrySoundId),
      hookFlags: hook.flags,
      managerHookText: hook.userEventIndex,
      atBatPrepared: true,
    }
  }

  // 강판이 아니면 0xe 에 머물러 사람 OK 를 기다린다 (0x532b0) — 그 뒤가 메시지 1 의 돌발 굴림이다.
  return {
    ...progress,
    sceneConfirm: enterSceneConfirm(atBatEntrySoundId),
    sceneConfirmPending: true,
    hookFlags: hook.flags,
    atBatPrepared: true,
  }
}
