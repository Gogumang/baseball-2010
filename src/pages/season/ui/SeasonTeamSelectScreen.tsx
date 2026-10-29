import { useState } from 'react'
import { MessageBox } from '@/shared/ui'
import type { TeamInfoRow } from '@/pages/season/lib/seasonTeamInfo'
import { TeamSelectScreen } from './seasonTeamSelectScreen/otherSlices'
import { SeasonTeamNameScreen } from './seasonTeamSelectScreen/SeasonTeamNameScreen'
import { hiddenTeamHintOf } from '@/pages/season/lib/hiddenTeamHint'

/** 0xca 에서 고를 수 있는 칸의 끝 — 칸 > 9(히든 팀 10~14)는 힌트만 띄운다 (0x8e06 `cmp r3, #9`) */
const LAST_PICKABLE_TEAM = 9

export interface SeasonTeamSelectScreenProps {
  /** 전역 저장 +0x70 + 칸 — 열린 히든 팀은 격자에 그림이 서지만 시즌에서는 고를 수 없다 */
  readonly openedHiddenIds?: readonly number[]
  /** 0xc8 에서 이름을 넣고 [2] 에 "예" — 원본은 0xcc 새 시즌 초기화(0x5758)로 간다 */
  readonly onChoose: (teamId: number, name: string) => void
  /** 머리띠 G포인트 — 전역 G(+0x64). 안 넘기면 0 으로 찍힌다 */
  readonly gamePoint?: number
  /**
   * 취소(−16) — 0x8ec8: [0x140006c] = 5 · 0xbc290(앱, 0x103) 으로 메인 메뉴 장면에 나간다 (관리 메뉴 취소와 같다).
   * 그 뒤 [0x1552d14] = 1 은 **전역 게임 모드를 일반(1)으로** 되돌리는 것이다 — 메인 메뉴 생성자 0x237fa 가 [0x1552d10] 으로
   * 옮기고, 다음 모드 진입 0x327b8 이 [0x1552d14] = m 으로 다시 적는다(나리 101 취소 0x14114 1424c~14264 와 같다). 그 사이에
   * 그 값을 읽는 웹 화면이 없어(웹은 전역 모드 칸을 들지 않고 화면마다 모드를 넘긴다) 옮길 것이 없다.
   */
  readonly onExit: () => void
  /**
   * 이름 입력 0xc8 의 정보 칸 0x7c450 일곱 줄 — 고른 팀으로 (`seasonNameInfoRowsOf`). SR 은 0xcc 초기화 전 버퍼 값이라 부르는 쪽이
   * 시즌 저장의 레코드(없으면 막 만든 SR `FRESH_SEASON_INFO_RECORD`)로 센다. 안 넘기면 판만 깐다
   */
  readonly nameInfoRowsOf?: (teamId: number) => readonly TeamInfoRow[]
}

/**
 * **시즌 팀 고르기 0xca → 이름 입력 0xc8** — 0xca 키는 그림 함수 0x8da4 안(메뉴 this+0x98).
 * 격자는 선수 등록 쪽 `TeamSelectScreen` 을 빌린다.
 * ```
 * 0xca 확인(−5 · '5')  칸 ≤ 9 → 0xc8 (이름 입력)
 *                     칸 > 9 → 히든 팀 힌트 팝업 (`hiddenTeamHintOf`) — 열린 팀이어도 시즌에서는 못 고른다
 * 0xca 취소(−16)       → 메인 메뉴 (0x140006c = 5)
 * ```
 * 0xc8 은 원본에서 따로 상태지만 웹은 한 화면이 단계만 바꿔 든다 — 0xc8 의 이전·다음 상태를 보는 곳이 없다.
 *
 * **0xc8 에서 돌아오면 격자 커서는 0(첫 칸)이다** (직접 떴다): 격자 객체 this+0x98(vtable 0xd2ea0)은 장면 내내 남지만,
 * 0xc8 취소 0xbc44(bc66 `movs r1, #0xca` → 0xbcb49)로 다시 들어선 0xca 의 진입 `0x50a8` 이
 * `50d2~50e0 [this+0x98]->vt+0x14(0, 0)` — vt+0x14 = `0x6c00c`(범위 안이면 +0xc = x · +0x10 = y) — 로 커서를 (0, 0) 에 놓는다.
 * 웹은 격자 화면이 새로 서며 0 이라 같다.
 */
export function SeasonTeamSelectScreen({ openedHiddenIds = [], onChoose, onExit, gamePoint, nameInfoRowsOf }: SeasonTeamSelectScreenProps) {
  const [hint, setHint] = useState<string | null>(null)
  /** 0xc8 에 들어선 팀 — null 이면 0xca */
  const [namingTeamId, setNamingTeamId] = useState<number | null>(null)

  const pick = (teamId: number) => {
    if (teamId > LAST_PICKABLE_TEAM) return setHint(hiddenTeamHintOf(teamId, openedHiddenIds))
    setNamingTeamId(teamId)
  }

  if (namingTeamId !== null) {
    return (
      <SeasonTeamNameScreen
        teamId={namingTeamId}
        gamePoint={gamePoint ?? 0}
        infoRows={nameInfoRowsOf?.(namingTeamId) ?? []}
        onConfirm={(name) => onChoose(namingTeamId, name)}
        onBack={() => setNamingTeamId(null)}
      />
    )
  }

  return (
    <TeamSelectScreen
      title="시즌모드"
      openedHiddenIds={openedHiddenIds}
      {...(gamePoint === undefined ? {} : { gamePoint })}
      onSelect={pick}
      onSelectLocked={pick}
      onCancel={onExit}
      overlay={hint !== null && <MessageBox text={hint} buttons={['확인']} onAnswer={() => setHint(null)} />}
    />
  )
}
