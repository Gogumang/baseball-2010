import { useRef } from 'react'
import { RawScreen } from '@/shared/ui'
import { TEAMS } from '@/shared/config/original/teams'
import { useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import type { MissionAutoRelayStep } from '@/entities/mission/model/missionAutoRelay'
import * as styles from '@/pages/auto-play-relay/ui/AutoPlayRelayScreen.css'

/** "공격팀(%s)" 의 %s — st[0x31 + st[9]] == 0(사람 칸)이면 "PLAYER"(0xd0724), 아니면 "COM"(0xd072c) */
export const OFFENSE_LABEL = { player: 'PLAYER', computer: 'COM' } as const

/** ⚠️ 유력/근사: 띠 · 중계 칸의 y — 원본은 0x94a64 가 잡은 칸(sp+0x8c)의 +0x92 + 0xf · + 0x13 인데 그 칸을 안 읽었다 */
const OFFENSE_BAND_Y = 200
const RELAY_LINE_Y = 222

interface AutoPlayRelayScreenProps {
  /** 이번 자동진행의 중계 틱 (`MissionGame.autoRelay.steps`) — 틱 하나에 한 칸 */
  readonly steps: readonly MissionAutoRelayStep[]
  /** 두 측 팀 (경기[0x28 + 칸] — 0xaa57c 가 세운 사람 칸 · 다른 칸 팀) */
  readonly sideTeams: readonly [number, number]
  /** 사람 칸 (st[0x31 + 칸] == 0 인 측) */
  readonly humanSide: 0 | 1
  /** 0xc2198 이 거짓을 낸 틱 — 상태 0x18 로 넘긴다 (+0x1784 = 0, 미션은 판 없이 곧장 0xd) */
  readonly onDone: () => void
}

/**
 * **자동진행 중계 화면 (경기 장면 상태 0x21)** — 미션(모드 5·6) 갈래. 머리말은 `entities/mission/model/missionAutoRelay`.
 *
 * - 갱신 0x48480: 모드 5·6 은 속도 칸(전역 +0xbc)을 안 보고 **매 틱 0xc262c 한 번**(타석 하나 또는 교체 틱 하나). 마지막 틱 다음 틱에
 *   0xc2198 이 거짓을 내 0x18 로 간다 → `onDone`.
 * - 키 0x3e25c 는 모드 ∈ {1,2,8,9} 에서만 — 미션은 속도 ←→ · CLR 중단 질문(StrGAME[6])이 없다. 배경음 0x21(진입 0x3abf0)도 없다.
 * - 그리기 0x4258c: 작은 다이아몬드 · 투수/포수/타자 그림 · 아래 안내 띠 · 속도 칸 3개는 모드 ∈ {1,2,8,9} && v ≠ 2 에서만이라
 *   미션은 점수판 0x41c18(경기, x, 10, 0) · 두 팀 판 0x420dc · 0x42364(H − 70) · "공격팀(%s)" 띠 + 공격 팀 이름 그림(img_text
 *   `팀 + 0x41`) · 중계 글(sim+0xc4 ≠ 0 일 때만)을 그린다.
 * - 제한 시간은 이 동안에도 흐른다(0xaada4 — 부르는 세션의 타이머가 그대로 돈다).
 *
 * ⚠️ 미해결(그림): 점수판 0x41c18(팀 로고 +0x1054/+0x1058 · 점수 · 이닝)과 두 팀 판(그 자리 0x420dc "PITCHER" · 0x42364 "DUE UP" —
 *    수비 투수 이름 · 다음 세 타자, 좌표 (W/2 − w/2 − 6, H − 70) · (W/2 + 36, H − 70))은 옮기지 않았다 — 웹은 점수 · 이닝 글자를 둔다.
 *    띠 · 중계 칸의 y 도 근사(위 상수). 배경(0x18 판과 같은 운동장 전경)도 안 그린다.
 */
export function AutoPlayRelayScreen({ steps, sideTeams, humanSide, onDone }: AutoPlayRelayScreenProps) {
  const doneRef = useRef(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const tick = useSceneTick((next) => {
    // 틱 n(1부터)은 n 번째 0xc262c — 다 돌면 다음 틱이 0x18
    if (next > steps.length && !doneRef.current) {
      doneRef.current = true
      onDoneRef.current()
    }
  })
  const step = steps[Math.min(tick, steps.length) - 1]
  if (step === undefined) return <RawScreen>{null}</RawScreen>

  const offenseTeam = sideTeams[step.offenseSide]
  const label = step.offenseSide === humanSide ? OFFENSE_LABEL.player : OFFENSE_LABEL.computer
  const teamName = (side: 0 | 1) => TEAMS[sideTeams[side]]?.name ?? ''
  return (
    <RawScreen>
      <div className={styles.scoreLine} data-testid="중계-점수">
        {step.inning + 1}회{step.offenseSide === 0 ? '초' : '말'} {teamName(0)} {step.scores[0]} : {step.scores[1]} {teamName(1)}
      </div>
      <div className={styles.offenseBand} style={{ top: OFFENSE_BAND_Y }} data-testid="중계-공격팀" data-team={offenseTeam}>
        공격팀({label}) {TEAMS[offenseTeam]?.name ?? ''}
      </div>
      {step.line !== null && (
        <div className={styles.relayLine} style={{ top: RELAY_LINE_Y }} data-testid="중계-글">
          {step.line}
        </div>
      )}
    </RawScreen>
  )
}
