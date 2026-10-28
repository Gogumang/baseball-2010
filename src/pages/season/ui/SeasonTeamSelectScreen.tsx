import { useEffect, useRef, useState } from 'react'
import { InputMethodText, MessageBox, PressArea, RawScreen } from '@/shared/ui'
import { InputModeBox } from '@/shared/ui/InputMethodText/InputModeBox'
import { DescriptionBand } from '@/shared/ui/DescriptionBand/DescriptionBand'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { TEAMS } from '@/shared/config/original/teams'
import { MAXIMUM_NAME_BYTES, nameByteLengthOf } from '@/entities/career/model/playerCareer'
import { TeamSelectScreen } from '@/pages/create-player/ui/TeamSelectScreen'
import { nameWithoutLastChar } from '@/pages/create-player/lib/registerKeys'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { SeasonTeamCard } from '@/pages/season/ui/SeasonTeamCard'
import { SeasonTeamInfoPanel } from '@/pages/season/ui/SeasonTeamInfoScreen'
import type { TeamInfoRow } from '@/pages/season/lib/seasonTeamInfo'
import { hiddenTeamUnlockIdOf, isUnlocked } from '@/shared/config/unlocks'

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
  // 해금 표(`unlocks.json`)가 풀면 열린 팀의 글([0] 줄 없음)이다
  const unlockId = hiddenTeamUnlockIdOf(teamId)
  const original = () => openedHiddenIds.includes(teamId)
  return (unlockId === null ? original() : isUnlocked(unlockId, original))
    ? `${title}!N${hint}!N!N${generalModeOnly}`
    : `${title}!N${hint}!N!N${cannotPick}!N${generalModeOnly}`
}

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

/** [2] "이대로 결정 하시겠습니까?" — 팝업 (2, 1, 1) 예/아니오 (0xbce2~0xbcf8) */
const DECIDE_QUESTION = ORIGINAL_MODE_TEXT[2] ?? ''
/** [3] "한글 4글자, 영문 8글자 까지 입력할 수 있습니다" — 그림 0xba28 끝이 아래 안내줄(0x55545)에 건다 */
const NAME_LIMIT_GUIDE = ORIGINAL_MODE_TEXT[3] ?? ''

/** mode_ui 프레임 3 박스 1 (30,184,25,15) ∪ 박스 2 (60,184,81,15) 를 (−1, −1, +2, +2) — 0xbaa0~0xbac0 */
const NAME_FRAME = { x: 29, y: 183, width: 113, height: 17 } as const
/** 박스 2 + (2, 3) — 0xbb26 · 0xbb28 */
const NAME_TEXT = { x: 62, y: 187 } as const
/** mode_ui 프레임 3 박스 2 (60,184,81,15) — 0xbae6~0xbaf4 `0x94a65(…, 0, 2)`. 입력 방식 칸 · 화살은 이 박스에서 센다 */
const NAME_BOX = { x: 60, y: 184, width: 81, height: 15 } as const
/** 박스 2 의 (x + w − 0x14, y + 1, 14, 14) — 0xbb32~0xbb4a (`InputModeBox` 의 칸과 같다) */
const MODE_BOX = { x: NAME_BOX.x + NAME_BOX.width - 0x14, y: NAME_BOX.y + 1, width: 14, height: 14 } as const
/** 0x1400748(0xff, 0xff, 0) — 테두리 · 이름 글 */
const NAME_COLOR = 'rgb(255, 255, 0)'

