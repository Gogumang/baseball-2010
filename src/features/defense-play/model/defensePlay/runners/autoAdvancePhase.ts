import { autoAdvanceDecisions } from '@/entities/fielding/model/autoAdvance'
import { NONE } from '@/entities/fielding/model/fieldingState'
import { HOME_BASE } from '@/features/defense-play/model/defensePlay/constants'
import { startLeg } from '@/features/defense-play/model/defensePlay/runners/mutableRunner'
import { contextAt } from '@/features/defense-play/model/defensePlay/step/defenseContext'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import type { DefensePlayState, MutableRunner } from '@/features/defense-play/model/defensePlay/types/defensePlayState'

/**
 * **4. 자동 추가 진루 (0xaf918)** — 슬롯 2 의 52660 은 `0xaf8c0(제어기, 0)` — **force = 0** 이다(r1 = 0). 그래서 af950 에서 멈춘 주자
 * (vt18 참 — 루에 서 있거나 태그업으로 기다리는 주자)만 보고 달리는 중인 주자는 건너뛴다. force = 1 은 판 시작 0x46766 한 번뿐이다
 * (`startDefensePlay` 끝).
 *
 * **언제 도는가** — 원본 0x5261c~0x52668 (매 틱, 경기 장면 슬롯 2) 을 그대로 옮긴다:
 *   0xae690 = (공격측이 CPU) || (설정+0xbd ≠ 0 = 자동) 이 참이면 돈다.
 *   거짓이어도 플레이+0x111(홈런)·플레이+0x129(폴 홈런)·종류 7(바운드 2루타)이면 그래도 돈다.
 * 곧 **사람이 공격하면서 주루 설정이 수동이면 자동 진루가 통째로 안 돈다.**
 *
 * 정정: 예전 줄은 `경기+0x24`(autoBaserunning)로 이 판단을 막았는데 **원본에는 그런 게이트가
 *    없다** — 0x24 를 읽는 곳은 0x3e0e6·0x521fa 둘뿐이고 둘 다 자동 진루와 무관하다
 *    (`DefensePlayState.autoBaserunning` 칸 주석). 그래서 그 항을 뺐다.
 * +0x111 · +0x129 는 판 끝 결과 코드 8(홈런) · 12(폴 홈런)가 사건 코드 처리 0xb2bc4 에서 세운다(6d 절) — 서면
 * `autoAdvanceDecisions` 가 틱 비교 없이 한 루씩 보낸다. 종류 7 은 코드 10(바운드로 담장을 넘은 2루타)의 0xb0cb8(7)이다.
 */
export function runAutoAdvance(s: DefensePlayState, t: TickFrame): void {
  if (s.play.finished || !isAutoAdvanceOn(s, t)) return
  // `autoAdvanceDecisions` 의 `play.finished` 칸이 원본 +0x111 이다 — 이 진행기의 판 끝 표시가 아니라 홈런 칸을 넣는다
  const decisions = autoAdvanceDecisions({
    ...contextAt(s, t.tick),
    play: { ...s.play, finished: s.homeRunFlag },
    force: false,
    // 앞길 검사 0xa9924 의 방향 판정 0x9fe80 이 보는 +0x84
    previousTargetOf: (index) => s.runners.find((runner) => runner.state.index === index)?.previousTarget ?? NONE,
  })
  for (const decision of decisions) {
    const runner = s.runners[decision.runnerIndex]
    if (runner !== undefined) applyAutoAdvance(s, runner, decision.toBase)
  }
}

function isAutoAdvanceOn(s: DefensePlayState, t: TickFrame): boolean {
  return t.autoBaserunningEnabled || s.homeRunFlag || s.play.suppressed || s.play.kind === 7
}

/**
 * 결정 하나. afa0e 는 죽은 주자(+0x96 — 아웃·득점)에게도 +0x128 = 1 을 세운다. 죽은 주자는 주자 틱이 안 옮기므로 목표만 그대로 둔다.
 * force = 0 이라 결정은 멈춘 주자(= 제 목표 루에 선 주자)에게만 난다 — 예전 `force: true` + "목표 루에 닿아 있을 때만"
 * 근사와 같은 걸러냄이 이제 원본 인자에서 나온다.
 * 타자주자도 다른 주자와 똑같이 보낸다 — 원본엔 결과 코드가 정한 루가 없다(타자주자가 선 루가 곧 루타다,
 * 판 끝 정산 0xa8024). 예전 웹은 타석 결과 코드의 루에서 타자주자를 세웠다 — 결과를 먼저 정한 웹 다리라 걷었다.
 * afa0e: 한 루 더 보내면 플레이+0x128 = 1 — CPU 송구 결정이 다시 고른다
 */
function applyAutoAdvance(s: DefensePlayState, runner: MutableRunner, toBase: number): void {
  const finished = runner.state.isOut || runner.state.scored
  if (!finished && toBase > HOME_BASE) return
  if (!finished) startLeg(runner, toBase)
  s.play = { ...s.play, wantsThrow: true }
}
