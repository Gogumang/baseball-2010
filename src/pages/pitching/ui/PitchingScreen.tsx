import { useState } from 'react'
import { BigResult, Hint, MenuList, Notice, Panel, PixelScreen } from '@/shared/ui'
import type { MenuItem } from '@/shared/ui'
import { goalsOf } from '@/entities/mission/model/missionGoal'
import { GoalBar } from '@/entities/mission/ui/GoalBar'
import type { GaugeResult } from '@/entities/pitching/model/pitchCommand'
import type { PitchTypeInfo } from '@/shared/config/original/pitchTypes'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import type { AtBatState } from '@/entities/at-bat/model/atBatState'
import { CourseGrid } from '@/pages/pitching/ui/CourseGrid'
import { PitchGauge } from '@/pages/pitching/ui/PitchGauge'

/**
 * 투구 화면. 원작 설명서 <투구 조작>의 세 단계를 그대로 따른다:
 *   1. 구질 선택  2. 코스 선택  3. 투구 결정(게이지)
 */
type PitchPhase = '구질' | '코스' | '게이지'

interface PitchingScreenProps {
  readonly run: PitcherRun
  readonly repertoire: readonly PitchTypeInfo[]
  /** 환경설정 [투구] 가 게이지일 때만 3단계 게이지가 뜬다 (StrHOWTO[3], [30]) */
  readonly usesGauge: boolean
  readonly atBat: AtBatState
  readonly bannerText: string
  readonly onThrow: (type: PitchTypeInfo, courseCell: number, gauge: GaugeResult) => void
  readonly onGiveUp: () => void
  readonly onFinish: () => void
}

export function PitchingScreen({
  run,
  repertoire,
  usesGauge,
  atBat,
  bannerText,
  onThrow,
  onGiveUp,
  onFinish,
}: PitchingScreenProps) {
  const [phase, setPhase] = useState<PitchPhase>('구질')
  const [pitchType, setPitchType] = useState<PitchTypeInfo | null>(null)
  const [courseCell, setCourseCell] = useState(4)

  const goals = goalsOf(run.mission, run.progress)

  if (run.status !== '진행중') {
    return (
      <PixelScreen title={run.mission.name} leftKey={{ label: '확인', onPress: onFinish }}>
        <GoalBar goals={goals} />
        <BigResult>{run.status === '성공' ? '미션 성공!' : '미션 실패'}</BigResult>
      </PixelScreen>
    )
  }

  const throwPitch = (gauge: GaugeResult) => {
    if (pitchType === null) return
    onThrow(pitchType, courseCell, gauge)
    setPhase('구질')
    setPitchType(null)
  }

  const typeItems: MenuItem[] = repertoire.map((type) => ({
    id: type.name,
    label: type.name,
    detail: `구속 ${Math.round(type.speed * 100)} · 변화 ${Math.round(
      (Math.abs(type.horizontalBreak) + Math.abs(type.verticalBreak)) * 100,
    )}`,
  }))

  return (
    <PixelScreen
      title={run.mission.name}
      badge={remainingBadgeOf(run)}
      rightKey={{ label: '포기', onPress: onGiveUp }}
    >
      <GoalBar goals={goals} />
      <Hint>
        {atBat.balls}볼 {atBat.strikes}스트라이크 {bannerText !== '' && `· ${bannerText}`}
      </Hint>

      {phase === '구질' && (
        <>
          <Panel heading="1. 구질 선택" />
          <MenuList
            items={typeItems}
            onSelect={(id) => {
              const found = repertoire.find((type) => type.name === id)
              if (found === undefined) return
              setPitchType(found)
              setPhase('코스')
            }}
          />
        </>
      )}

      {phase === '코스' && (
        <>
          <Panel heading={<>2. 코스 선택 — {pitchType?.name}</>} />
          <CourseGrid
            selectedCell={courseCell}
            onSelect={(cell) => {
              setCourseCell(cell)
              if (usesGauge) {
                setPhase('게이지')
              } else if (pitchType !== null) {
                // 기본 투구 — 게이지 없이 바로 던진다
                onThrow(pitchType, cell, '사용안함')
                setPhase('구질')
                setPitchType(null)
              }
            }}
          />
          <Hint>노릴 코스를 고르세요 · 존 밖으로 빼려면 가장자리</Hint>
        </>
      )}

      {phase === '게이지' && (
        <>
          <Panel heading="3. 투구 결정">
            <Notice>가운데에서 멈추면 PERFECT — 더 강한 공을 던집니다</Notice>
          </Panel>
          <PitchGauge onThrow={throwPitch} />
          <Hint>누르면 던집니다</Hint>
        </>
      )}
    </PixelScreen>
  )
}

/** 남은 시간·투구 수를 타이틀바 배지로. 제한이 없으면 배지도 없다. */
function remainingBadgeOf(run: PitcherRun): string | undefined {
  const parts: string[] = []
  if (run.remainingSeconds !== null) parts.push(`${Math.ceil(run.remainingSeconds)}초`)
  if (run.remainingPitches !== null) parts.push(`${Math.max(0, run.remainingPitches)}구`)
  return parts.join(' · ') || undefined
}
