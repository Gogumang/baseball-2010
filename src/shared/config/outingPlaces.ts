/**
 * 외출 장소와 특수 기능 (나만의리그).
 *
 * 장소·기능·효과의 **방향**은 원작 설명서 StrHOWTO[16] 원문이다:
 *
 *   경기장 : 팬미팅 — 높은 인기도 상승과 소량의 사기 회복. 소지금 소모
 *   번화가 : 외식   — 사기를 대폭 회복. 소지금 소모
 *   병원   : 입원   — 부상·질병 회복, 소량의 사기 회복. 소지금 소모
 *   학교   : 야구교실 — 인기도와 평판이 상승
 *   방송국 : CF촬영 — 소량의 인기도 상승과 소지금 획득. 단, 평판이 하락
 *
 * 소지금과 필요 인기도는 원본 표다 (점검 에이전트, 0x16cf0): 소지금 0xcc344(100만 단위) · 필요 인기도 0xcc402.
 * **사기·인기도·평판 변화량은 아직 못 읽어 우리가 정한 값이다.**
 *
 * 헷갈리기 쉬운 원문 두 가지:
 * - StrITEM[150~154] "경기장 [팬미팅] 시 인기도 +2" 등은 장소 기본 효과가 아니라
 *   서브아이템 93~97(화보집·외식회원증·보험증서·야구교본·명품정장)을 가졌을 때의 **추가** 효과다
 *   (StrHOWTO[16] "서브 아이템을 통해 효과를 증가 시킬 수 있습니다"). 서브아이템은 아직 없다.
 * - 친선경기·회식·구단CF(StrHOWTO[22], StrITEM[220~224])는 **시즌모드** 외출이다.
 *   StrHOWTO[17]~[22] 가 시즌모드 설명 구간이고, StrMODE 의 스케줄 목록도 앞 5개와 뒤 5개로 나뉜다.
 */
/** [a, b) 난수 범위. 둘 다 음수면 −[|a|, |b|) (사기 하락 — 0x152e4) */
export type OutingRange = readonly [number, number]

/**
 * 외출 기능 효과 표 (0x15234 — 점검 10차): 인기도 0xcc358 · 평판 0xcc34e · 사기 0xcc33a 는 u8 [a, b) 쌍,
 * 소지금 0xcc344 는 100만원 단위 (−5,−1,−2,0,+8). 난수를 뽑는 순서(인기도 → 평판 → 사기)는 추정.
 */
export interface OutingEffect {
  /** 만원 단위. 음수면 벌어들인다. */
  readonly moneyCost: number
  readonly popularity: OutingRange
  readonly reputation: OutingRange
  readonly morale: OutingRange
  /** 부상·질병을 낫게 하는가 */
  readonly healsInjury: boolean
}

/** 난수를 뽑은 뒤의 효과 — 서브 아이템 보정은 이 값에 더한다 */
export interface RolledOutingEffect {
  readonly moneyCost: number
  readonly moraleGain: number
  readonly popularityGain: number
  readonly reputationGain: number
  readonly healsInjury: boolean
}

export interface OutingFunction {
  readonly id: string
  readonly name: string
  readonly description: string
  /** 이 인기도 이상이어야 할 수 있다 — 모자라면 StrMODE[62] */
  readonly requiredPopularity: number
  readonly effect: OutingEffect
}

export interface MapBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * 장소 배치 — ui/event_map.pzx 프레임 1~5 (지도 좌표, 바이트 확인).
 * 프레임마다 건물 파트 하나와 박스 4개가 있다. 0x7ea64 가 박스 0~3 을 읽는다.
 * 박스 역할은 크기와 애니메이션 표로 맞춘 것이다 (추정): 0 이름칸 · 1 선택 화살표(애니 0) · 2 [!](애니 1) · 3 말풍선(70×42)
 */
export interface OutingPlace {
  readonly id: string
  readonly name: string
  /** event_map 합성 프레임 번호 — 원점이 곧 지도 위 위치다 */
  readonly frame: number
  readonly left: number
  readonly top: number
  /** img_text 이름 그림 프레임 */
  readonly labelFrame: number
  readonly nameBox: MapBox
  readonly cursorBox: MapBox
  readonly markerBox: MapBox
  readonly bubbleBox: MapBox
  readonly functions: readonly OutingFunction[]
}

const box = (x: number, y: number, width: number, height: number): MapBox => ({ x, y, width, height })

const MAP = './sprites/event_map'

