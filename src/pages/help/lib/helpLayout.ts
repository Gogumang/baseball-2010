import {
  DESCRIPTION_PANEL, FOOTER, HEADBAND, ROW, SCREEN, WHEEL,
  descriptionPanelTopOf, rowTopOf,
} from '@/pages/special/lib/specialLayout'

/**
 * 도움말 배치 (메인 메뉴 상태 9 목록 + 상태 37 본문 — P6 2d·1-2).
 *
 * 목록 그리기는 **스페셜(상태 6)과 글자 하나 다르지 않다**:
 * 메뉴 판 `0x24b1c`(반원 바퀴, F-5) + **하위 목록 `0x2524c`** + 머리띠 `0x54d95(skin, 0, 5)`
 * (제목 "2010프로야구", 바닥 되돌아가기). 표만 다르다 — 상태 9 는 **표 `0xceb37`(다섯 칸)**.
 * 그래서 바퀴·머리띠·줄 자리·설명 판 상수는 `specialLayout.ts` 를 그대로 가져다 쓴다
 * (같은 원본 함수를 두 번 옮겨 적으면 한쪽만 고쳐질 수 있다).
 *
 * 고르면 상태 37 = **가운데 192 폭 창**(공용 판 `0x55e61`, 정렬 0x22) + 표 `0xcedf4` 로
 * StrHOWTO 본문을 보여 준다 (F-8 493줄 · P6 1-2 표).
 */

export { DESCRIPTION_PANEL, FOOTER, HEADBAND, ROW, SCREEN, WHEEL, descriptionPanelTopOf, rowTopOf }

export interface HelpItem {
  readonly id: string
  /** main_ui 프레임 번호 (표 0xceb37) */
  readonly labelFrame: number
  /** 프레임 그림 크기 — PNG 머리에서 읽은 실제 값 (origins.json 은 다 (0,0) 원점이다) */
  readonly labelWidth: number
  readonly labelHeight: number
  /**
   * 설명 글 원문. P6 2d 가 "StrMAINMENU[기준 + 커서]" 라고만 적어 기준을 못 읽었는데,
   * 게임모드 목록(상태 5)이 프레임 6~13 에 StrMAINMENU[6]~[12] 를 붙이는 것과 맞추면
   * 도움말의 기준은 **7** 이다 — 프레임 7·8·9·10·13 ↔ [7]~[11] 이 그대로 모드 설명과 들어맞는다 (유력).
   */
  readonly description: string
  /** 본문 묶음 — `shared/config/helpSections.ts` 의 묶음 이름 */
  readonly sectionTitle: string
}

/**
 * 다섯 칸 — **7 일반모드 · 8 나만의리그 · 9 시즌모드 · 10 대전모드 · 13 홈런더비** (표 0xceb37 확정).
 *
 * ⚠️ StrHOWTO 36쪽 가운데 이 다섯 모드 밖의 묶음(기본 조작 [0]~[4] · 미션모드 [27] ·
 * 스페셜 [28]~[29] · 환경설정 [30]~[31] · 게임문의 [32]~[35])은 **이 화면에 없다.**
 * 기본 조작은 원본이 경기 중 메뉴 [조작방법](I 3절, 0x63688 하위 4)으로 따로 보여 주고,
 * 나머지가 어느 칸에 붙는지는 본문 표 `0xcedf4` 를 아직 못 읽어 알 수 없다.
 * 표 0xceb37 이 "다섯 칸" 으로 확정이라 **칸을 늘리지 않고** 원본대로 다섯만 둔다.
 */
export const HELP_ITEMS: readonly HelpItem[] = [
  {
    id: '일반모드', labelFrame: 7, labelWidth: 97, labelHeight: 27,
    description: '원하는 팀을 선택해 자유롭게!N플레이하는 모드입니다', // StrMAINMENU[7]
    sectionTitle: '일반모드',
  },
  {
    id: '나만의리그', labelFrame: 8, labelWidth: 115, labelHeight: 27,
    description: '나만의 선수를 자유롭게 육성!N할 수 있는 모드입니다', // [8]
    sectionTitle: '나만의리그',
  },
  {
    id: '시즌모드', labelFrame: 9, labelWidth: 98, labelHeight: 27,
    description: '우승을 목표로 1개 팀을 직접!N관리할 수 있는 모드입니다', // [9]
    sectionTitle: '시즌모드',
  },
  {
    id: '대전모드', labelFrame: 10, labelWidth: 96, labelHeight: 27,
    description: '다른 유저의 시즌모드 팀과!N경쟁할 수 있는 모드입니다', // [10]
    sectionTitle: '대전모드',
  },
  {
    id: '홈런더비', labelFrame: 13, labelWidth: 95, labelHeight: 27,
    description: '홈런더비를 통해 타격감을!N향상 시킬 수 있는 모드입니다', // [11]
    sectionTitle: '홈런더비',
  },
]

export const ITEM_COUNT = HELP_ITEMS.length

/** 항목 그림 왼쪽 끝 — 가운데 x = W − 39 − w/2 이므로 오른쪽 끝이 201 에 붙는다 (0x253d4) */
export const rowLeftOf = (item: HelpItem) => ROW.rightEdge - item.labelWidth

/**
 * 본문 창 (상태 37, 그리기 `0x2fccc`) — 공용 판 `0x55e61(skin, 120, 160, 192 × h, 정렬 0x22)`.
 * 환경설정·기록연감과 같은 가운데 192 판이라 값도 같다: x0 = W/2 − 96 = 24, y0 = H/2 − 106 = 54.
 *
 * ⚠️ 창 **안쪽** 배치(쪽 제목 줄·글 시작 y·스크롤 표시)는 표 `0xcedf4` 를 못 읽어 모른다.
 * 기록연감 쪽 제목 줄과 같은 자리(노란 네모 (34, 78) + 제목 (42, 76))를 쓰고
 * 본문은 그 아래 16px 에서 시작한다 — **배치 근사**.
 */
export const BODY_PANEL = {
  x: SCREEN.width / 2 - 96,
  y: SCREEN.height / 2 - 106,
  width: 192,
  height: 212,
  /** 쪽 제목 줄 — 노란 네모 slt_frame 이미지 38 (34, 78) + 제목 (42, 76) */
  bullet: { image: 38, x: 34, y: 78 },
  titleX: 42,
  titleY: 76,
  /** 본문 글 — 판 안쪽 좌우 여백 10px, 제목 줄 아래 */
  textX: 34,
  textY: 94,
  textWidth: 172,
  /** 쪽 넘기기 화살 slt_frame 이미지 20 · 쪽 번호 (기록연감 PAGER 와 같은 자리) */
  pager: {
    arrowImage: 20,
    leftX: SCREEN.width / 2 + 35,
    rightX: SCREEN.width / 2 + 79,
    arrowY: 77,
    numberX: SCREEN.width / 2 + 52,
    y: 76,
  },
} as const
