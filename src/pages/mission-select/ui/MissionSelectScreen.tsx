import { DialogueBox, Hint, MarkupText, MenuList, Notice, Panel, PixelScreen } from '@/shared/ui'
import type { MenuItem } from '@/shared/ui'
import { useState } from 'react'
import { BATTER_MISSIONS, PITCHER_MISSIONS, missionKeyOf } from '@/entities/mission/model/missionGoal'
import type { OriginalMission } from '@/shared/config/original/missions'
import { popupLabel } from '@/shared/ui/PixelNumber/PixelNumber.css'

/**
 * 미션 선택. 원작 설명서: "타자편, 투수편으로 나누어지며 총 28개의 미션이
 * 준비되어 있습니다." 클리어 기록은 편마다 따로 센다 — 두 편의 미션 번호가 겹친다.
 */
const LISTED_MISSIONS = [...BATTER_MISSIONS, ...PITCHER_MISSIONS]

interface MissionSelectScreenProps {
  readonly clearedKeys: readonly string[]
  readonly initialSide: OriginalMission['side']
  readonly onSelect: (mission: OriginalMission) => void
  readonly onBack: () => void
}

export function MissionSelectScreen({
  clearedKeys,
  initialSide,
  onSelect,
  onBack,
}: MissionSelectScreenProps) {
  // 원작 설명서: "타자편, 투수편으로 나누어지며"
  const [side, setSide] = useState<OriginalMission['side']>(initialSide)
  const missions = side === '타자' ? BATTER_MISSIONS : PITCHER_MISSIONS
  // 저장소에 목록 밖 키가 섞여 있어도 28 을 넘지 않게 목록에 있는 것만 센다
  const listedClearedCount = LISTED_MISSIONS.filter((mission) => clearedKeys.includes(missionKeyOf(mission))).length

  const items: MenuItem[] = missions.map((mission, index) => {
    // 원작: "오픈 되지 않은 미션입니다. 이전 단계를 클리어해주세요"
    const previous = missions[index - 1]
    const isLocked = previous !== undefined && !clearedKeys.includes(missionKeyOf(previous))

    return {
      id: String(mission.id),
      label: `${clearedKeys.includes(missionKeyOf(mission)) ? '★ ' : ''}${mission.name}`,
      detail: isLocked
        ? '이전 단계를 클리어해주세요'
        : mission.goals.join(' · ') +
          (mission.timeLimitSeconds > 0 ? ` · ${mission.timeLimitSeconds}초` : ''),
      isDisabled: isLocked,
    }
  })

  return (
    <PixelScreen
      title="미션 모드"
      badge={`${listedClearedCount}/${LISTED_MISSIONS.length}`}
      leftKey={{
        label: side === '타자' ? '투수편' : '타자편',
        onPress: () => setSide(side === '타자' ? '투수' : '타자'),
      }}
      rightKey={{ label: '돌아가기', onPress: onBack }}
    >
      <img
        className={popupLabel}
        src={`/sprites/popup/${side === '타자' ? '046' : '047'}.png`}
        alt={`${side}편`}
      />
      <MenuList
        items={items}
        onSelect={(id) => {
          const mission = missions.find((m) => String(m.id) === id)
          if (mission !== undefined) onSelect(mission)
        }}
      />
      <Hint>이전 미션을 깨야 다음이 열립니다</Hint>
    </PixelScreen>
  )
}

export function MissionBriefing({
  mission,
  onStart,
  onBack,
}: {
  readonly mission: OriginalMission
  readonly onStart: () => void
  readonly onBack: () => void
}) {
  return (
    <PixelScreen
      title={mission.name}
      leftKey={{ label: '도전', onPress: onStart }}
      rightKey={{ label: '취소', onPress: onBack }}
    >
      <DialogueBox>
        <MarkupText raw={mission.briefing} />
      </DialogueBox>
      <Panel heading="목표">
        {mission.goals.map((goal) => (
          <Notice key={goal}>
            · {goal}
          </Notice>
        ))}
        {mission.timeLimitSeconds > 0 && (
          <Notice>· 제한 시간 {mission.timeLimitSeconds}초</Notice>
        )}
      </Panel>
    </PixelScreen>
  )
}
