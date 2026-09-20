import { useState } from 'react'
import { Button, Notice, RawScreen } from '@/shared/ui'
import { PitcherCreateFlow } from '@/pages/pitcher-league/ui/PitcherCreateFlow'
import { PitchTrainingScreen } from '@/pages/pitcher-league/ui/PitchTrainingScreen'
import { PitcherGameScreen } from '@/pages/pitching/ui/PitcherGameScreen'
import { TEAMS } from '@/shared/config/original/teams'
import type { PitcherLeagueSession } from '@/app/model/usePitcherLeagueSession'
import type { RandomPort } from '@/shared/api/random/randomPort'

interface PitcherLeagueRouteProps {
  readonly session: PitcherLeagueSession
  readonly random: RandomPort
  readonly openedHiddenIds?: readonly number[]
  readonly onExit: () => void
}

/**
 * 나만의리그 **투수편** 라우팅 (원본 게임 모드 3, 장면 0x106).
 *
 * ⚠️ **웹판 임시**: 원본 나리 관리 화면(장면 0x106 의 상태 표 100~145, R9 문서)은 아직 없다.
 *    여기서는 [다음경기]·[구질훈련]·[나가기] 세 칸짜리 임시 메뉴로 대신한다 —
 *    관리 화면이 생기면 이 자리만 갈아 끼우면 된다.
 */
export function PitcherLeagueRoute({ session, random, openedHiddenIds = [], onExit }: PitcherLeagueRouteProps) {
  const { career, scene, gameOptions, actions } = session
  const [isTraining, setIsTraining] = useState(false)

  if (career === null || scene === '등록') {
    return <PitcherCreateFlow openedHiddenIds={openedHiddenIds} onCreate={actions.create} onCancel={onExit} />
  }

  if (isTraining) {
    return (
      <PitchTrainingScreen
        career={career}
        onTrained={(trained) => {
          actions.save(trained)
          setIsTraining(false)
        }}
        onClose={() => setIsTraining(false)}
      />
    )
  }

  if (scene === '경기' && gameOptions !== null) {
    return (
      <PitcherGameScreen
        options={gameOptions}
        random={random}
        onFinish={actions.finishGame}
        onQuit={() => actions.goto('관리')}
      />
    )
  }

  const team = TEAMS[career.teamId]?.name ?? ''
  return (
    <RawScreen>
      {/* ⚠️ 원본 나리 관리 화면이 아직 없어 세운 임시 메뉴다 (위 주석 참고) */}
      <Notice>{`${career.name} · ${team}`}</Notice>
      <Notice>{`${career.season}년차 · ${career.gamesPlayed}경기`}</Notice>
      <Button onClick={actions.beginGame}>다음경기</Button>
      <Button onClick={() => setIsTraining(true)}>구질훈련</Button>
      <Button onClick={onExit}>나가기</Button>
    </RawScreen>
  )
}
