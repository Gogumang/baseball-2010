import { useEffect, useRef, useState } from 'react'
import { MarkupText, MessageBox, RawScreen, TextField } from '@/shared/ui'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { TEAMS } from '@/shared/config/original/teams'
import { MAXIMUM_NAME_BYTES, nameByteLengthOf } from '@/entities/career/model/playerCareer'
import { TeamSelectScreen } from '@/pages/create-player/ui/TeamSelectScreen'
import { nameWithoutLastChar } from '@/pages/create-player/lib/registerKeys'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { INFO_BOARD } from '@/pages/management/lib/basicInfoLayout'

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
   * 그 뒤 [0x1552d14] = 1 은 **전역 게임 모드를 일반(1)으로** 되돌리는 것이다 — 메인 메뉴 생성자 0x237fa 가 [0x1552d10] 으로
   * 옮기고, 다음 모드 진입 0x327b8 이 [0x1552d14] = m 으로 다시 적는다(나리 101 취소 0x14114 1424c~14264 와 같다). 그 사이에
   * 그 값을 읽는 웹 화면이 없어(웹은 전역 모드 칸을 들지 않고 화면마다 모드를 넘긴다) 옮길 것이 없다.
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
 *
 * **0xc8 에서 돌아오면 격자 커서는 0(첫 칸)이다** (직접 떴다): 격자 객체 this+0x98(vtable 0xd2ea0)은 장면 내내 남지만,
 * 0xc8 취소 0xbc44(bc66 `movs r1, #0xca` → 0xbcb49)로 다시 들어선 0xca 의 진입 `0x50a8` 이
 * `50d2~50e0 [this+0x98]->vt+0x14(0, 0)` — vt+0x14 = `0x6c00c`(범위 안이면 +0xc = x · +0x10 = y) — 로 커서를 (0, 0) 에 놓는다.
 * 웹은 격자 화면이 새로 서며 0 이라 같다.
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

/** mode_ui 프레임 3 박스 1 (30,184,25,15) ∪ 박스 2 (60,184,81,15) 를 (−1, −1, +2, +2) — 0xbaa0~0xbac0 */
const NAME_FRAME = { x: 29, y: 183, width: 113, height: 17 } as const
/** 박스 2 + (2, 3) — 0xbb26 · 0xbb28 */
const NAME_TEXT = { x: 62, y: 187 } as const
/** 박스 2 의 (x + w − 0x14, y + 1, 14, 14) — 0xbb32~0xbb4a */
const MODE_BOX = { x: 121, y: 185, width: 14, height: 14 } as const
/** 0x1400748(0xff, 0xff, 0) — 테두리 · 이름 글 */
const NAME_COLOR = 'rgb(255, 255, 0)'
/** 0x1400748(0x2e, 0x94, 0x46) — 입력 방식 칸 */
const MODE_BOX_COLOR = 'rgb(46, 148, 70)'

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
 *
 * **그림 0xba28** (직접 떴다) — 자리는 `[[장면+0xc8]+0xc]+8` 의 +0xc = **mode_ui 프레임 3**(구단정보 정보 칸 판과 같은 프레임)의 박스다:
 * ```
 * ba3a  창+0x14c = 0 · 0x7ba44(창) 카드 · 창+0x28 = 1 · 0x7c450(창) 정보 칸   ; 창+0x24 = 고른 팀(진입 0xb8fc b95a)
 * ba74  박스 1 (30,184,25,15) ∪ 박스 2 (60,184,81,15) = (30,184,111,15) → (−1, −1, +2, +2) = (29,183,113,17)
 *       0xba015(…, 1, (0xff, 0xff, 0))                   ; 노랑 테두리(둥글기 1)
 * baf8  박스 2 → 0x677d5(입력기, x + 2, y + 3, 글꼴, (0xff, 0xff, 0), 1, 0x11, 0)   ; 이름 글 (62, 187) 노랑
 * bb32  (x + w − 20, y + 1, 14, 14) = (121, 185, 14, 14) · 0xba0bd(…, 1, (0x2e, 0x94, 0x46))   ; 입력 방식 칸 초록 칠
 *       0x676f9(입력기, 123, 187, …)                     ; 입력 방식 글
 * bb92  mode_ui 프레임 24(빨간 ◀ 5×8)를 그 칸에 0xb9e05(…, 0x21, 0, 0, −폭) · (…, 0x24, 0x11, 0, 2 × 폭)   ; 좌우 화살표
 * bbda  0x55545([this+0xa8], StrMODE[3]) 안내 줄 · 0x7f4ed 머리띠
 * ```
 * ⚠️ 미해결(근사): 카드 0x7ba44 · 정보 칸 0x7c450 은 창+0x28 = 1(단장 줄 글을 안 쓴다)로 그리는데, 그때 시즌 레코드(SR)는 아직
 * 0xcc 초기화 전이라 줄 값의 출처를 못 정했다 — 웹은 팀 이름만 적는다. 입력 방식 글 · 화살표 기준점(0x21 / 0x24) · 안내 줄 0x55545 의
 * 자리도 못 풀었다(웹 글 칸은 입력 방식이 없다).
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
      {/* 공통 앞그림 0xb810 — 0xc8 은 0xdd · 0xe0 · 0xe1 밖이라 공 무늬를 먼저 깐다 */}
      <SkinBackdrop kind="공무늬" />
      {/* 정보 칸 0x7c450 의 판 — mode_ui 프레임 3 박스 0 (구단정보 0xd5 와 같은 판) */}
      <div data-testid="이름-판" style={{
        position: 'absolute', left: INFO_BOARD.x, top: INFO_BOARD.y, width: INFO_BOARD.width, height: INFO_BOARD.height,
        background: INFO_BOARD.color,
      }} />
      <div style={{ position: 'absolute', left: 40, top: 80, width: 160, textAlign: 'center' }}>
        {TEAMS[teamId]?.name ?? ''}
      </div>
      {/* 0xba015 — 박스 1 ∪ 박스 2 를 1 넓힌 노랑 테두리 (둥글기 1) */}
      <div data-testid="이름-테두리" style={{
        position: 'absolute', left: NAME_FRAME.x, top: NAME_FRAME.y, width: NAME_FRAME.width, height: NAME_FRAME.height,
        boxSizing: 'border-box', border: `1px solid ${NAME_COLOR}`, borderRadius: 1,
      }} />
      {/* 0xba0bd — 입력 방식 칸 (박스 2 오른쪽 끝 − 20, +1, 14 × 14) 초록 칠 */}
      <div data-testid="이름-입력방식" style={{
        position: 'absolute', left: MODE_BOX.x, top: MODE_BOX.y, width: MODE_BOX.width, height: MODE_BOX.height,
        background: MODE_BOX_COLOR, borderRadius: 1,
      }} />
      <form onSubmit={(event) => event.preventDefault()}>
        <TextField value={name} autoFocus aria-label="이름"
          // 0x677d5 — 박스 2 의 (x + 2, y + 3) 에 노랑 글. 입력 방식 칸 앞까지
          style={{
            position: 'absolute', left: NAME_TEXT.x, top: NAME_TEXT.y, width: MODE_BOX.x - NAME_TEXT.x, height: 12,
            padding: 0, border: 0, background: 'transparent', color: NAME_COLOR,
          }}
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
