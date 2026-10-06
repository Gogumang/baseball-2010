import { useState } from 'react'
import type { ReactNode } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import {
  hasRecruitedCareerPlayer, hasRecruitedHallOfFamePlayer, recruitPlayer, slotOf,
} from '@/entities/season-mode/model/playerRecruit'
import type { RecruitResult, SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import { SeasonListWindow } from '@/widgets/season/ui/SeasonListWindow'
import type { SeasonListRow } from '@/widgets/season/ui/SeasonListWindow'
import { useSeasonCursor } from '@/widgets/season/model/useSeasonCursor'
import { recruitEntriesOf } from '@/widgets/season/lib/recruitList'
import type { RecruitCandidate, RecruitListInput } from '@/widgets/season/lib/recruitList'

/** StrMODE[181] — 중복 (0xb5054 / 0xb50ac 가 걸릴 때) */
const ALREADY_RECRUITED = '!C이미 영입된 선수 입니다'
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
  /**
   * 원본 후보 목록 — 진입 0xe1dc 가 목록 객체 `[this+0xa8]` 를 **종류 0**(`+0x1fc = 0` · `+0x80 = 0`)으로 0x5eb8c 에
   * 채운다. 미션 선수 고르기(하위 17, 0x2613c)와 같은 명예의 전당 목록이라 앱이 그 화면을 꽂는다. 주면 `list` 대신 이것을
   * 1단계로 그린다 (`RecruitChoice` 를 `choose` 로 넘기면 중복 검사를 하고 자리 고르기로 간다).
   */
  readonly renderCandidates?: (actions: RecruitCandidateActions) => ReactNode
}

/** 목록이 고른 후보 — 키 0xe340 의 결과 코드 1~4 (`[목록+0x12c]`) 와 명전 칸 (`[목록+0x130]`) */
export interface RecruitChoice {
  readonly source: '나리' | '명예'
  readonly isPitcher: boolean
  /** 영입할 기록 — 나리 기록(0x22168 · 0x220ec)은 웹에 아직 없어 null 이다 */
  readonly candidate: RecruitCandidate | null
}

export interface RecruitCandidateActions {
  /** 고른 후보 — 중복이면 StrMODE[181] 글을 돌려준다(목록이 그 자리에서 띄운다), 아니면 자리 고르기로 간다 */
  readonly choose: (choice: RecruitChoice) => string | undefined
  /** 결과 0 → 상태 0xce */
  readonly back: () => void
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
export function PlayerRecruitScreen({ roster, list, rosterNames, onRecruit, onBack, renderCandidates }: PlayerRecruitScreenProps) {
  const [step, setStep] = useState<{ readonly candidate: RecruitCandidate; readonly isPitcher: boolean } | null>(null)
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
  const chosen = step
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
    setStep({ candidate: entry.candidate, isPitcher: entry.isPitcher })
  }

  /**
   * 키 0xe340 (직접 떴다) — 결과 1/2 → `0xb5054(내 팀, 0/1)`, 3/4 → `0xb50ac(내 팀, 0/1, [목록+0x130])` 가 참이면
   * StrMODE[181] 을 0xbbef9(…, 1, 1, 1) 로, 아니면 `this+0x110 = 3` · 상태 0xdf(자리 고르기).
   * ⚠️ 나리 기록(0x22168 · 0x220ec)을 시즌 선수로 옮기는 칸(나리 레코드의 +0 · +0xa)은 아직 안 읽어 나리 후보는 중복 검사까지만
   * 하고 자리 고르기로 가지 않는다.
   */
  const chooseCandidate = (choice: RecruitChoice): string | undefined => {
    const players = choice.isPitcher ? roster.pitchers : roster.batters
    const duplicated = choice.source === '나리'
      ? hasRecruitedCareerPlayer(players)
      : choice.candidate !== null && hasRecruitedHallOfFamePlayer(players, choice.candidate.player.id)
    if (duplicated) return ALREADY_RECRUITED
    if (choice.candidate !== null) setStep({ candidate: choice.candidate, isPitcher: choice.isPitcher })
    return undefined
  }

  const selectSlot = (index: number) => {
    if (chosen === null) return
    const result = recruitPlayer(roster, chosen.candidate.player, chosen.isPitcher, index)
    setStep(null)
    setNotice(RECRUIT_DONE)
    onRecruit(result, chosen.isPitcher)
  }

  const listCursor = useSeasonCursor({
    count: listRows.length,
    onSelect: selectCandidate,
    onCancel: onBack,
    isEnabled: step === null && notice === null && renderCandidates === undefined,
  })
  const slotCursor = useSeasonCursor({
    count: slotRows.length,
    onSelect: selectSlot,
    onCancel: () => setStep(null),
    isEnabled: step !== null && notice === null,
  })

  return (
    <RawScreen>
      {step === null && renderCandidates !== undefined ? (
        renderCandidates({ choose: chooseCandidate, back: onBack })
      ) : step === null ? (
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
