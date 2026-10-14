/**
 * 경기진행 설정 창이 쓰는 **원본 문구와 이름 그림**.
 *
 * 근거: `docs/re/_raw/notes/R4-lineup-screens.md` 4절 (값 ↔ 표시 문구 표) ·
 *      `docs/re/J-modes-rules.md` J-3.
 *
 * ── 어디서 왔나
 * - **설명 8개**는 binary.mod 안의 낱개 문자열이다(StrMODE 도 StrMAINMENU 도 아니다).
 *   R4 4절이 적은 VA 를 그대로 달아 두었다. 마크업(`!C`·`!cffffff`·`!N`)까지 원본 그대로다.
 * - **상세 네 줄 설명·확인·경고**는 `data/StrMAINMENU.zt1` 의 [121]~[126] 이다.
 *   StrMAINMENU 는 아직 `shared/config/original` 에 생성물이 없다. 그래서
 *   `shared/config/original/mainMenu.ts` 와 같은 관례로 **번호를 달아 옮겨 적는다** —
 *   생성물이 생기면 `ORIGINAL_MAIN_MENU_TEXT[121]` 처럼 번호로 읽도록 바꿀 것.
 *   원문은 원본 파일에서 직접 읽어 확정했다(2026-10-14): `base/work/jar/data/StrMAINMENU.zt1` = u32 크기 · u32 해제 크기 · zlib,
 *   푼 것은 'GST\x01' · u16 개수 215 · u16 시작 위치 × 개수 · CP949 글(끝 0). [121] 은 **끝에 빈칸이 하나 붙어 있다**(원본 그대로).
 *   그리기 0x6042c 는 [skin+0x2a4] 표에서 0x702b5(표, 121 + 줄)로 읽는다(61b1c~61b2a).
 * - **이름 그림**은 `ui/img_text.pzx` 합성 프레임이다(`public/sprites/img_text/frames`).
 */

/** 이름 그림 폴더 — 다른 화면들과 같은 경로 관례 */
export const IMG_TEXT = './sprites/img_text/frames'

/** 종류 이름 그림 (표 0xd1c70) — 0 찬스 · 1 이닝 · 2 상세 */
export const KIND_LABEL_FRAMES = [399, 400, 401] as const

/** 종류 이름 — 그림에 그려진 글자 그대로다 (읽기 보조·테스트용) */
export const KIND_LABELS = ['찬스 플레이', '이닝 플레이', '상세 플레이'] as const

/** 종류 설명 (표 0xd1c7c) — 0xd2180 · 0xd21b8 · 0xd21fc */
export const KIND_DESCRIPTIONS = [
  '!C!cffffff미리 정해진 상황에 맞춰!N플레이를 진행합니다', // 0xd2180
  '!C!cffffff시작 이닝을 선택하여 경기!N중간부터 시작 할 수 있습니다', // 0xd21b8
  '!C!cffffff유저가 조작할 선수와 시점을!N자유롭게 선택할 수 있습니다', // 0xd21fc
] as const

/**
 * 찬스 값 설명 (표 0xd1c88) — 0xd2240 · 0xd2280. 고른 값의 글 하나만 설명 칸에 나온다.
 *
 * 찬스 두 칸은 이름 그림 표가 따로 없고, 그리기 0x6042c 가 그림을 곧바로 부른다(607b4~60a40):
 * popup 프레임 19(방망이) · 20(글러브) 위에 img_text 352 "공격" · 338 "수비" (`CHANCE_LABELS`).
 */
export const CHANCE_DESCRIPTIONS = [
  '!C!cffffff공격 중 2, 3루에 주자가 있을!N때 타자로 플레이 합니다', // 0xd2240 — 값 0
  '!C!cffffff수비 중 3루에 주자가 있을 때!N투수로 플레이 합니다', // 0xd2280 — 값 1
] as const

/** 찬스 두 칸 이름 — img_text 352 "공격" · 338 "수비" 그림 글자 그대로 (읽기 보조·테스트용) */
export const CHANCE_LABELS = ['공격', '수비'] as const

/** 이닝 값 이름 그림 (표 0xd1c90) — 404 "자동진행 없음" · 405 "3이닝 자동진행" · 406 "6이닝 자동진행" */
export const INNING_LABEL_FRAMES = [404, 405, 406] as const

/** 이닝 값 이름 — 그림 글자 그대로 */
export const INNING_LABELS = ['자동진행 없음', '3이닝 자동진행', '6이닝 자동진행'] as const

/** 이닝 값 설명 (표 0xd1c9c) — 0xd22c0 · 0xd22ec · 0xd2334 */
export const INNING_DESCRIPTIONS = [
  '!C!cffffff모든 이닝을 직접!N플레이 합니다', // 0xd22c0 — 값 0
  '!C!cffffff설정된 3이닝까지 자동 진행 후!N다음 이닝부터 플레이 합니다', // 0xd22ec — 값 1 (4회부터)
  '!C!cffffff설정된 6이닝까지 자동 진행 후!N다음 이닝부터 플레이 합니다', // 0xd2334 — 값 2 (7회부터)
] as const

/** 상세 네 줄 이름 (줄 +0xe6 = 0~3) — 설명 문구의 대괄호 안 이름 그대로다 */
export const DETAIL_ROW_LABELS = ['타자조작', '공격주자', '투수조작', '수비주자'] as const

/** 상세 마지막 줄 (+0xe6 = 4) */
export const DETAIL_CONFIRM_LABEL = '확인'

/** 상세 네 줄 설명 — StrMAINMENU[121]~[124] */
export const DETAIL_ROW_DESCRIPTIONS = [
  '!cFFFFFF[!cFFFF00타자조작!cFFFFFF]: 지정한 타순 타자만 플레이합니다 ', // [121] — 끝 빈칸까지 원문
  '!cFFFFFF[!cFFFF00공격주자!cFFFFFF]: 공격 시 해당 베이스 주자 있을 때 플레이합니다', // [122]
  '!cFFFFFF[!cFFFF00투수조작!cFFFFFF]: 지정한 이닝에 투수 수비를 플레이합니다', // [123]
  '!cFFFFFF[!cFFFF00수비주자!cFFFFFF]: 수비 시 해당 베이스 주자 있을 때 플레이합니다', // [124]
] as const

/** 확인창 — StrMAINMENU[125] (0x74ef5, skin+0x314 = 1) */
export const CONFIRM_TEXT = '!C!cFFFFFF현재 설정으로 플레이!N하시겠습니까?' // [125]

/** 상세에서 한 항목도 안 골랐을 때 — StrMAINMENU[126] (0x60240) */
export const NO_DETAIL_TEXT = '!C!cFFFFFF상세 설정된 항목이!N없습니다. 최소 한가지!N항목은 선택해야 합니다' // [126]

/** 확인창 버튼 — 원본 예/아니오 팝업 (그림은 `ui/popup.pzx` 1·2) */
export const CONFIRM_BUTTONS = ['예', '아니오'] as const

/** 알림창 버튼 — 원본 알림 팝업 (그림 0 "OK") */
export const NOTICE_BUTTONS = ['확인'] as const
