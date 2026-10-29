import { NONE } from '@/entities/fielding/model/fieldingState'
import { OUT_KIND } from '@/entities/fielding/model/outJudgement'
import { NO_RUNDOWN, endRundown } from '@/entities/fielding/model/rundown'
import { runOutJudgement } from '@/features/defense-play/model/defensePlay/judgement/outJudgement'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'
import { pushPlayLog } from '@/features/defense-play/model/playLog'

/**
 * **6b. 아웃 판정 0xb36d0** — 플레이 틱 b43cc~b43ea: 이 플레이의 야수(0xb0c90)가 +0xe0(쥠) 이면 매 틱 vt90 (직접 뜬 것).
 * 플레이 틱 0xb401c 안에서 포구 틱 갈래(b4074~b42ce · 1 절) → 협살 b433c~b4378(2b 절) 바로 뒤다. 그림 N 의 슬롯 2 라 주자 · 야수
 * 자리는 그림 N 의 목록 틱(앞 판 틱의 6 절 이동)이 옮긴 그대로다 — 웹도 이 판 틱의 6 절 이동 **앞**에서 본다.
 * (예전 웹은 6b~6e 를 6 절 이동 뒤에 두어 판정이 한 목록 틱 늦은 자리를 봤다 — 옛 근사를 걷었다)
 * 판정은 갈래마다 **한 번**이다(직접 뜬 것): b42ee 갈래(2b 절 머리의 `arrivalBranch`)는 b42f2 에서, 아니면 협살 시작 b4374 뒤
 * b43da 에서(F+0xe0 안 보고), 그도 아니면 b43cc 의 F+0xe0(쥠) 일 때 b43da 에서. `judgeOut` 은 공을 안 쥐었으면(+0x12c)
 * 어떤 아웃도 안 내므로 F+0xe0 거르개는 따로 두지 않는다. "협살 중이면 판정을 건너뛴다" 는 옛 메모는 틀렸다 —
 * 건너뛰는 것은 b42ee 갈래에서의 협살 시작(2b)이고 판정 자체는 b42f2 에서 돈다.
 */
export function judgeOutsOnPlayTick(s: DefensePlayState, t: TickFrame, arrivalBranch: boolean): void {
  t.judgedKindThisCall = OUT_KIND.NONE
  const outsBeforeSecondJudgement = s.outsAdded
  runOutJudgement(s, t)
  refoldTagOut(s, t, arrivalBranch, outsBeforeSecondJudgement)
  // b4316~b4336 — b42ee 갈래: 협살 중(+0x1f0 ≠ −1)이고 그 주자(0xa9564(+0x1f0))+0x3b(막 닿음)면 협살 종료 0xb26b8
  if (arrivalBranch && isRundownRunnerJustArrived(s)) {
    s.fielders = endRundown(s.fielders)
    s.rundown = NO_RUNDOWN
    pushPlayLog(s.log, () => `${t.tick}틱 협살 종료 — 쫓던 주자가 루에 닿았다 (b4336)`)
  }
}

/**
 * b36dc — 이 판정도 머리에서 state[0x87] = 0 으로 지우고 태그(3)일 때만 1 을 적는다. 쥐기 판정이 낸 아웃의 결과 코드 13 은
 * b4540 에서 이 값을 읽는다 (`runOutJudgement` 주석).
 * b4300~b4314 — b42ee 갈래에서는 결과 2(루 아웃)이고 F+0x3b 면 state[0x87] = 1 을 덧적는다 (b43da 갈래에는 없다)
 */
function refoldTagOut(s: DefensePlayState, t: TickFrame, arrivalBranch: boolean, outsBeforeSecondJudgement: number): void {
  const holderJustArrived = s.fielderArrivals[s.play.ballHolderSlot] === true
  const baseOutFold = arrivalBranch && holderJustArrived && t.judgedKindThisCall === OUT_KIND.BASE
  if (t.grabOutThisTick) {
    s.tagOut = t.judgedKindThisCall === OUT_KIND.TAG || baseOutFold
    return
  }
  if (baseOutFold && s.outsAdded > outsBeforeSecondJudgement) s.tagOut = true
}

function isRundownRunnerJustArrived(s: DefensePlayState): boolean {
  return s.rundown.runnerIndex !== NONE && s.runners[s.rundown.runnerIndex]?.arrivedThisListTick === true
}
