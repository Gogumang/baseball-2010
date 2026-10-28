import type { RandomPort } from '@/shared/api/random/randomPort'
import { rollCpuPitchTypeOnPitcherChangeTick } from '@/entities/pitching/model/selectPitch'
import { runnerCountOf } from '@/entities/game/model/baseState'
import { withoutStealDisplay } from '@/features/play-team-game/model/teamGameFlow/baseRunning/runners'
import { pitcherRepertoireAt } from '@/features/play-team-game/model/teamGameFlow/roster/pitchers'
import { enterConfirmWait } from '@/features/play-team-game/model/teamGameFlow/scene/sceneConfirm'
import { rollAutoPitcherChange } from '@/features/play-team-game/model/teamGameFlow/substitution/autoPitcherChange'
import { rollCpuPinchHit } from '@/features/play-team-game/model/teamGameFlow/substitution/cpuPinchHit'
import { isHumanTurn, isOurOffense, isPitchTurn } from '@/features/play-team-game/model/teamGameFlow/turn/turns'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * **상태 0xf 진입 `0x3d954`** — 사람 장면에서 공 하나를 고르기 전마다 돈다.
 *
 * 0xf 에 들어서는 길은 넷이다: 0xe 확인(`readyAtBat` — 새 타석, 교체 연출 0x16 뒤, 교체 창 취소 뒤), 인플레이 없이
 * 끝난 공의 다음 공(판정 A `0xae24c` 의 "그 밖 → 0xf" — 볼·스트라이크·파울), 견제 판 끝(판정 B `0xae3e8` 의 ae592),
 * 코스 고르기(0x10)의 CLR(0x50ee6, `returnToPitchSelection`). 그때마다:
 *
 * ```
 * 3d9e4  r2 = (state[0x31 + state[0xa]] == 1)            ; 수비 팀이 CPU 인가
 *   참:  3d9fc  돌발 객체가 있고 0x8eb94(진행 중) 참 → 건너뜀
 *        3da0e  0x66864() 거짓 → 건너뜀                    ; 모드 5·6 의 일부 미션만 거짓 — 팀 경기는 늘 참
 *        3da3e  r0 = 0xac428(…, 수비 팀, …, state, [sp]=ctx, 0, 0, 0)   ; CPU 투수 교체
 *   거짓: 3da44  돌발 진행 중 → 건너뜀
 *        3da70  r0 = 0xac228(…, 공격 팀, 주자관리, state)   ; CPU 대타
 * 3da74  r0 참 → 3da88 소리 0x16("Time!") · 3da94 상태 0x16(교체 연출) 예약
 * ```
 * 0x16 → 0xd(이전 상태 0x16 이라 카운트·타석 초기화·state[0xe] 지우기를 건너뜀, 48e94) → 0xe(OK 를 다시 기다린다)
 * → OK 뒤 `readyAtBat` 을 다시 지난다(돌발 굴림 포함, `confirmScene`). 그때는 바뀐 쪽 막음 칸(state[0xd]·[0xe])이
 * 서 있어 같은 판정이 곧장 빠진다. 이 함수 안에 다른 굴림은 없다(3d954~3ddd6 의 호출을 다 봤다).
 *
 * 0xac428 의 인자는 간이 엔진(0xc1ba4 의 0xc1ce2)과 같다 — 팀 경기 모드(1·2·8·9)에서 `[sp+4]`(모드 3)·`[sp+0xc]`
 * (최소 벤치)가 둘 다 0 이다 — 그래서 `rollAutoPitcherChange` 를 그대로 쓴다.
 */
export function enterPitchSelection(entering: TeamGameProgress, random: RandomPort): TeamGameProgress {
  if (entering.game.isFinished || !isHumanTurn(entering)) return entering
  // 3d966~3d976 — st[0x14..0x17] · st[0xa4..0xa7] = 0 (도루 출발 표시). 돌발 · 교체 묻기(3d9e4~)보다 앞이다
  const progress = withoutStealDisplay(entering)
  // 3d9fc · 3da44 — 돌발 진행 중(0x8eb94 = obj+0xc ≠ −1)이면 두 판정 모두 건너뛴다
  if (progress.burst !== null && progress.burst.current !== null) return progress
  // 3d9e4 — 수비 팀이 CPU(우리 공격)면 투수 교체, 사람(우리 수비)이면 CPU 대타를 묻는다
  return isOurOffense(progress) ? rollCpuPitcherChangeAtSelection(progress, random) : rollCpuPinchHitAtSelection(progress, random)
}

/** 3da3e — 우리 공격: 상대 CPU 투수 교체 0xac428 */
function rollCpuPitcherChangeAtSelection(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  const changed = rollAutoPitcherChange(progress, false, random, true)
  if (changed === progress) return progress
  // 교체를 예약한 그 틱(0xf 틱 0)에도 CPU 조작 0x53850 이 0x644 → 0x344dc 를 한 번 부른다 — 수비가 CPU 일 때만,
  // 내려가는 투수의 구질 목록 · 남은 마구로 (`rollCpuPitchTypeOnPitcherChangeTick`)
  rollCpuPitchTypeOnPitcherChangeTick(
    {
      repertoire: pitcherRepertoireAt(progress, progress.options.opponentTeamId, progress.opponentPitcherIndex),
      magicRemaining: progress.opponentMagicRemaining,
      runnerCount: runnerCountOf(progress.game.bases),
      strikes: progress.atBat.strikes,
      balls: progress.atBat.balls,
    },
    random,
  )
  // 22 → 0x16 → 0xd(지우기 건너뜀) → 0xe(OK 를 다시 기다린다) → OK 뒤 0xf
  return enterConfirmWait(changed)
}

/** 3da70 — 우리 수비: 상대 CPU 대타 0xac228 */
function rollCpuPinchHitAtSelection(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  const changed = rollCpuPinchHit(progress, false, random, true)
  return changed === progress ? progress : enterConfirmWait(changed)
}

/**
 * **코스 고르기 취소** — 상태 0x10(코스 고르기)의 CLR(−16) 가지가 경기 상태를 **0xf** 로 되돌린다
 * (`0x50ee0~0x50ee6` `0xbcb49(…, 0xf)`, OK(−5) 가지는 0x50ed6 의 0x11). 0xf 진입 `0x3d954` 가 다시 돌아
 * 사람 수비면 CPU 대타 `0xac228` 를 한 번 더 묻는다 (돌발 굴림은 0xe 메시지 1 몫이라 없다).
 * 화면이 코스 단계에서 구질 단계로 돌아갈 때 부른다.
 */
export function returnToPitchSelection(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  if (!isPitchTurn(progress) || !progress.atBatPrepared) return progress
  return enterPitchSelection(progress, random)
}