export const OUTING_PLACES: readonly OutingPlace[] = [
  {
    id: 'stadium',
    name: '경기장',
    frame: 1,
    left: 64,
    top: 119,
    labelFrame: 229,
    nameBox: box(92, 166, 39, 16),
    cursorBox: box(101, 108, 26, 21),
    markerBox: box(131, 156, 21, 26),
    bubbleBox: box(128, 129, 70, 42),
    functions: [
      {
        id: '팬미팅',
        name: '팬미팅',
        description: '높은 인기도 상승과 소량의 사기 회복. 소지금을 소모한다',
        requiredPopularity: 600,
        effect: { moneyCost: 500, popularity: [4, 7], reputation: [0, 1], morale: [2, 4], healsInjury: false },
      },
    ],
  },
  {
    id: 'downtown',
    name: '번화가',
    frame: 2,
    left: 127,
    top: 77,
    labelFrame: 230,
    nameBox: box(115, 77, 40, 18),
    cursorBox: box(163, 61, 27, 24),
    markerBox: box(194, 72, 20, 26),
    bubbleBox: box(156, 88, 70, 42),
    functions: [
      {
        id: '외식',
        name: '외식',
        description: '사기를 대폭 회복한다. 소지금을 소모한다',
        requiredPopularity: 0,
        effect: { moneyCost: 100, popularity: [0, 1], reputation: [0, 1], morale: [25, 31], healsInjury: false },
      },
    ],
  },
  {
    id: 'hospital',
    name: '병원',
    frame: 3,
    left: 0,
    top: 84,
    labelFrame: 231,
    nameBox: box(7, 137, 30, 13),
    cursorBox: box(31, 88, 26, 22),
    markerBox: box(36, 124, 20, 26),
    bubbleBox: box(49, 113, 70, 42),
    functions: [
      {
        id: '입원',
        name: '입원',
        description: '부상과 질병을 회복시키고 소량의 사기를 회복한다',
        requiredPopularity: 0,
        effect: { moneyCost: 200, popularity: [0, 1], reputation: [0, 1], morale: [3, 6], healsInjury: true },
      },
    ],
  },
  {
    id: 'school',
    name: '학교',
    frame: 4,
    left: 179,
    top: 143,
    labelFrame: 232,
    nameBox: box(206, 197, 27, 15),
    cursorBox: box(199, 127, 27, 23),
    markerBox: box(185, 186, 20, 27),
    bubbleBox: box(132, 155, 70, 42),
    functions: [
      {
        id: '야구교실',
        name: '야구교실',
        description: '인기도와 평판이 상승한다',
        requiredPopularity: 200,
        effect: { moneyCost: 0, popularity: [1, 4], reputation: [3, 6], morale: [-8, -11], healsInjury: false },
      },
    ],
  },
  {
    id: 'broadcast',
    name: '방송국',
    frame: 5,
    left: 78,
    top: 209,
    labelFrame: 233,
    nameBox: box(106, 273, 39, 15),
    cursorBox: box(113, 200, 24, 22),
    markerBox: box(145, 261, 23, 27),
    bubbleBox: box(39, 213, 70, 42),
    functions: [
      {
        id: 'CF촬영',
        name: 'CF촬영',
        description: '소량의 인기도 상승과 소지금을 획득한다. 단, 평판이 하락한다',
        requiredPopularity: 400,
        effect: { moneyCost: -800, popularity: [2, 5], reputation: [8, 11], morale: [-16, -21], healsInjury: false },
      },
    ],
  },
]

export const MAP_FRAMES = `${MAP}/frames`
/** 지도 한 장(240×297)은 프레임 0 */
export const MAP_FRAME = 0
/**
 * 프레임 6 은 길 점선이 아니라 **창문 불빛**이고, 밤(시간대 2 = 20~5시)에만 그린다 (0x7eba2, F-2 2-3).
 * 웹에는 아직 시간대가 없어 쓰지 않는다.
 */
export const NIGHT_WINDOW_FRAME = 6
/** 애니메이션 0 = 선택 화살표(프레임 7·8), 1 = [?] 표시(프레임 9·10), 2 = [!] 표시(프레임 11·12) */
export const CURSOR_ANIMATION = 0
/** 설명서 StrHOWTO[16] 이 [!] 아이콘이라 부르므로 2 를 쓴다. [?] 를 언제 쓰는지는 미확인 */
export const EVENT_MARKER_ANIMATION = 2
export const PLACE_LABEL_FRAMES = './sprites/img_text/frames'
