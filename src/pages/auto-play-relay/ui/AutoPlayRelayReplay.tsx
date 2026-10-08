import { useRef, useState } from 'react'
import type { MissionAutoRelayStep } from '@/entities/mission/model/missionAutoRelay'
import { AutoPlayRelayScreen } from '@/pages/auto-play-relay/ui/AutoPlayRelayScreen'

interface AutoPlayRelayReplayProps {
  /** 이미 굴린 중계 틱들 — 0xc262c 한 번마다 한 칸 */
  readonly steps: readonly MissionAutoRelayStep[]
  readonly sideTeams: readonly [number, number]
  readonly humanSide: 0 | 1
  /** 마지막 칸 다음 틱 — 0xc2198 이 거짓이라 상태 0x18 로 */
  readonly onDone: () => void
  readonly missionBatterName?: string | null
}

/**
 * **굴려 둔 자동진행 중계를 틱마다 한 칸씩 튼다** — 모드 3 · 4(나리 투수편 · 타자편)의 상태 0x21.
 *
 * 모드 ∈ {1, 2, 8, 9} 가 아니면 0x21 갱신 0x48480 은 속도 칸 · 연출 대기 없이 **매 틱** 0xc2198 → 0xc262c 한 번이고, 키 0x3e25c ·
 * 배경음(진입 0x3abf0)도 없다 — 사람이 도중에 바꿀 것이 없어 굴린 결과를 뒤에 틀어도 원본과 한 틱도 안 다르다(사이에 다른 굴림도 없다).
 * 마지막 칸을 그린 다음 틱에 0xc2198 이 거짓을 내 +0x1784 = 0 · 상태 0x18 이다.
 */
export function AutoPlayRelayReplay({ steps, sideTeams, humanSide, onDone, missionBatterName }: AutoPlayRelayReplayProps) {
  const [index, setIndex] = useState(-1)
  /** 틱 콜백이 한 그림 안에 몰려 와도 칸을 하나씩 넘기도록 ref 로 센다 */
  const indexRef = useRef(-1)
  const [done, setDone] = useState(false)
  if (done) return null
  return (
    <AutoPlayRelayScreen
      step={steps[index] ?? null}
      onTick={() => {
        if (indexRef.current >= steps.length) return
        const next = indexRef.current + 1
        indexRef.current = next
        if (next >= steps.length) {
          setDone(true)
          onDone()
          return
        }
        setIndex(next)
      }}
      sideTeams={sideTeams}
      humanSide={humanSide}
      missionBatterName={missionBatterName}
    />
  )
}
