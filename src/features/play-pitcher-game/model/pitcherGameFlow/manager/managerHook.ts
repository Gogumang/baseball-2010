import { runnersOfGame } from '@/entities/game/model/gameState'
import { freezeRunnerPitchers } from '@/entities/game/model/runnerPitchers'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { advance } from '@/features/play-pitcher-game/model/pitcherGameFlow/auto/advance'
import { rollMyPitcherReplacement } from '@/features/play-pitcher-game/model/pitcherGameFlow/manager/pitcherChange'
import { MY_PITCHER_SLOT } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/constants'
import { appendLog } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/gameLog'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/* ── 강판 ────────────────────────────────────────────────────────────────────── */

/** 스스로 강판 — `#` → StrGAME[104] "그만 던지시겠습니까?" 에 "예" (0x498d4 → 0xc1b48, 상태 0x21) */
export function giveUpPitching(progress: PitcherGameProgress, random: RandomPort): PitcherGameProgress {
  if (!progress.onMound || progress.game.isFinished) return progress
  const replaced: PitcherGameProgress = {
    ...rollMyPitcherLeaving(progress, random),
    // 0xe 에서 물었으면 OK 를 안 받았으니 OK 뒤 굴림(돌발 0x8f158 · 0xf 진입 0x3d954)은 돌지 않는다
    sceneConfirmPending: false,
  }
  return advance(appendLog(replaced, '스스로 강판 — 남은 경기는 자동으로 진행한다', true), random)
}

/**
 * 감독 대사 창(0x23)을 닫는다 — 원본도 확인 키 하나뿐이라 강판을 무를 수 없다 (0x50794).
 * 닫으면 간이 엔진을 켜고 상태 0x21 로 간다.
 */
export function closeManagerHookWindow(progress: PitcherGameProgress, random: RandomPort): PitcherGameProgress {
  if (progress.managerHookText === null) return progress
  // 0x50794 가 0xc1b48 을 부르고 0x21 로 간다
  const replaced: PitcherGameProgress = { ...rollMyPitcherLeaving(progress, random), managerHookText: null }
  return advance(appendLog(replaced, '감독 강판 — 남은 경기는 자동으로 진행한다', true), random)
}

/**
 * 두 강판(0x498d4 · 0x50794)이 함께 지나는 **0xc1b48** — 교체 투수를 굴려 세우고 간이 엔진을 켠다.
 * 루에 남겨 둔 주자는 주자+0x30 이 나라서 들어오면 내 실점이다 (0xa8ee4).
 * 마운드 R[0]·R[1] 은 새 투수의 기록이 되므로 0 부터. (어차피 강판 뒤에는 기록 게이트가 닫힌다)
 */
function rollMyPitcherLeaving(progress: PitcherGameProgress, random: RandomPort): PitcherGameProgress {
  return {
    ...rollMyPitcherReplacement(progress, random),
    onMound: false,
    simpleEngineRunning: true,
    runnerPitchers: freezeRunnerPitchers(progress.runnerPitchers, runnersOfGame(progress.game, progress.opponentOrderIndex), MY_PITCHER_SLOT),
    moundStrikeouts: 0,
    moundStrikeoutCombo: 0,
    atBatPrepared: false,
    atBat: createAtBat(),
  }
}
