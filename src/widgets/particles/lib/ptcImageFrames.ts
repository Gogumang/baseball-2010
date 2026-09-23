/**
 * `ptc/ptcimg.pzx` 의 **프레임 → 파트** 표.
 *
 * 입자 그림은 `.ptc` 파일에 없다 — 호출 인자 `img` 가 이 pzx 의 프레임 번호이고,
 * 그리기 0x6dc4c 가 그 프레임의 **파트 목록**을 애니 칸처럼 써서 `파트[ life % 파트수 ]` 를 고른다
 * (R5 7·8절 확정, 나머지 0xca911).
 *
 * ⚠️ `public/sprites/ptcimg/frames/*.png` 는 **파트를 겹쳐 합성한 그림**이라 파티클에 쓰면 안 된다.
 *    쓸 것은 파트 한 장씩인 `public/sprites/ptcimg/000~050.png` 51장이다.
 *
 * 표는 `tools/decode_pzx.py` 의 `parse_frame` 으로 `base/work/jar/ptc/ptcimg.pzx` 를 읽어 뽑았다
 * (프레임 17개 · 파트 그림 51장). `dx`·`dy` 는 파트가 프레임 원점에서 밀린 값이고,
 * `flip` 은 파트 효과 3(좌우 뒤집기) 이다 — 프레임 12 하나만 켜져 있다.
 */
export interface PtcPart {
  /** 파트 그림 번호 → `public/sprites/ptcimg/NNN.png` */
  readonly image: number
  readonly dx: number
  readonly dy: number
  /** 좌우 뒤집기 (파트 효과 3) */
  readonly flip?: true
}

export const PTC_IMAGE_FRAMES: readonly (readonly PtcPart[])[] = [
  [{ image: 20, dx: -5, dy: -6 }, { image: 19, dx: -10, dy: -10 }, { image: 18, dx: -12, dy: -14 }],
  [{ image: 21, dx: -5, dy: -5 }],
  [{ image: 22, dx: -9, dy: -8 }, { image: 23, dx: -9, dy: -8 }, { image: 24, dx: -9, dy: -8 }],
  [{ image: 25, dx: -10, dy: -14 }, { image: 26, dx: -16, dy: -16 }, { image: 27, dx: -12, dy: -15 }],
  [{ image: 42, dx: -6, dy: -6 }, { image: 43, dx: -6, dy: -6 }, { image: 44, dx: -5, dy: -5 }],
  [
    { image: 13, dx: -12, dy: -12 },
    { image: 12, dx: -11, dy: -12 },
    { image: 11, dx: -11, dy: -9 },
    { image: 10, dx: -9, dy: -8 },
    { image: 9, dx: -6, dy: -6 },
  ],
  [{ image: 1, dx: -9, dy: -9 }, { image: 2, dx: -9, dy: -9 }, { image: 3, dx: -8, dy: -9 }],
  [
    { image: 8, dx: -18, dy: -14 },
    { image: 7, dx: -19, dy: -13 },
    { image: 6, dx: -21, dy: -13 },
    { image: 5, dx: -20, dy: -13 },
    { image: 4, dx: -23, dy: -11 },
  ],
  [
    { image: 17, dx: -10, dy: -8 },
    { image: 16, dx: -10, dy: -8 },
    { image: 15, dx: -7, dy: -4 },
    { image: 14, dx: -6, dy: -4 },
  ],
  [{ image: 45, dx: -3, dy: -3 }, { image: 46, dx: -3, dy: -3 }, { image: 47, dx: -3, dy: -3 }],
  [{ image: 48, dx: -7, dy: -7 }, { image: 49, dx: -3, dy: -3 }, { image: 50, dx: -3, dy: -3 }],
  [{ image: 28, dx: -39, dy: -14 }],
  [{ image: 28, dx: -21, dy: -14, flip: true }],
  [{ image: 29, dx: -5, dy: -4 }],
  [
    { image: 30, dx: -4, dy: -4 },
    { image: 31, dx: -3, dy: -4 },
    { image: 32, dx: -2, dy: -3 },
    { image: 33, dx: -4, dy: -2 },
  ],
  [
    { image: 34, dx: -4, dy: -4 },
    { image: 35, dx: -3, dy: -4 },
    { image: 36, dx: -2, dy: -3 },
    { image: 37, dx: -4, dy: -2 },
  ],
  [
    { image: 38, dx: -4, dy: -4 },
    { image: 39, dx: -3, dy: -4 },
    { image: 40, dx: -2, dy: -3 },
    { image: 41, dx: -4, dy: -2 },
  ],
]

/** 파트 그림 한 장의 주소 */
export const PTC_PART_IMAGE = (index: number) => `./sprites/ptcimg/${String(index).padStart(3, '0')}.png`

/** 이번 틱에 그릴 파트 — `파트[ life % 파트수 ]` (0x6dc6a) */
export function ptcPartOf(img: number, life: number): PtcPart | null {
  const parts = PTC_IMAGE_FRAMES[img]
  if (parts === undefined || parts.length === 0) return null
  // life 는 0 밑으로 내려가지 않지만 나머지가 음수가 되지 않게 한 번 감싼다
  return parts[((life % parts.length) + parts.length) % parts.length]
}
