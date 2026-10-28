import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { startPitch } from '@/features/play-pitcher-game/model/pitcherGameFlow/pitch/startPitch'
import { resolveBenchClearing } from '@/features/play-pitcher-game/model/pitcherGameFlow/plays/benchClearing'
import { resolveDefensePlay } from '@/features/play-pitcher-game/model/pitcherGameFlow/plays/resolveDefensePlay'
import type { PitchInput } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/pitchStateTypes'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/**
 * 공 하나를 던진다 (상태 0x10 확정 → 0x11 → 0x12/0x13).
 * 타석이 끝나면 그 자리에서 돌발을 판정하고(0x4e7ca·0x52a8e) 다음 사람 차례까지 민다.
 *
 * ⚠️ 사람이 송구를 조작하는 화면은 이것을 쓰지 않는다 — `startPitch` 로 타석 결과만 먼저 정하고,
 * 화면이 틱을 다 돌린 뒤 `resolveDefensePlay` 로 주자 처리를 먹인다.
 * 여기는 그 둘을 한 줄로 이어 붙인 **얇은 껍데기**다 (끼어들 사람이 없는 자리·테스트용).
 */
export function throwPitch(progress: PitcherGameProgress, input: PitchInput, random: RandomPort): PitcherGameProgress {
  const started = startPitch(progress, input, random)
  // 벤치 클리어링도 끼어들 사람이 없으면 100틱을 다 본 것으로 친다 — 틱 10 의 굴림 8 번까지 나간다
  if (started.pendingBenchClearing !== null) {
    return resolveBenchClearing(started, { reachedTargetTick: true }, random)
  }
  const pending = started.pendingDefensePlay
  if (pending === null) return started
  // 미리 다 돌려 버린다 — `runDefensePlay` 는 스테퍼를 끝까지 도는 얇은 껍데기다.
  // 이 갈래는 아직 아무것도 안 보여 줬으므로 돌린 결과를 그대로 재생거리로 넘긴다 (예전 그대로).
  const result = runDefensePlay(pending)
  return resolveDefensePlay(started, result, random, result)
}
