import { Hint, Panel, StatGrid } from '@/shared/ui'
import type { StatEntry } from '@/shared/ui'
import type { PitcherCareer, PitcherSeasonStats } from '@/entities/pitcher-career/model/pitcherCareer'
import { seasonEarnedRunAverageOf } from '@/entities/pitcher-career/model/pitcherCareer'

/**
 * 선수정보 → [기록실] 자리 — 원본 상태 **124**(틀 0x1463c → 0x55864, 그리기 0x16778).
 *
 * ⚠️ **웹판 근사**: 원본 124 는 StrMODE[74] 두 갈래 팝업(0x80)으로 `장면+0x164` 를 정하고 여는
 * **선수 기록 목록**(엔트리 편집기 판 0x5761c/0x5796c, R4 2c)이다. 그 목록 화면이 웹에 없고
 * 두 갈래의 이름도 문서에 없어, 내 투수의 성적 칸만 보여 준다.
 * (타자편 웹이 이 자리에 띄우는 순위표는 원본에서 [다음경기] 쪽 109 의 것이다 — R9 8절 정정.)
 *
 * 성적 칸은 투수 레코드 그대로다: 아웃 +0x20 · 실점 +0x22 · 세이브 +0x24 · 탈삼진 +0x26 ·
 * 투구 수 +0x28 · 승 +0x2e · 패 +0x2f (P1 6절).
 */

interface PitcherRecordPanelProps {
  readonly career: PitcherCareer
}

/** 아웃 카운트 → "N이닝 M" (한 이닝 = 아웃 3) */
function inningsTextOf(outs: number): string {
  return `${Math.trunc(outs / 3)}.${outs % 3}`
}

function entriesOf(stats: PitcherSeasonStats): readonly StatEntry[] {
  return [
    { label: '등판', value: stats.games },
    { label: '승', value: stats.wins },
    { label: '패', value: stats.losses },
    { label: '세이브', value: stats.saves },
    { label: '이닝', value: inningsTextOf(stats.outs) },
    { label: '실점', value: stats.runsAllowed },
    { label: '탈삼진', value: stats.strikeouts },
    { label: '투구', value: stats.pitches },
    { label: '방어율', value: (seasonEarnedRunAverageOf(stats) / 100).toFixed(2) },
  ]
}

export function PitcherRecordPanel({ career }: PitcherRecordPanelProps) {
  return (
    <>
      <Panel heading={`${career.season}년차 성적`}>
        <StatGrid entries={entriesOf(career.stats)} />
      </Panel>
      <Panel heading="통산 성적">
        <StatGrid entries={entriesOf(career.careerStats)} />
        <Hint>방어율은 0xb6ce8 식(실점 × 2700 / 아웃, 9999 상한)을 100 으로 나눈 값이다</Hint>
      </Panel>
    </>
  )
}
