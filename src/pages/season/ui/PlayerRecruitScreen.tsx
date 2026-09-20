import { useState } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import { recruitPlayer, slotOf } from '@/entities/season-mode/model/playerRecruit'
import type { RecruitResult, SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import { SeasonListWindow } from '@/widgets/season/ui/SeasonListWindow'
import type { SeasonListRow } from '@/widgets/season/ui/SeasonListWindow'
import { useSeasonCursor } from '@/widgets/season/model/useSeasonCursor'
import { recruitEntriesOf } from '@/widgets/season/lib/recruitList'
import type { RecruitListInput } from '@/widgets/season/lib/recruitList'

/** StrMODE[181] — 중복 (0xb5054 / 0xb50ac 가 걸릴 때) */
const ALREADY_RECRUITED = '이미 영입된 선수 입니다'
/** StrMODE[179] — 자리 고르기 안내 (상태 0xdf) */
const CHOOSE_SLOT = '영입할 자리를 고르세요'
/** StrMODE[180] — 영입 완료 */
const RECRUIT_DONE = '선수 영입을 완료하였습니다'

export interface PlayerRecruitScreenProps {
  readonly roster: SeasonTeamRoster
  /** 영입 후보 네 갈래 (나리 투수·타자, 명예 투수 4칸·타자 8칸) */
  readonly list: RecruitListInput
  /**
   * 팀 명단에 보일 이름. 원본 선수 레코드의 이름 칸은 아직 안 풀려서
   * 없으면 `투수 N번`·`타자 N번`(칸 번호 `+0xa & 0x1f`)으로 적는다 (**근사**).
   */
  readonly rosterNames?: {
    readonly pitchers: readonly string[]
    readonly batters: readonly string[]
  }
  /** 영입이 끝났다 — 바뀐 로스터와 **고쳐진 원본 기록**(0xb6604 의 부작용)을 함께 넘긴다 */
  readonly onRecruit: (result: RecruitResult, asPitcher: boolean) => void
  /** 취소(−16) — 구단관리(0xce)로 되돌아간다 */
  readonly onBack: () => void
}

/**
 * 선수영입 (장면 0x105 상태 **0xe2** → 자리 고르기 **0xdf** → 확정 `0xc554`).
 * `docs/re/S6-season-cleanup.md` 4절 · `docs/re/R13-season-leftovers.md` 9절 확정.
 *
 * **비용도 인기도 조건도 없다.** 중복 검사만 통과하면 시즌 중 아무 때나 영입할 수 있다.
 *
 * ⚠️ 원본 그대로 옮긴 것:
 *   - 영입은 교체가 아니라 **끼워넣기**다 — 로스터가 한 칸 늘고 밀려난 선수는 맨 끝으로 간다.
 *   - 투수 쪽은 밀려난 선수의 칸 번호를 고쳐 주는 줄이 **빠져 있다** (S6 4-4).
 *   - 확정할 때 저장된 원본 기록의 칸 번호가 실제로 바뀐다 (`withSlot` 의 부작용).
 *
 * ⚠️ **원본 배치 미해독 — 근사**: 0xe340(그리기)의 좌표를 못 찾아 공용 판 목록으로 그린다.
 */
export function PlayerRecruitScreen({ roster, list, rosterNames, onRecruit, onBack }: PlayerRecruitScreenProps) {
  const [step, setStep] = useState<{ readonly cursor: number } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const entries = recruitEntriesOf(list, roster)

  /** 1단계 — 영입 목록 (0xe2) */
  const listRows: readonly SeasonListRow[] = entries.map((entry) => ({
    id: `${entry.cursor}`,
    label: entry.candidate === null ? '- 빈 칸 -' : entry.candidate.name,
    value: entry.source,
    isDisabled: entry.candidate === null,
  }))

  /** 2단계 — 바꿀 자리 (0xdf, this+0x110 = 3) */
  const chosen = step === null ? null : entries[step.cursor]
  const slotPlayers = chosen === null ? [] : chosen.isPitcher ? roster.pitchers : roster.batters
  const slotNames = chosen === null
    ? []
    : chosen.isPitcher ? (rosterNames?.pitchers ?? []) : (rosterNames?.batters ?? [])
  const slotRows: readonly SeasonListRow[] = slotPlayers.map((player, index) => ({
    id: `자리${index}`,
    label: slotNames[index] ?? `${chosen?.isPitcher === true ? '투수' : '타자'} ${slotOf(player) + 1}번`,
    value: `#${index}`,
  }))

  const selectCandidate = (index: number) => {
    const entry = entries[index]
    if (entry === undefined || entry.candidate === null) return
    if (entry.refusal !== null) {
      setNotice(ALREADY_RECRUITED)
      return
    }
    setStep({ cursor: index })
  }

  const selectSlot = (index: number) => {
    if (chosen === null || chosen.candidate === null) return
    const result = recruitPlayer(roster, chosen.candidate.player, chosen.isPitcher, index)
    setStep(null)
    setNotice(RECRUIT_DONE)
    onRecruit(result, chosen.isPitcher)
  }

  const listCursor = useSeasonCursor({
    count: listRows.length,
    onSelect: selectCandidate,
    onCancel: onBack,
    isEnabled: step === null && notice === null,
  })
  const slotCursor = useSeasonCursor({
    count: slotRows.length,
    onSelect: selectSlot,
    onCancel: () => setStep(null),
    isEnabled: step !== null && notice === null,
  })

  return (
    <RawScreen>
      {step === null ? (
        <SeasonListWindow
          title="선수영입"
          rows={listRows}
          cursor={listCursor.cursor}
          onMoveCursor={listCursor.moveTo}
          onSelect={selectCandidate}
          onBack={onBack}
          footer={'나만의리그 육성선수와 명예의 전당 선수를 데려온다\n비용도 인기도 조건도 없다'}
        />
      ) : (
        <SeasonListWindow
          title="자리 고르기"
          rows={slotRows}
          cursor={slotCursor.cursor}
          onMoveCursor={slotCursor.moveTo}
          onSelect={selectSlot}
          onBack={() => setStep(null)}
          footer={`${CHOOSE_SLOT}\n고른 자리의 선수는 맨 끝으로 밀린다 (빠지지 않는다)`}
        />
      )}

      {notice !== null && <MessageBox text={notice} buttons={['확인']} onAnswer={() => setNotice(null)} />}
    </RawScreen>
  )
}
