import * as styles from '@/shared/ui/PixelNumber/PixelNumber.css'
/** 원본 ui/num.pzx 의 숫자 그림. 10개씩 색상별로 묶여 있다. */
const DIGIT_SET_START: Readonly<Record<string, number>> = {
  흰색: 0,
  노랑: 10,
  주황: 20,
}

interface PixelNumberProps {
  readonly value: number
  readonly color?: keyof typeof DIGIT_SET_START
  /** 자릿수를 맞춰 앞을 0으로 채운다 */
  readonly minimumDigits?: number
}

export function PixelNumber({ value, color = '흰색', minimumDigits = 1 }: PixelNumberProps) {
  const start = DIGIT_SET_START[color] ?? 0
  const digits = String(Math.max(0, Math.trunc(value))).padStart(minimumDigits, '0')

  return (
    <span className={styles.number}>
      {[...digits].map((digit, index) => (
        <img
          key={index}
          src={`/sprites/num/${String(start + Number(digit)).padStart(3, '0')}.png`}
          alt={digit}
        />
      ))}
    </span>
  )
}

/** 원본 ui/game_frame.pzx 의 메뉴 제목 그림. 시트를 눈으로 확인해 매긴 번호다. */
export const HEADING_SPRITE = {
  타이틀: '003',
  선공구장: '004',
  팀선택: '005',
  투수엔트리: '006',
  타자엔트리: '007',
  마선수선택: '008',
  나만의리그: '009',
  경기정보: '012',
  홈런더비: '013',
  미션모드: '018',
  시즌모드: '022',
  명예의전당: '029',
  대전모드: '031',
} as const

export function HeadingSprite({ name }: { readonly name: keyof typeof HEADING_SPRITE }) {
  return (
    <img
      className={styles.headingSprite}
      src={`/sprites/game_frame/${HEADING_SPRITE[name]}.png`}
      alt={name}
    />
  )
}

/** 원본 ui/popup.pzx 의 버튼 라벨 그림. 시트를 눈으로 확인해 매긴 번호다. */
export const POPUP_LABEL = {
  예: '006',
  OK: '007',
  아니오: '008',
  이어하기: '009',
  새로하기: '010',
  빠른실행: '011',
  타자편: '046',
  투수편: '047',
} as const

export function PopupLabel({ name }: { readonly name: keyof typeof POPUP_LABEL }) {
  return (
    <img className={styles.popupLabel} src={`/sprites/popup/${POPUP_LABEL[name]}.png`} alt={name} />
  )
}

/**
 * 원본 ui/mode_icon.pzx 의 메뉴 아이콘. 시트를 눈으로 보고 고른 번호다.
 * 그림과 메뉴의 대응은 원작 화면을 못 본 상태의 추정이라 바꿀 수 있다.
 */
/**
 * 관리 커맨드 아이콘.
 *
 * 원본 ui/mode_icon.pzx 의 000~005 가 StrHOWTO[11] 의 커맨드 나열 순서와 그대로 같다:
 *   000 기록장 · 001 아령 · 002 집 · 003 도시 · 004 상점 · 005 PLAY
 * 그림 뜻과 순서가 둘 다 맞으므로 번호를 추측한 것이 아니다.
 */
export const MODE_ICON = {
  성적: '/sprites/mode_icon/000.png',
  훈련: '/sprites/mode_icon/001.png',
  휴식: '/sprites/mode_icon/002.png',
  외출: '/sprites/mode_icon/003.png',
  아이템: '/sprites/mode_icon/004.png',
  경기: '/sprites/mode_icon/005.png',
  이벤트: '/sprites/mode_icon/009.png',
} as const
