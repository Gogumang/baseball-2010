import { useState } from 'react'
import { Hint, MenuList, Notice, Panel, PixelScreen, TitleTag } from '@/shared/ui'
import type { Collection } from '@/entities/collection/model/collection'
import { HALL_OF_FAME_BATTER_SLOTS } from '@/entities/collection/model/collection'
import { TITLE_NAMES } from '@/entities/career/model/titles'
import { ORIGINAL_SKILLS } from '@/shared/config/original/skills'
import { ORIGINAL_ENDINGS } from '@/shared/config/original/endings'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'

type SpecialView = '목록' | '닉네임' | '스킬' | '엔딩' | '명예의 전당'

/** 나만의리그 엔딩 — StrENDING[0~14] (15~19 는 시즌모드, 20·21 은 최종·제작진) */
const CAREER_ENDING_COUNT = 15
/** 목록은 이름 없이 요약한다 — "%s은(는) " 같은 이름·조사 묶음을 뺀다 */
const NAME_WITH_PARTICLE = /%s\S*\s*/g
const UNKNOWN = '???'

interface SpecialScreenProps {
  readonly collection: Collection
  readonly onBack: () => void
}

/**
 * 원작 메인 메뉴 [스페셜] (StrMAINMENU[1], StrHOWTO[28]) 중 오프라인으로 되는 것 — 기록연감과 명예의 전당.
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
            { id: '닉네임', label: '기록연감 · 닉네임', detail: `${collection.titles.length}/${TITLE_NAMES.length}` },
            { id: '스킬', label: '기록연감 · 스킬', detail: `${collection.skills.length}/${ORIGINAL_SKILLS.length}` },
            { id: '엔딩', label: '기록연감 · 엔딩', detail: `${collection.endings.length}/${CAREER_ENDING_COUNT}` },
            { id: '명예의 전당', label: '명예의 전당', detail: `${collection.hallOfFame.length}/${HALL_OF_FAME_BATTER_SLOTS}` },
          ]}
          onSelect={(id) => setView(id as SpecialView)}
        />
        <Hint>각종 기록과 게임 통계를 확인할 수 있습니다</Hint>
      </PixelScreen>
    )
  }

  if (view === '닉네임') {
    return (
      <PixelScreen title="닉네임" rightKey={back}>
        {TITLE_NAMES.map((name) => (
          <TitleTag key={name}>{collection.titles.includes(name) ? name : UNKNOWN}</TitleTag>
        ))}
      </PixelScreen>
    )
  }

  if (view === '스킬') {
    return (
      <PixelScreen title="스킬" rightKey={back}>
        {ORIGINAL_SKILLS.map((skill) => (
          <Notice key={skill.id}>
            {collection.skills.includes(skill.id) ? `${skill.name} — ${stripGameMarkup(skill.effect).replace(/\s+/g, ' ')}` : UNKNOWN}
          </Notice>
        ))}
      </PixelScreen>
    )
  }

  if (view === '엔딩') {
    return (
      <PixelScreen title="엔딩" rightKey={back}>
        {ORIGINAL_ENDINGS.slice(0, CAREER_ENDING_COUNT).map((text, index) => (
          <Notice key={index}>
            {index + 1}. {collection.endings.includes(index) ? stripGameMarkup(text.replace(NAME_WITH_PARTICLE, '')).split('\n')[0] : UNKNOWN}
          </Notice>
        ))}
      </PixelScreen>
    )
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