interface SeasonTeamNameScreenProps {
  readonly teamId: number
  readonly onConfirm: (name: string) => void
  /** 이름이 빈 채로 취소 — 0xca 로 */
  readonly onBack: () => void
  /** 머리띠 G — 제목이 있는 머리띠 0x54d95 는 늘 전역 G(+0x64)를 그린다 (0x550d8~0x550de) */
  readonly gamePoint: number
  /** 정보 칸 0x7c450 일곱 줄 (`nameInfoRowsOf`) — 비면 판만 */
  readonly infoRows: readonly TeamInfoRow[]
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
 * ba3a  창+0x14c = 0 · 0x7ba44(창) 카드 · 창+0x28 = 1 · 0x7c450(창) 정보 칸   ; 창+0x24 = 고른 팀(진입 0xb8fc b95a) — `SeasonTeamCard`
 * ba74  박스 1 (30,184,25,15) ∪ 박스 2 (60,184,81,15) = (30,184,111,15) → (−1, −1, +2, +2) = (29,183,113,17)
 *       0xba015(…, 1, (0xff, 0xff, 0))                   ; 노랑 테두리(둥글기 1)
 * baf8  박스 2 → 0x677d5(입력기, x + 2, y + 3, 글꼴, (0xff, 0xff, 0), 1, 0x11, 0)   ; 이름 글 (62, 187) 노랑
 * bb32  (x + w − 20, y + 1, 14, 14) = (121, 185, 14, 14) · 0xba0bd(…, 1, (0x2e, 0x46, 0x94))   ; 입력 방식 칸 남색 칠
 *       0x676f9(입력기, 123, 187, …)                     ; 입력 방식 글
 * bb92  mode_ui 프레임 24(빨간 ◀ 5×8)를 그 칸에 0xb9e05(…, 0x21, 0, 0, −폭) · (…, 0x24, 0x11, 0, 2 × 폭)   ; 좌우 화살표
 * bbda  0x55545([this+0xa8], StrMODE[3]) 안내 줄 · 0x7f4ed 머리띠
 * ```
 * 카드 0x7ba44 는 구단정보 0xd5 와 같은 팀 갈래다(`SeasonTeamCard` — 계단형 판 · 고른 팀 로고 효과 없이 · 딱지와 팀 이름 ·
 * ABILITY 판 0x5aefc 종류 0, 가운데 (178, 104), rec = 0x1f8c1(전역, 고른 팀) — 리터럴 0x7c100). 판은 0xca · 0xc8 진입이
 * 0x76705 를 안 불러 생성자 0x76610 기본값 (0x67, 0x38, 0) 이다.
 * 정보 칸 0x7c450 은 창+0x28 = 1 로 그려 줄 0 단장 값만 빠지고, 줄 값은 창+0x150 = SR(장면 초기화 3fb6~3fc0) — 0xcc 초기화 전 버퍼다
 * (`seasonNameInfoRowsOf` · `FRESH_SEASON_INFO_RECORD`, r101). 입력 방식 칸 · 화살은 나리 등록 0x15f34(0x160e2~0x161f4)와 같은 식이라
 * `InputModeBox` 를 같이 쓴다(bb32~bbd6: 칸 M = 박스 2 의 (x + w − 20, y + 1, 14, 14) · 0xb9e05(mode_ui 24, M, 0x21, ox −폭) ·
 * (…, 0x24, 효과 0x11, ox 2 × 폭)). 안내 줄은 설명 띠 0x55545([this+0xa8], StrMODE[3]) — 진입 0xb8fc(b900~b914)가
 * [띠+0x88] = 1 · [띠+0x8a] = 1 로 다시 펴 들어설 때마다 1 부터 자란다(`DescriptionBand`).
 * 입력 방식 글 0x676f9(입력기, M.x + 2, M.y + 2 — bb68~bb8e)는 웹 글 칸에 폰 입력 방식(A/a/1/가)이 없어 옮기지 않았다.
 * 창 종류 [창+0x1a4] 가 0 이라는 것은 시즌 장면이 새로 선 뒤 0xca → 0xc8 로만 온다는 데 기댄다. 상수 0xc8 을 상태로 넘기는 곳은
 * 0xca 키의 0x8e0a~0x8e12(칸 ≤ 9 에 '5') 하나뿐이다(re.py 로 `movs r1, #0xc8` 전수 — 0x8a26 은 sprintf 의 StrMODE[200] 번호).
 * 레지스터 값으로 상태를 거는 길도 전수했다(r165 — 리터럴 0xbcb49 를 읽는 206 곳 가운데 장면 0x105 쪽): 상태 1 적재 0x787a
 * `0xbcb49([+0x24])` 는 장면을 세울 때만(시즌 쪽에 상태 1 을 거는 곳이 없다) · 0xbfb4(상태 0xd2 키 — 표 0xcbf6c) · 0xebea(상태
 * 0xc9 · 0xd1 진입 훑기)는 `0xbcb49(지금 [+0x1c])` 뒤 0xd3 이벤트 · 0x8d74 는 이벤트 끝에 `[+0x24]`(= 0xd3 을 건 상태 0xc9 · 0xd1 ·
 * 0xd2 · 0xf1 · 0xf3)로 돌아간다. 곧 0xc8 로 되돌아오는 레지스터 길은 없다 — 0xc8 은 0xca 를 지나서만 선다(확정).
 */
/** ⚠️ 웹 자리: OK — 바닥띠 왼쪽 표시 자리 (x 2, 47×12, 다 내려온 바닥띠 B = 320 의 B − 18) */
const NAME_OK_PRESS_RECT = { x: 2, y: 320 - 18, width: 47, height: 12 } as const

function SeasonTeamNameScreen({ teamId, onConfirm, onBack, gamePoint, infoRows }: SeasonTeamNameScreenProps) {
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
      {/*
        카드 0x7ba44 (ba46) — 시즌 장면이라 [창+0x20] == 2, 상태 0xc8 은 0xd5 · 0xd9 가 아니고 창 종류 [창+0x1a4] 는 0 이라
        (창 객체는 new 0x1239 → 0x2ac4 가 memset 0 으로 채우고 0x1a4 를 적는 시즌 장면 함수는 0xd6 0x5ee4 · 0xdc 0x5f3c · 0xea 0xe4d0 진입뿐) 팀 갈래 0x7bf9c 다.
        로고 [창+0x140] · 팀 레코드 [창+0x154] = 0x1f8c1(전역, 고른 팀) · [창+0x24] = 고른 팀은 진입 0xb8fc 가 적는다(b976~b9fe).
        딱지 [창+0x168] 은 바로 앞 0xca 진입 0x50a8 이 [장면+0xd4] 로 세웠다(0x50be~0x50d0) — 늘 선다
      */}
      <SeasonTeamCard teamId={teamId} teamAbilities={TEAMS[teamId]?.values.slice(2) ?? []} hasCardBadge testIdPrefix="이름" />
      {/* 정보 칸 0x7c450 — 판 mode_ui 프레임 3 박스 0 과 일곱 줄 (구단정보 0xd5 와 같다). 카드 뒤 창+0x28 = 1 로 그린다(ba4c~ba5a) */}
      <SeasonTeamInfoPanel rows={infoRows} testIdPrefix="이름" />
      {/* 0xba015 — 박스 1 ∪ 박스 2 를 1 넓힌 노랑 테두리 (둥글기 1) */}
      <div
        data-testid="이름-테두리"
        style={{
          position: 'absolute',
          left: NAME_FRAME.x,
          top: NAME_FRAME.y,
          width: NAME_FRAME.width,
          height: NAME_FRAME.height,
          boxSizing: 'border-box',
          border: `1px solid ${NAME_COLOR}`,
          borderRadius: 1,
        }}
      />
      {/* 0xba0bd 입력 방식 칸 (박스 2 오른쪽 끝 − 20, +1, 14 × 14) 남색 칠 · mode_ui 24 좌우 화살 (bb32~bbd6) */}
      <InputModeBox nameBox={NAME_BOX} />
      <form onSubmit={(event) => event.preventDefault()}>
        {/* 0x677d5(입력기, 박스 2 의 x + 2, y + 3, 앱 글꼴, 노랑, 커서 켬 1, 정렬 0x11, 0) — 0xbafc~0xbb2a. 누름 칸은 입력 방식 칸 앞까지 */}
        <InputMethodText
          value={name}
          autoFocus
          aria-label="이름"
          x={NAME_TEXT.x}
          y={NAME_TEXT.y}
          color={NAME_COLOR}
          isCursorOn
          inputRect={{ x: NAME_TEXT.x, y: NAME_TEXT.y, width: MODE_BOX.x - NAME_TEXT.x, height: 12 }}
          onChange={(event) => {
            if (nameByteLengthOf(event.target.value) <= MAXIMUM_NAME_BYTES) setName(event.target.value)
          }}
        />
      </form>
      {/* 설명 띠 0x55545([this+0xa8], StrMODE[3]) — bbda~bbf2. 진입 0xb8fc 가 띠를 다시 편다 */}
      <DescriptionBand text={NAME_LIMIT_GUIDE} seed={0} />
      <ScreenFrame
        title="시즌모드"
        gamePoint={gamePoint}
        onBack={() => (name === '' ? onBack() : setName(nameWithoutLastChar(name)))}
        slides={false}
      />
      {/*
        ⚠️ 웹 자리: OK — 원본 이름 입력 그림 0xba28 에는 OK 그림 자리가 없다(키 0xbc44 의 확인만). 마우스 · 터치로 끝낼 길이 없어
        바닥띠 왼쪽 표시 자리(선수 등록 0x66 의 OK 와 같은 자리)를 투명 누름 칸으로 빌려 OK 키를 보낸다
      */}
      {!isAsking && (
        <PressArea label="OK" rect={NAME_OK_PRESS_RECT} onPress={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))} />
      )}
      {isAsking && (
        <MessageBox
          text={DECIDE_QUESTION}
          buttons={['예', '아니오']}
          onAnswer={(answer) => {
            setAsking(false)
            if (answer === 0) onConfirm(name)
          }}
        />
      )}
    </RawScreen>
  )
}
