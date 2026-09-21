import { useState } from 'react'
import { TeamSelectScreen } from '@/pages/create-player/ui/TeamSelectScreen'
import { PitcherRegisterScreen } from '@/pages/pitcher-league/ui/PitcherRegisterScreen'
import type { PitcherRookieProfile } from '@/entities/pitcher-career/model/pitcherRegistration'

/**
 * 투수편 선수 만들기 흐름 — **0x65 팀 고르기 → 0x66 등록 → 0x67 확인** (C-4 확정,
 * 상태 번호로는 101 → 102 → 103 이고 102 에서 취소하면 101 로 되돌아간다, R9 2c 표).
 *
 * 팀 고르기 화면은 타자편과 **같은 화면**이라 `create-player` 의 `TeamSelectScreen` 을 그대로 쓴다
 * (원본도 한 함수 0x63b15 의 k=0 이다). 확인 상자는 등록 화면이 스스로 얹는다.
 */

interface PitcherCreateFlowProps {
  /** 히든 팀(10~14) 해금 기록 — 전역 기록 +0x70+idx */
  readonly openedHiddenIds?: readonly number[]
  readonly onCreate: (name: string, profile: PitcherRookieProfile) => void
  /** 팀 고르기에서 되돌아가기 */
  readonly onCancel: () => void
}

export function PitcherCreateFlow({ openedHiddenIds = [], onCreate, onCancel }: PitcherCreateFlowProps) {
  const [teamId, setTeamId] = useState<number | null>(null)

  if (teamId === null) {
    return (
      <TeamSelectScreen title="나만의리그투수편" openedHiddenIds={openedHiddenIds} onSelect={setTeamId} onCancel={onCancel} />
    )
  }
  return (
    <PitcherRegisterScreen
      teamId={teamId}
      onCreate={(name, profile) => onCreate(name, { ...profile, teamId })}
      onCancel={() => setTeamId(null)}
    />
  )
}
