import { useState } from 'react'
import type { ReactNode } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import {
  hasRecruitedCareerPlayer, hasRecruitedHallOfFamePlayer, recruitPlayer,
} from '@/entities/season-mode/model/playerRecruit'
import { ENTRY_TAB } from '@/entities/season-mode/model/entryEditor'
import { SeasonPlayerPickScreen } from '@/pages/season/ui/SeasonPlayerPickScreen'
import type { RecruitResult, SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import { SeasonListWindow } from '@/widgets/season/ui/SeasonListWindow'
import type { SeasonListRow } from '@/widgets/season/ui/SeasonListWindow'
import { useSeasonCursor } from '@/widgets/season/model/useSeasonCursor'
import { recruitEntriesOf } from '@/widgets/season/lib/recruitList'
import type { RecruitCandidate, RecruitListInput } from '@/widgets/season/lib/recruitList'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'

/** StrMODE[181] — 중복 (0xb5054 / 0xb50ac 가 걸릴 때) */
const ALREADY_RECRUITED = ORIGINAL_MODE_TEXT[181] ?? ''
/**
 * StrMODE[179] "해당 선수가 영입될 위치를 선택합니다" — 0xdf 들어옴 0x5980 이 목적 3 일 때만 `0xbbef9(…, 1, 1, 1)` 로 띄운다
 * (0x5ac2~0x5ae0). 팝업이 떠 있는 동안 목록은 키를 안 받는다(0x6fe0).
 */
const CHOOSE_SLOT = ORIGINAL_MODE_TEXT[179] ?? ''
/** StrMODE[180] "선수 영입을 완료하였습니다" — 0xc5e4 가 팝업 id 0x19 (1, 0x19, 1) 로 띄운다 */
const RECRUIT_DONE = ORIGINAL_MODE_TEXT[180] ?? ''

export interface PlayerRecruitScreenProps {
  /** 내 팀 (SR[1]) — 자리 목록은 `0x1f9a9(저장, 모드, SR[1])` 내 팀 레코드다 */
  readonly teamId: number
  /** 내 팀 명단 (로테이션 전 자리 차례 — 저장의 `roster`) */
  readonly roster: SeasonTeamRoster
  /**
   * 투수 **레코드 칸 k → 명단 첨자** — 팀 레코드의 투수 배열은 경기 준비마다 로테이션 0xb5ca8 로 섞여 있다
   * (세션 `tradeRoster` 와 같은 차례). 자리 목록은 이 차례로 보이고 0xc554 는 레코드 칸 k 에 끼워넣는다. 없으면 같은 차례.
   */
  readonly pitcherRecordOrder?: readonly number[]
  /** 영입 후보 네 갈래 (나리 투수·타자, 명예 투수 4칸·타자 8칸) */
  readonly list: RecruitListInput
  readonly gamePoint?: number
  /**
   * 영입이 끝났다 — 바뀐 로스터와 **고쳐진 원본 기록**(0xb6604 의 부작용)을 함께 넘긴다. 원본은 여기서 저장(0x1fded)하고
   * [180] 팝업을 띄운다 — 화면을 떠나는 것은 그 팝업을 닫은 뒤(`onDone`)다.
   */
  readonly onRecruit: (result: RecruitResult, asPitcher: boolean) => void
  /** [180] 팝업(id 0x19)을 닫았다 — 목록 키 0x6fe0 이 0xce(구단관리)로 보낸다 */
  readonly onDone: () => void
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
  /** 영입할 기록 — 나리 칸은 나리 저장의 내 선수(0x22168 · 0x220ec), 명예 칸은 명전 칸. 저장·칸이 없으면 null */
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
 *
 * 자리 고르기는 원본에서 **공용 선수 고르기 0xdf 의 목적 3**(`this+0x110 = 3`, `entities/season-mode/model/playerPick.ts`)이다 —
 * 시즌정보 선수정보(목적 2)·장착아이템(목적 1)과 같은 상태·같은 목록 창을 쓰고, 목적 3 만 다른 점은: 탭이 영입 후보 종류로
 * 정해지고 '*'(탭 뒤집기)를 목록에 안 넘기며(0x6fe0) · 들어올 때 StrMODE[179] 를 띄우고 · 바닥이 7 이고 · 취소가 0xe2,
 * 확인이 영입 확정 0xc4ea 다. 웹도 목적 1·2 와 같은 `SeasonPlayerPickScreen`(엔트리 목록 창)을 `isRecruitSlot` 으로 꽂는다.
 * 목록은 내 팀 **레코드 차례**(투수는 로테이션으로 섞인 차례)이고 고른 커서가 곧 0xc554 의 레코드 칸 k 다.
 * `docs/re/S6-season-cleanup.md` 4절 · `docs/re/R13-season-leftovers.md` 9절 확정.
 *
 * **비용도 인기도 조건도 없다.** 중복 검사만 통과하면 시즌 중 아무 때나 영입할 수 있다.
 *
 * ⚠️ 원본 그대로 옮긴 것:
 *   - 영입은 교체가 아니라 **끼워넣기**다 — 로스터가 한 칸 늘고 밀려난 선수는 맨 끝으로 간다.
 *   - 투수 쪽은 밀려난 선수의 칸 번호를 고쳐 주는 줄이 **빠져 있다** (S6 4-4).
 *   - 확정할 때 저장된 원본 기록의 칸 번호가 실제로 바뀐다 (`withSlot` 의 부작용).
 *
 * ⚠️ 근사: `renderCandidates` 없이 띄운 1단계(후보 목록)는 공용 판 목록이다 — 앱은 명예의 전당 목록을 꽂는다.
 */
export function PlayerRecruitScreen({
  teamId, roster, pitcherRecordOrder, list, gamePoint = 0, onRecruit, onDone, onBack, renderCandidates,
}: PlayerRecruitScreenProps) {
  const [step, setStep] = useState<{ readonly candidate: RecruitCandidate; readonly isPitcher: boolean } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  /** [180] 이 떠 있다 — 닫으면 0xce */
  const [isRecruited, setRecruited] = useState(false)

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
  /** 레코드 칸 k → 명단 첨자 */
  const rosterPitcherIndexOf = (recordSlot: number): number => pitcherRecordOrder?.[recordSlot] ?? recordSlot
  /** 레코드 차례 명단 — 0x5561c(ed, &팀, …) 가 그리는 그 배열 */
  const recordRoster: SeasonTeamRoster = {
    ...roster,
    pitchers: roster.pitchers.map((player, k) => roster.pitchers[rosterPitcherIndexOf(k)] ?? player),
  }

  /** this+0x110 = 3 · 상태 0xdf — 들어옴 0x5980 이 StrMODE[179] 를 띄운다 */
  const enterSlotStep = (chosenStep: { readonly candidate: RecruitCandidate; readonly isPitcher: boolean }) => {
    setStep(chosenStep)
    setNotice(CHOOSE_SLOT)
  }

  const selectCandidate = (index: number) => {
    const entry = entries[index]
    if (entry === undefined || entry.candidate === null) return
    if (entry.refusal !== null) {
      setNotice(ALREADY_RECRUITED)
      return
    }
    enterSlotStep({ candidate: entry.candidate, isPitcher: entry.isPitcher })
  }

  /**
   * 키 0xe340 (직접 떴다) — 결과 1/2 → `0xb5054(내 팀, 0/1)`, 3/4 → `0xb50ac(내 팀, 0/1, [목록+0x130])` 가 참이면
   * StrMODE[181] 을 0xbbef9(…, 1, 1, 1) 로, 아니면 `this+0x110 = 3` · 상태 0xdf(자리 고르기) — 나리·명예 모두 같다
   * (0xe3f8 · 0xe466 → 0xe472). 나리 기록은 id 0xfe · +0xa 0x80/0xa0 이라 0xb5054(+0xa 부호 비트)에 걸린다.
   */
  const chooseCandidate = (choice: RecruitChoice): string | undefined => {
    const players = choice.isPitcher ? roster.pitchers : roster.batters
    const duplicated = choice.source === '나리'
      ? hasRecruitedCareerPlayer(players)
      : choice.candidate !== null && hasRecruitedHallOfFamePlayer(players, choice.candidate.player.id)
    if (duplicated) return ALREADY_RECRUITED
    if (choice.candidate !== null) enterSlotStep({ candidate: choice.candidate, isPitcher: choice.isPitcher })
    return undefined
  }

  /** 0xc3e8 확인 → 0xc4ea: 자리 = 목록 커서(레코드 칸 k) */
  const selectSlot = (index: number) => {
    if (chosen === null || isRecruited) return
    const rosterIndex = chosen.isPitcher ? rosterPitcherIndexOf(index) : index
    const result = recruitPlayer(roster, chosen.candidate.player, chosen.isPitcher, index, rosterIndex)
    // 0xc4ea~0xc608 — 영입·저장 뒤 [180] (팝업 0x19). 자리 목록(0xdf) 위에 뜬다
    setNotice(RECRUIT_DONE)
    setRecruited(true)
    onRecruit(result, chosen.isPitcher)
  }

  const listCursor = useSeasonCursor({
    count: listRows.length,
    onSelect: selectCandidate,
    onCancel: onBack,
    isEnabled: step === null && notice === null && renderCandidates === undefined,
  })

  const noticeBox = notice === null ? null : (
    <MessageBox text={notice} buttons={['확인']} onAnswer={() => {
      setNotice(null)
      // 0x6fe0 — 팝업 0x19 가 닫히면 0xce
      if (isRecruited) onDone()
    }} />
  )

  // 2단계 — 공용 선수 고르기 0xdf 목적 3: 탭은 후보 종류로 고정(0x5980), '*' 막힘 · 바닥 7 (0x6fe0 · 0xb010)
  if (chosen !== null) {
    return (
      <SeasonPlayerPickScreen
        teamId={teamId}
        roster={recordRoster}
        initialTab={chosen.isPitcher ? ENTRY_TAB.투수 : ENTRY_TAB.타자}
        gamePoint={gamePoint}
        isRecruitSlot
        overlay={noticeBox}
        onPick={(_tab, index) => selectSlot(index)}
        // 0xc3e8 취소 → 목적 3 은 0xe2
        onBack={() => setStep(null)}
      />
    )
  }

  return (
    <RawScreen>
      {/* 공통 앞그림 0xb810 — 0xe2 · 0xdf 는 공 무늬 0x5fd61 을 먼저 깐다 (명전 목록 renderCandidates 는 제 바탕을 깐다) */}
      {renderCandidates === undefined && <SkinBackdrop kind="공무늬" />}
      {renderCandidates !== undefined ? (
        renderCandidates({ choose: chooseCandidate, back: onBack })
      ) : (
        <SeasonListWindow
          title="선수영입"
          rows={listRows}
          cursor={listCursor.cursor}
          onMoveCursor={listCursor.moveTo}
          onSelect={selectCandidate}
          onBack={onBack}
          footer={'나만의리그 육성선수와 명예의 전당 선수를 데려온다\n비용도 인기도 조건도 없다'}
        />
      )}

      {noticeBox}
    </RawScreen>
  )
}
