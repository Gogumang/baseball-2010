import { useEffect, useState } from 'react'
import { useInGameMenuOpenOnHide, type useInGameMenuState } from '@/features/play-team-game/model/useInGameMenuState'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { liveGameSidesOf, setLiveGameInningIndex, setLiveGameSides } from '@/shared/lib/liveGameState/liveGameState'
import type { MenuOverlay, PitchPhase } from './pitcherGameSceneProps'

/**
 * 전역 경기 상태 +0x6b (`liveGameState`) — 이닝 넘김 0xb6b6c 가 경기 장면에서 그때그때 쓴다. 경기 중 나가기(0x40140)는 이 칸을
 * 안 지우므로 나간 그 이닝이 남는다(투수편 116 이어하기의 감독 글 38 이 본다). 0 으로 두는 것은 경기 셋업 0x3a200(세션)이다.
 * 측별 팀 +0x28(셋업 0xb6bd4) · 점수 +0x7e(득점 0xb6a9c)도 경기 장면이 그때그때 쓴다 — 나간 그때의 값이 남는다
 */
export function useLiveGameState(progress: PitcherGameProgress) {
  const inningIndex = progress.game.inning - 1
  useEffect(() => {
    setLiveGameInningIndex(inningIndex)
  }, [inningIndex])
  const { ourTeamId, opponentTeamId } = progress.options
  const { ourScore, opponentScore, playerSide } = progress.game
  useEffect(() => {
    setLiveGameSides(liveGameSidesOf({ ourTeamId, opponentTeamId }, { ourScore, opponentScore, playerSide }))
  }, [ourTeamId, opponentTeamId, ourScore, opponentScore, playerSide])
}

/** 타석·차례가 바뀌면 1단계로 되돌린다 — 던질 수 있음 · 볼 · 스트라이크가 바뀐 렌더에서 맞춘다 */
export function usePitchPhaseReset(canPitch: boolean, progress: PitcherGameProgress, setPhase: (phase: PitchPhase) => void) {
  const countKey = `${canPitch}:${progress.atBat.balls}:${progress.atBat.strikes}`
  const [seenCountKey, setSeenCountKey] = useState<string | null>(null)
  if (seenCountKey !== countKey) {
    setSeenCountKey(countKey)
    if (canPitch && progress.atBat.balls === 0 && progress.atBat.strikes === 0) setPhase('구질')
  }
}

/**
 * 원본 공용 키 처리 `0x498d4` 의 '\*' — 경기 중 메뉴.
 * ('#' 는 이 모드에서 교체 화면이 아니라 "그만 던지시겠습니까"(StrGAME[104])로 간다 — I-controls 4b.)
 * 단말 일시정지 0x463ac — '*' 가 받는 때이고 하위 창이 없으면 같은 메뉴를 연다
 */
export function useStarKey(menu: ReturnType<typeof useInGameMenuState>, isSceneShowing: boolean, overlay: MenuOverlay | null) {
  useInGameMenuOpenOnHide(menu, !isSceneShowing && overlay === null)
  const { pressStar } = menu
  useEffect(() => {
    if (isSceneShowing) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.key !== '*') return
      // 조작방법 뷰어(경기 중 메뉴 하위 4)의 키는 0x3ca36 이 뷰어 0x637d0 에만 준다 — '*' 도 아무 일 안 한다
      if (overlay === '조작방법') return
      event.preventDefault()
      pressStar()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSceneShowing, pressStar, overlay])
}
