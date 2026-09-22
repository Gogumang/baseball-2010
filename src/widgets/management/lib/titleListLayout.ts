/**
 * 칭호(닉네임) 목록 창 배치 — 나만의리그 관리 장면 **하위 상태 129** (P3 10-1 · R9 「119·129·120」).
 *
 * ⚠️ **좌표는 전부 근사다.** 원본 그리기 함수 0x198fc 는 "이름 = StrNICKNAME[i], 장착한 것만 다른 색"
 * 까지만 풀려 있고 (0x19abe~0x19ad4 · 0x19ae8~0x19af6), 창 틀·칸 좌표는 어느 문서에도 없다.
 * 그래서 같은 장면 위에 뜨는 **필살타법 창(0x803d4, 확정 좌표)** 의 틀을 빌려 줄만 채운 모양이다.
 */

/** 창 틀 — 필살타법 창(24,71,192×151)과 같은 자리에 둔다 (근사) */
export const TITLE_LIST_WINDOW = { x: 24, y: 71, width: 192, height: 151 } as const

/** 제목칸 — img_text 프레임은 확인 못 해 글자로 적는다 (근사) */
export const TITLE_HEADER = { x: 30, y: 76, width: 180, height: 14 } as const

/** 줄 한 칸 (근사). 한 화면 9줄은 **확정**이다 — 목록 객체에 `min(개수, 9)` 로 넣는다 (0x104cc) */
export const ROW = { x: 32, width: 176, height: 13 } as const
export const ROW_TOP = 94
