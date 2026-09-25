import { useState } from 'react'
import { BigResult, Hint, MenuList, Panel, PixelScreen } from '@/shared/ui'
import type { MenuItem } from '@/shared/ui'
import { goalsOf } from '@/entities/mission/model/missionGoal'
import { GoalBar } from '@/entities/mission/ui/GoalBar'
import type { PitchTypeInfo } from '@/shared/config/original/pitchTypes'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import type { AtBatState } from '@/entities/at-bat/model/atBatState'
import { CourseGrid } from '@/pages/pitching/ui/CourseGrid'
import { PitchGradeGauge } from '@/pages/pitching/ui/PitchGradeGauge'

/**
 * 투구 화면. 원작 설명서 <투구 조작>의 세 단계를 그대로 따른다:
 *   1. 구질 선택  2. 코스 선택  3. 투구 결정(게이지)
 *
 * ⚠️ 게이지가 넘겨 주는 것은 **누른 칸 g(0~9)** 하나다 — 원본에는 PERFECT/GOOD/BAD 라는
 * 글자도 판정도 없다 (S5 U-15 확정, 누름 0x50e08). 등급 t = max(g−4, 1) 은 부르는 쪽
 * (`pitcherPitch.pitchGradeOf`)이 원본 자리에서 뽑는다. 나리 투수편 `PitcherGameScreen` 과 같다.
 */
type PitchPhase = '구질' | '코스' | '게이지'

interface PitchingScreenProps {
  readonly run: PitcherRun
  readonly repertoire: readonly PitchTypeInfo[]
  /** 환경설정 [투구] 가 게이지일 때만 3단계 게이지가 뜬다 (설정 +0x2d, 0x3f500) */
  readonly usesGauge: boolean
  readonly atBat: AtBatState
  readonly bannerText: string
  /**
   * 던진다. `gaugeCell` 은 게이지에서 **누른 칸 0~9**(안 눌렀거나 게이지를 안 쓰면 0),
   * `gaugeSettingOn` 은 환경설정 [투구]가 게이지인가다 — 꺼져 있으면 원본이 제구·체력
   * 확률표 0xd896c 로 등급을 뽑는다 (0x4dbac).
   */
  readonly onThrow: (
    type: PitchTypeInfo,
    courseCell: number,
    gaugeCell: number,
    gaugeSettingOn: boolean,
  ) => void
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

  /** 게이지에서 누른 칸 g 를 그대로 넘긴다 (0x50e08 — 칸이 1~9 가 아니면 부르는 쪽이 무시한다) */
  const throwPitch = (gaugeCell: number) => {
    if (pitchType === null) return
    onThrow(pitchType, courseCell, gaugeCell, true)
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
                // 기본 투구 — 게이지 단계가 아예 없고, 등급은 제구·체력 표로 뽑힌다 (0x4dbac)
                onThrow(pitchType, cell, 0, false)
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
          {/* 원본에는 결과 글자가 없다 — 작아지는 원 한 장뿐이라 안내 문구도 붙이지 않는다 (S5 U-15) */}
          <Panel heading="3. 투구 결정" />
          <PitchGradeGauge onPress={throwPitch} />
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
