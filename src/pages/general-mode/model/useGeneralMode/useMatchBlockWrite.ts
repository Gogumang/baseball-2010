import { useEffect, useEffectEvent } from 'react'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { teamGameStartPointOf } from '@/features/play-team-game/model/teamGameFlow'
import type { TeamGameOptions, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { isBugFixed } from '@/shared/config/bugfixes'

/**
 * 블록 쓰기 — 0x30f20 / 0x2a370 이 세운 두 팀·st(경기정보 OK 가 쓸 첫 진행과 같은 것). 차례(`serial`)가 오를 때마다 그때의 경기 옵션으로
 * 세운다. 굴림은 이미 `rolls` 에 있어 난수를 안 먹는다
 */
export function useMatchBlockWrite(
  serial: number,
  gameOptions: TeamGameOptions,
  onMatchBlockWrite: ((block: TeamGameProgress) => void) | undefined,
  random: RandomPort,
) {
  const blockWriteNow = useEffectEvent(() => ({ gameOptions, onMatchBlockWrite, random }))
  useEffect(() => {
    if (serial === 0) return
    // B-30 — 원본은 경기정보 OK 앞에서도 모드 1 블록을 새 경기로 덮어(+0x4d 는 그대로) 이어하기가 있던 채 새로하기 → OK 없이 나가면
    // [최근게임]이 옛 경기 대신 새 1회초 0:0 을 연다. 고친 길(기본)은 OK(0x3136e — `onGameStart`) 전에는 블록을 안 쓴다.
    // 블록 쓰기는 굴림이 없어 난수 차례는 같다(플레이 시간 칸은 다음 쓰기 때 몰아 적힌다)
    if (isBugFixed('B-30')) return
    const { gameOptions: options, onMatchBlockWrite: write, random: port } = blockWriteNow()
    if (write === undefined || options.opponentAces === undefined || options.startingPitcherSlots === undefined) return
    write(teamGameStartPointOf(options, port))
  }, [serial])
}
