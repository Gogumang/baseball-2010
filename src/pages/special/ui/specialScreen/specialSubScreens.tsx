import type { ReactNode } from 'react'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { RecordAnnals } from '@/pages/special/ui/specialScreen/otherSlices'
import type { SpecialScreenProps, SpecialView } from '@/pages/special/ui/specialScreen/specialScreenTypes'
import { HallOfFameScreen } from '@/pages/special/ui/hallOfFameScreen/HallOfFameScreen'
import type { HallOfFameMode } from '@/pages/special/ui/hallOfFameScreen/hallOfFameTypes'

type SubScreenOf = (props: SpecialScreenProps, onReturn: () => void) => ReactNode

/** 기록연감 (하위 30) — 하위 30 그리기 0x2e29c 도 맨 앞(0x2e2b6)에 메뉴 바탕 0x58371 을 깐다 */
const annalsScreenOf: SubScreenOf = ({ collection, gamePoint, annalsSecretCode, onAnnalsSecretCodeChange }, onReturn) => (
  <RecordAnnals
    collection={collection}
    {...(gamePoint === undefined ? {} : { gamePoint })}
    {...(annalsSecretCode === undefined ? {} : { secretCode: annalsSecretCode })}
    {...(onAnnalsSecretCodeChange === undefined ? {} : { onSecretCodeChange: onAnnalsSecretCodeChange })}
    underlay={<SkinBackdrop kind="메뉴바탕" />}
    onBack={onReturn}
  />
)

/** 명예의 전당 (하위 27) — 그리기 0x2dcd8: 배경 0x58371 · 목록 k 8 · 머리띠 0x54d95(skin, 16 "명예의전당", 5) */
const hallOfFameScreenOf: SubScreenOf = ({ collection, gamePoint, hallOfFameDeletion }, onReturn) => {
  const mode: HallOfFameMode = hallOfFameDeletion === undefined ? { kind: '보기' } : { kind: '보기', deletion: hallOfFameDeletion }
  return (
    <HallOfFameScreen
      collection={collection}
      mode={mode}
      onBack={onReturn}
      {...(gamePoint === undefined ? {} : { frame: { title: '명예의전당', gamePoint } })}
    />
  )
}

/** 앱이 꽂는 화면 — 마선수선택(하위 28) · 에디트(29). 꽂을 화면이 없으면 목록 그대로 */
const pluggedScreenOf =
  (render: (props: SpecialScreenProps) => ((onBack: () => void) => ReactNode) | undefined): SubScreenOf =>
  (props, onReturn) => {
    const plugged = render(props)
    return plugged === undefined ? null : <>{plugged(onReturn)}</>
  }

const SUB_SCREEN_OF: Readonly<Record<SpecialView, SubScreenOf>> = {
  목록: () => null,
  기록연감: annalsScreenOf,
  마선수선택: pluggedScreenOf((props) => props.renderAceSelect),
  에디트: pluggedScreenOf((props) => props.renderEdit),
  '명예의 전당': hallOfFameScreenOf,
}

/** 하위 화면 — 목록(이나 꽂을 화면이 없는 칸)이면 null */
export function specialSubScreenOf(view: SpecialView, props: SpecialScreenProps, onReturn: () => void): ReactNode {
  return SUB_SCREEN_OF[view](props, onReturn)
}
