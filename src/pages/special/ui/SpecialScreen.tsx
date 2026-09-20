import { useState } from 'react'
import { Hint, MenuList, Notice, Panel, PixelScreen } from '@/shared/ui'
import type { Collection } from '@/entities/collection/model/collection'
import { HALL_OF_FAME_BATTER_SLOTS } from '@/entities/collection/model/collection'
import { TITLE_NAMES } from '@/entities/career/model/titles'
import { ORIGINAL_SKILLS } from '@/shared/config/original/skills'
import { ORIGINAL_ENDINGS } from '@/shared/config/original/endings'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import { RecordAnnals } from '@/pages/record/ui/RecordAnnals'

type SpecialView = '목록' | '기록연감' | '명예의 전당'

interface SpecialScreenProps {
  readonly collection: Collection
  readonly onBack: () => void
}

/**
 * 원작 메인 메뉴 [스페셜] (StrMAINMENU[1], StrHOWTO[28]) 중 오프라인으로 되는 것 — 기록연감과 명예의 전당.
 * 원본 목록은 여덟 칸(main_ui 15~21·28)인데 나머지는 통신 기능이라 없다 (P6 2d).
 * G포인트 충전·선물·친구추천·선물받기는 통신 기능이라 없고, 마선수 선택·에디트는 아직 없다.
 */
export function SpecialScreen({ collection, onBack }: SpecialScreenProps) {
  const [view, setView] = useState<SpecialView>('목록')
  const back = { label: '돌아가기', onPress: view === '목록' ? onBack : () => setView('목록') }

  if (view === '목록') {
    return (
      <PixelScreen title="스페셜" rightKey={back}>
        <MenuList
          items={[
            // 원본 스페셜은 기록연감이 **한 칸**(main_ui 프레임 21)이고, 그 안에서 탭으로 갈린다 (P6 2c·2d)
            {
              id: '기록연감',
              label: '기록연감',
              detail: `닉네임 ${collection.titles.length}/${TITLE_NAMES.length} · 스킬 ${collection.skills.length}/${ORIGINAL_SKILLS.length}`,
            },
            { id: '명예의 전당', label: '명예의 전당', detail: `${collection.hallOfFame.length}/${HALL_OF_FAME_BATTER_SLOTS}` },
          ]}
          onSelect={(id) => setView(id as SpecialView)}
        />
        <Hint>각종 기록과 게임 통계를 확인할 수 있습니다</Hint>
      </PixelScreen>
    )
  }

  if (view === '기록연감') {
    return <RecordAnnals collection={collection} onBack={() => setView('목록')} />
  }

  return (
    <PixelScreen title="명예의 전당" rightKey={back}>
      {collection.hallOfFame.length === 0 && <Notice>등록된 선수가 없습니다</Notice>}
      {collection.hallOfFame.map((famer, index) => (
        <Panel key={`${famer.name}-${index}`} heading={famer.name}>
          <Notice>
            {famer.season}년차 · 히트 {famer.ability.hit} · 파워 {famer.ability.power} · 수비 {famer.ability.defense} · 주루{' '}
            {famer.ability.run}
          </Notice>
          <Notice>{stripGameMarkup(ORIGINAL_ENDINGS[famer.endingIndex] ?? '', [famer.name]).split('\n')[0]}</Notice>
        </Panel>
      ))}
    </PixelScreen>
  )
}
