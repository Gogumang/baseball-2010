import { Hint, Panel, StatGrid } from '@/shared/ui'
import type { StatEntry } from '@/shared/ui'
import type { PitcherCareer, PitcherSeasonStats } from '@/entities/pitcher-career/model/pitcherCareer'
import { seasonEarnedRunAverageOf } from '@/entities/pitcher-career/model/pitcherCareer'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { RECORD_WINDOW_TABS } from '@/pages/pitcher-league/lib/pitcherManagementMenu'
import * as styles from '@/pages/pitcher-league/ui/PitcherManagementScreen.css'

/**
 * 선수정보 → [기록실] — 원본 상태 **124**(틀 0x1463c → 0x55864, 그리기 0x16778).
 *
 * 106 칸 4 의 팝업 0x80(StrMODE[74] "보고 싶은 기록을 선택해주세요")이 `장면+0x164` 를 정하고,
 * 그 값으로 **두 갈래**가 갈린다 (R9 3절 · R4 2c):
 *   - `+0x164 == 0` → 진입 0x5761c 가 저장에서 팀 레코드를 새로 만들고 **기본 엔트리 목록 창**
 *     (0x5cfec) 을 그린다 — 타자·투수 명단이다.
 *   - `+0x164 != 0` → **나리 판 목록**(0x5796c) — 이름 0xb62c1 · 타율 0xb8e3d · 방어율 0xb6ce9.
 *
 * ⚠️ **웹판 근사**: 두 갈래의 **이름표가 문서에 없고**(R9 "두 갈래의 이름도 문서에 없다"),
 * 0x5796c 의 칸 배치도 미해독이다 (R4 2c "남은 것"). 그래서 갈래 이름은 하는 일로 적었고
 * (`RECORD_WINDOW_TABS`), 칸은 투수편 관례대로 줄로만 세운다.
 * 엔트리 편집(선수 맞바꾸기)은 아직 없다 — 원본 124 는 0x55864 로 편집까지 된다.
 *
 * 성적 칸은 투수 레코드 그대로다: 아웃 +0x20 · 실점 +0x22 · 세이브 +0x24 · 탈삼진 +0x26 ·
 * 투구 수 +0x28 · 승 +0x2e · 패 +0x2f (P1 6절).
 */

interface PitcherRecordPanelProps {
  readonly career: PitcherCareer
  /** 팝업 0x80 이 정한 `장면+0x164` — 0 엔트리 목록 · 1 나리 판 성적 */
  readonly tab: number
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

export function PitcherRecordPanel({ career, tab }: PitcherRecordPanelProps) {
  if (tab === RECORD_WINDOW_TABS.엔트리) return <EntryList career={career} />

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

/**
 * `+0x164 == 0` 갈래 — 기본 엔트리 목록 창(0x5cfec)의 자리.
 * 0x5761c 가 저장에서 팀을 만들 때 **주인공(내 선수)을 넣으므로** 투수 줄 맨 앞에 내 투수를 둔다
 * (R4 2c "이어 0x1fc21/0x1fbd1 로 주인공을 넣은 뒤"). 투수 0번 = 선발이다 (R4 2d).
 */
function EntryList({ career }: { readonly career: PitcherCareer }) {
  const pitchers = [career.name, ...teamPitchers(career.teamId).map((player) => player.name)]
  const batters = teamBatters(career.teamId).map((player) => player.name)

  return (
    <>
      <Panel heading="투수 엔트리">
        <NameRows names={pitchers} />
        <Hint>맨 윗줄(0번)이 선발이다 — 순서 바꾸기는 아직 없다 (원본 0x55864)</Hint>
      </Panel>
      <Panel heading="타자 엔트리">
        <NameRows names={batters} />
      </Panel>
    </>
  )
}

function NameRows({ names }: { readonly names: readonly string[] }) {
  return (
    <div className={styles.pitchList}>
      {names.map((name, index) => (
        <span key={`${name}${index}`} className={styles.entryRow}>
          {index} {name}
        </span>
      ))}
    </div>
  )
}
