import type { ReactNode } from 'react'
import { PlayerRecruitScreen } from '@/pages/season'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { EMPTY_COLLECTION } from '@/entities/collection/model/collection'
import { HallOfFameScreen } from '@/pages/special/ui/SpecialScreen'
import { isHallOfFameRecord, slotOf } from '@/entities/season-mode/model/playerRecruit'
import { withEntryCells } from '@/app/ui/seasonRoute/entryCells'
import { hallOfFameRecruitsOf, nariRecruitOf } from '@/app/ui/seasonRoute/hallOfFameRecruits'
import type { SeasonBranchInput } from '@/app/ui/seasonRoute/branchInput'

export function recruitBranch({
  scene,
  state,
  session,
  actions,
  roster,
  hallOfFame,
  nari,
  nariRecords,
  onHallOfFameRecruit,
  backToTeamMenu,
}: SeasonBranchInput): ReactNode {
  if (scene !== SEASON_SCENE_STATE.선수영입 && scene !== SEASON_SCENE_STATE.선수고르기) return null
  const recruits = hallOfFameRecruitsOf(hallOfFame)
  const careerPitcher = nariRecruitOf(nariRecords?.투수, true)
  const careerBatter = nariRecruitOf(nariRecords?.타자, false)
  return (
    <PlayerRecruitScreen
      teamId={state.record.teamId}
      roster={roster}
      {...withEntryCells(session.entryCellSourceOf(state.record.teamId))}
      // 자리 고르기 0xdf 목적 3 은 내 팀 레코드 차례(투수는 로테이션으로 섞인 차례) — 고른 칸 k 를 명단 첨자로
      pitcherRecordOrder={session.pitcherRecordOrder}
      gamePoint={session.gamePoints}
      // 영입 후보는 나만의리그 선수·명예의 전당에서 온다. 명예의 전당은 기록연감 칸(c3e66c1)에서 싣는다.
      // 나리 두 칸(0x22168·0x220ec — 투수편·타자편 저장의 내 선수)은 그 기록을 id 0xfe 선수로 통째 옮긴다
      list={{ careerPitcher: careerPitcher, careerBatter: careerBatter, ...recruits }}
      // 진입 0xe1dc: 목록 객체 [this+0xa8] 를 종류 0(+0x1fc = 0 · +0x80 = 0)으로 0x5eb8c 에 채우고 키 0xe340 이
      // 0x62569(목록, 키, 0) — 미션 선수 고르기(하위 17)와 같은 명예의 전당 목록이다. 빈 칸 StrCOMMON[38]/[39] ·
      // 잠긴 칸 [45]/[54](🌐) 는 목록이 띄운다.
      // 그리기 0xa10c: 공용 목록 0x63b15(…, 6, 1, [this+0x2c], −1) — 미션 선수 고르기(하위 17, 0x2dec8)와 같은 k 6 —
      // 뒤에 머리띠 0x7f4ec. 머리띠는 공통 앞그림 0xb810 이 0xe2 에서 기본 갈래 0x7f53c(hdr, 10, 5, 0) 로 세운 "시즌모드"
      // (+ G포인트 · 되돌아가기)라 미션(제목 11)·스페셜과 다르다.
      // 바탕은 공통 앞그림 0xb810 의 공 무늬 0x5fd61 이다(미션 하위 17 은 메뉴 바탕 0x58371) — backdrop="공무늬".
      // 상태 0xe2 덧그림 0xe9ac(ef9a~efa6) 0x669c0 → 0x65e80 은 명전 하위 17 · 27(0x32dd8 32e16) · 나리 145(0x16a34)와 같은 함수다 —
      // 목록 +0x298 투수 그림을 54×75 이미지 [0x1552ae0] 로 떠 두는 몸 그림이라 `HallOfFameScreen` 의 `useHallOfFameFigure`
      // (capturesImage 참, listOwner 시즌)가 이미 그린다 (f5aee7bd, `pages/special/lib/hallOfFameFigure`). A-12 정정
      renderCandidates={({ choose, back }) => (
        <HallOfFameScreen
          frame={{ title: '시즌모드', gamePoint: session.gamePoints }}
          backdrop="공무늬"
          // 목록 애니 칸은 목록 주인별 모듈 값 — 시즌 선수영입 목록 (f5aee7b)
          listOwner="시즌"
          collection={hallOfFame ?? EMPTY_COLLECTION}
          mode={{
            kind: '선수고르기',
            nari: nari ?? { 투수: null, 타자: null },
            onPick: (pick) => {
              const isPitcher = pick.side === '투수'
              if (pick.hallOfFameIndex === null) {
                return choose({ source: '나리', isPitcher, candidate: isPitcher ? careerPitcher : careerBatter })
              }
              const list = isPitcher ? recruits.hallOfFamePitchers : recruits.hallOfFameBatters
              return choose({ source: '명예', isPitcher, candidate: list[pick.hallOfFameIndex] ?? null })
            },
            onCancel: back,
          }}
          onBack={back}
        />
      )}
      onRecruit={(result, asPitcher) => {
        // 원본은 밀려난 선수를 빼지 않고 **끼워넣는다**(B-22 — 고친 길은 교체) — 그 규칙은 recruitPlayer 안에 있다
        actions.updateRoster(result.roster)
        // c578 0xb6605 — 명전 칸 영입이면 명전 기록 +0xa 아랫 5비트도 고른 자리로 (나리 칸 기록은 저장 안 됨)
        if (isHallOfFameRecord(result.source)) {
          onHallOfFameRecruit?.(asPitcher ? '투수' : '타자', result.source.id, slotOf(result.source))
        }
      }}
      // [180] 팝업(0x19)을 닫으면 0xce — 0x6fe0 (예전에는 영입하자마자 나가 팝업이 안 보였다)
      onDone={backToTeamMenu}
      onBack={backToTeamMenu}
    />
  )
}
