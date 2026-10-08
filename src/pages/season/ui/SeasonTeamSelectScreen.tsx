import { useEffect, useRef, useState } from 'react'
import { MarkupText, MessageBox, RawScreen, TextField } from '@/shared/ui'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { TEAMS } from '@/shared/config/original/teams'
import { MAXIMUM_NAME_BYTES, nameByteLengthOf } from '@/entities/career/model/playerCareer'
import { TeamSelectScreen } from '@/pages/create-player/ui/TeamSelectScreen'
import { nameWithoutLastChar } from '@/pages/create-player/lib/registerKeys'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'

/** 0xca 에서 고를 수 있는 칸의 끝 — 칸 > 9(히든 팀 10~14)는 힌트만 띄운다 (0x8e06 `cmp r3, #9`) */
const LAST_PICKABLE_TEAM = 9
/** 히든 팀 첫 칸 — 힌트 글은 StrMODE[226 + (칸 − 10)] */
const FIRST_HIDDEN_TEAM = 10

/**
 * 히든 팀 힌트 팝업 글 — 0x8e18~0x8ec2 (직접 떴다). 칸은 메뉴 +0xc(열)로 고르고 해금은 전역 +0x70 + 칸:
 * ```
 * 열렸으면   sprintf("%s!N%s!N!N%s",      [225], [226 + 열], [1])
 * 아니면     sprintf("%s!N%s!N!N%s!N%s",  [225], [226 + 열], [0], [1])   → 팝업 (1, 1, 1)
 * ```
 * [225] "<히든 팀 오픈 힌트>" · [226~230] 팀별 힌트 · [0] "선택 할 수 없는 팀입니다" · [1] "일반모드에서 사용 할 수 있습니다".
 * 트레이드 팀 고르기 0xe4(0x82c2~0x8374)도 같은 글이다.
 */
export function hiddenTeamHintOf(teamId: number, openedHiddenIds: readonly number[]): string {
  const title = ORIGINAL_MODE_TEXT[225] ?? ''
  const hint = ORIGINAL_MODE_TEXT[226 + teamId - FIRST_HIDDEN_TEAM] ?? ''
  const cannotPick = ORIGINAL_MODE_TEXT[0] ?? ''
  const generalModeOnly = ORIGINAL_MODE_TEXT[1] ?? ''
  return openedHiddenIds.includes(teamId)
    ? `${title}!N${hint}!N!N${generalModeOnly}`
    : `${title}!N${hint}!N!N${cannotPick}!N${generalModeOnly}`
}

