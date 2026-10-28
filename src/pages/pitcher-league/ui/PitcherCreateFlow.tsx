import { useState } from 'react'
import { MyLeagueTeamSelectScreen } from '@/pages/create-player/ui/MyLeagueTeamSelectScreen'
import { PitcherRegisterScreen } from '@/pages/pitcher-league/ui/PitcherRegisterScreen'
import type { PitcherRookieProfile } from '@/entities/pitcher-career/model/pitcherRegistration'
import { activeSound } from '@/shared/api/audio/soundPort'

/** 101 팀 고르기 진입 0x10790 의 배경음 — 107a2 `0x6ea6d(소리, 3, −1, 1)` 조건 없이 (모드 준비 배경음) */
const TEAM_SELECT_BGM = 3

/**
 * 투수편 선수 만들기 흐름 — **0x65 팀 고르기 → 0x66 등록 → 0x67 확인** (C-4 확정,
 * 상태 번호로는 101 → 102 → 103 이고 102 에서 취소하면 101 로 되돌아간다, R9 2c 표).
 *
 * 팀 고르기 화면은 타자편과 **같은 화면**이라 `create-player` 의 `MyLeagueTeamSelectScreen` 을 그대로 쓴다
 * (원본도 한 함수 0x63b15 의 k=0 이다). 확인 상자는 등록 화면이 스스로 얹는다.
 */

interface PitcherCreateFlowProps {
  /** 히든 팀(10~14) 해금 기록 — 전역 기록 +0x70+idx */
  readonly openedHiddenIds?: readonly number[]
  readonly onCreate: (name: string, profile: PitcherRookieProfile) => void
  /** 팀 고르기에서 되돌아가기 */
  readonly onCancel: () => void
  /** 머리띠 G포인트 — 전역 G(+0x64). 안 넘기면 0 으로 찍힌다 */
  readonly gamePoint?: number
}

export function PitcherCreateFlow({ openedHiddenIds = [], onCreate, onCancel, gamePoint }: PitcherCreateFlowProps) {
  const [teamId, setTeamId] = useState<number | null>(null)

  if (teamId === null) {
    return (
      <MyLeagueTeamSelectScreen
        side="투수편"
        title="나만의리그투수편"
        openedHiddenIds={openedHiddenIds}
        {...(gamePoint === undefined ? {} : { gamePoint })}
        onSelect={setTeamId}
        onCancel={onCancel}
      />
    )
  }
  return (
    <PitcherRegisterScreen
      teamId={teamId}
      // 머리띠 G — 제목이 있는 머리띠 0x54d95 는 늘 전역 G(+0x64)를 그린다 (0x550d8~0x550de)
      {...(gamePoint === undefined ? {} : { gamePoint })}
      onCreate={(name, profile) => onCreate(name, { ...profile, teamId })}
      // 102 취소(키 0x16f28 171dc~17202 → `0xbcb49(0x65)`)는 101 진입 0x10790 을 다시 지나 3 을 처음부터 튼다 — 웹은 두 상태가
      // 한 화면(투수편 '등록')이라 화면 표가 못 보므로 여기서 튼다 (타자편은 `screenBgm` 의 `restartsTeamSelectBgm`)
      onCancel={() => {
        activeSound().playBgm(TEAM_SELECT_BGM)
        setTeamId(null)
      }}
    />
  )
}
