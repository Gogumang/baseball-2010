import type { RandomPort } from '@/shared/api/random/randomPort'
import { playAutoDefenseAtBat } from '@/features/play-team-game/model/teamGameFlow/autoProgress/autoDefenseAtBat'
import { playAutoOffenseAtBat } from '@/features/play-team-game/model/teamGameFlow/autoProgress/autoOffenseAtBat'
import { relayTickOf } from '@/features/play-team-game/model/teamGameFlow/autoProgress/relayTick'
import { judgeAutoPitcherChange } from '@/features/play-team-game/model/teamGameFlow/substitution/autoPitcherChange'
import { applyCpuPinchHit } from '@/features/play-team-game/model/teamGameFlow/substitution/cpuPinchHit'
import { isOurOffense } from '@/features/play-team-game/model/teamGameFlow/turn/turns'
import type { TeamAutoRelayTick, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * 자동 타석 하나 (간이 엔진, 상태 0x21 — 화면 없이 한꺼번에 굴리는 길) — 교체 틱들(0xc262c 의 c266c)을 다 지나 공을 던질 때까지.
 * 지났다는 표시를 남긴다.
 */
export function playAutoAtBat(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  const battingIsOurs = isOurOffense(progress)
  const ready = runQuickSubstitutions(progress, battingIsOurs, random)
  const played = battingIsOurs ? playAutoOffenseAtBat(ready, random) : playAutoDefenseAtBat(ready, random)
  return played.autoSinceHuman ? played : { ...played, autoSinceHuman: true }
}

/**
 * **0xc262c 한 번** (중계 한 걸음, `stepAutoRelay`) — 머리의 0xc1ba4(CPU 대타 0xc1c50 · CPU 투수 교체 0xc1ce2)가 참이면 공 없이
 * 돌아가는 교체 틱(c266c `bne c2732`), 거짓이면 그 자리에서 타석 하나. 굴림 차례는 `playAutoAtBat` 과 같다 — 걸음 사이의
 * 0xc2198 은 굴리지 않는다. 교체 틱도 상태 0x21 을 지난 것이라 표시(`autoSinceHuman`)를 남긴다.
 */
export function playAutoTick(progress: TeamGameProgress, random: RandomPort, relay: TeamAutoRelayTick[]): TeamGameProgress {
  const battingIsOurs = isOurOffense(progress)
  let played = quickSubstitutionCall(progress, battingIsOurs, random)
  if (played !== progress) {
    relay.push(relayTickOf(played, progress.game, null))
  } else {
    played = battingIsOurs ? playAutoOffenseAtBat(progress, random, relay) : playAutoDefenseAtBat(progress, random, relay)
  }
  return played.autoSinceHuman ? played : { ...played, autoSinceHuman: true }
}

/**
 * 간이 타석 하나 앞의 **교체 판정** — `0xc262c` 가 `0xc1ba4` 를 부르는 모양 그대로다.
 *
 * `0xc1ba4` 는 한 번 불릴 때 CPU 대타 `0xac228`(공격 팀, 0xc1c50)과 CPU 투수 교체 `0xac428`(수비 팀, 0xc1ce2)을
 * **둘 다** 부르고 하나라도 참이면 1 을 돌려준다(0xc1ce6 `orrs`). 그러면 `0xc262c` 는 공을 안 던지고 돌아가고
 * (c266c `bne c2732`), 다음 부름에서 **같은 타석**으로 다시 `0xc1ba4` 를 지난다. 그때 대타를 낸 쪽은
 * `state[0xe]`(ac234), 투수를 바꾼 쪽은 `state[0xd]` 가 서 있어 곧장 빠지지만, **안 바뀐 쪽은 처음부터 다시
 * 판정한다** — 투수만 바뀐 부름 뒤에는 대타 굴림(`rand(0,1000)`)이 한 번 더 돈다. 둘 다 안 바뀌어야 공을 던진다.
 * 두 칸은 공이 나가야(0xa5e14) 내려가므로 이 고리는 많아야 세 번 돈다.
 */
function runQuickSubstitutions(progress: TeamGameProgress, battingIsOurs: boolean, random: RandomPort): TeamGameProgress {
  let current = progress
  for (let call = 0; call < MAXIMUM_QUICK_SUBSTITUTION_CALLS; call += 1) {
    const changed = quickSubstitutionCall(current, battingIsOurs, random)
    if (changed === current) return current
    current = changed
  }
  return current
}

/** 0xc1ba4 한 번 — CPU 대타(공격 팀, 0xc1c50) 뒤 CPU 투수 교체(수비 팀, 0xc1ce2). 아무것도 안 바뀌면 같은 객체 */
function quickSubstitutionCall(progress: TeamGameProgress, battingIsOurs: boolean, random: RandomPort): TeamGameProgress {
  const pinched = applyCpuPinchHit(progress, battingIsOurs, random)
  const changed = judgeAutoPitcherChange(pinched, !battingIsOurs, random)
  return changed === progress ? progress : changed
}

/** `runQuickSubstitutions` 이 도는 상한 — 대타 한 번 · 투수 한 번 · 마지막 빈 부름 */
const MAXIMUM_QUICK_SUBSTITUTION_CALLS = 3