export interface SeasonTeamSelectScreenProps {
  /** 전역 저장 +0x70 + 칸 — 열린 히든 팀은 격자에 그림이 서지만 시즌에서는 고를 수 없다 */
  readonly openedHiddenIds?: readonly number[]
  /** 0xc8 에서 이름을 넣고 [2] 에 "예" — 원본은 0xcc 새 시즌 초기화(0x5758)로 간다 */
  readonly onChoose: (teamId: number, name: string) => void
  /**
   * 취소(−16) — 0x8ec8: [0x140006c] = 5 · 0xbc290(앱, 0x103) 으로 메인 메뉴 장면에 나간다 (관리 메뉴 취소와 같다).
   * ⚠️ 그 뒤 [0x1552d14] = 1 을 쓰는데 그 칸의 뜻은 못 풀었다 — 옮기지 않았다.
   */
  readonly onExit: () => void
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
 */
export function SeasonTeamSelectScreen({ openedHiddenIds = [], onChoose, onExit }: SeasonTeamSelectScreenProps) {
  const [hint, setHint] = useState<string | null>(null)
  /** 0xc8 에 들어선 팀 — null 이면 0xca */
  const [namingTeamId, setNamingTeamId] = useState<number | null>(null)

  const pick = (teamId: number) => {
    if (teamId > LAST_PICKABLE_TEAM) return setHint(hiddenTeamHintOf(teamId, openedHiddenIds))
    setNamingTeamId(teamId)
  }

  if (namingTeamId !== null) {
    return (
      <SeasonTeamNameScreen teamId={namingTeamId}
        onConfirm={(name) => onChoose(namingTeamId, name)} onBack={() => setNamingTeamId(null)} />
    )
  }

  return (
    <TeamSelectScreen title="시즌모드" openedHiddenIds={openedHiddenIds}
      onSelect={pick} onSelectLocked={pick} onCancel={onExit}
      overlay={hint !== null && <MessageBox text={hint} buttons={['확인']} onAnswer={() => setHint(null)} />} />
  )
}

/** [2] "이대로 결정 하시겠습니까?" — 팝업 (2, 1, 1) 예/아니오 (0xbce2~0xbcf8) */
const DECIDE_QUESTION = ORIGINAL_MODE_TEXT[2] ?? ''
/** [3] "한글 4글자, 영문 8글자 까지 입력할 수 있습니다" — 그림 0xba28 끝이 아래 안내줄(0x55545)에 건다 */
const NAME_LIMIT_GUIDE = ORIGINAL_MODE_TEXT[3] ?? ''

interface SeasonTeamNameScreenProps {
  readonly teamId: number
  readonly onConfirm: (name: string) => void
  /** 이름이 빈 채로 취소 — 0xca 로 */
  readonly onBack: () => void
}

/**
 * **이름 입력 0xc8** — 진입 0xb8fc · 키 0xbc44 · 팝업 답 0x4a58 · 그림 0xba28 (직접 떴다).
 * ```
 * 진입    입력기 0x1552d00: +8 = 8 (최대 8바이트) · 글 비움(0x670d5)
 * 취소(−16)  글이 비었으면 → 0xca          아니면 한 글자 지움 (0x66fd5)
 * 확인(−5)   글이 있으면 입력기에 넘긴 뒤 [2] 예/아니오 팝업 · 비었으면 아무것도 안 한다
 * [2] 답     0(예) → 0xcc (0x4a58) · 아니오 → 0xc8 그대로
 * ```
 * 원본 입력기(자판 여러 번 누르기 · 좌우 −3/−4 로 입력 방식 넷을 돈다)는 웹 글 칸으로 대신하고 CP949 8바이트
 * (한글 2 · 그 밖 1, `nameByteLengthOf`)로 자른다.
 * ⚠️ 그림 0xba28 의 창·글 칸 좌표는 그림 자료(gfx+0xc8)에서 오는데 풀지 못했다 — 자리는 **근사**다.
 */
function SeasonTeamNameScreen({ teamId, onConfirm, onBack }: SeasonTeamNameScreenProps) {
  const [name, setName] = useState('')
  const [isAsking, setAsking] = useState(false)
  const latest = useRef({ name, onBack })
  latest.current = { name, onBack }

  useEffect(() => {
    if (isAsking) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      const current = latest.current.name
      // 취소(−16) — 원본 CLR 은 지우기와 되돌아가기를 한 키가 한다
      if (event.key === 'Escape' || (event.key === 'Backspace' && current === '')) {
        event.preventDefault()
        if (current === '') return latest.current.onBack()
        return setName(nameWithoutLastChar(current))
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        if (current !== '') setAsking(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isAsking])

  return (
    <RawScreen>
      <div style={{ position: 'absolute', left: 40, top: 80, width: 160, textAlign: 'center' }}>
        {TEAMS[teamId]?.name ?? ''}
      </div>
      <form onSubmit={(event) => event.preventDefault()}>
        <TextField value={name} autoFocus aria-label="이름"
          style={{ position: 'absolute', left: 60, top: 100, width: 120, height: 18 }}
          onChange={(event) => {
            if (nameByteLengthOf(event.target.value) <= MAXIMUM_NAME_BYTES) setName(event.target.value)
          }} />
      </form>
      <div style={{ position: 'absolute', left: 8, top: 260, width: 224 }}>
        <MarkupText raw={`!C${NAME_LIMIT_GUIDE}`} />
      </div>
      <ScreenFrame title="시즌모드" gamePoint={0} onBack={() => (name === '' ? onBack() : setName(nameWithoutLastChar(name)))} />
      {isAsking && (
        <MessageBox text={DECIDE_QUESTION} buttons={['예', '아니오']}
          onAnswer={(answer) => {
            setAsking(false)
            if (answer === 0) onConfirm(name)
          }} />
      )}
    </RawScreen>
  )
}
