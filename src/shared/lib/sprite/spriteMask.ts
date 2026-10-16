/**
 * CSS `mask-image` 로 쓰는 스프라이트 주소.
 *
 * **왜 따로 두나** — 브라우저는 `mask-image` 그림을 **CORS 모드**로 받고 `<img>`·`new Image()` 는 **no-cors** 로 받는다.
 * 메모리 캐시는 주소 하나에 한 벌만 두고 모드가 다르면 다시 쓰지 않으므로, 같은 PNG 를 `<img>` 와 마스크가 같이 쓰면
 * 마스크가 받으면서 `<img>` 몫을 밀어내고, 다음 `<img>` 는 서버에 다시 묻는다(`Cache-Control: no-cache` 재검증 —
 * 그동안 빈 그림이다). 메인메뉴 릴의 글자(img_text)가 그림자 마스크와 본 글자 `<img>` 를 같이 써서 매번 이렇게 비었다.
 *
 * 마스크는 `?mask` 를 붙인 다른 주소로 받는다 — 같은 파일이 그대로 오고(정적 서버는 질의를 무시한다) 그림도 같지만
 * 캐시 칸이 갈려 서로 밀어내지 않는다. 미리 받기는 이 주소를 CORS 모드로 받아 두므로(`spriteCache`) 마스크도 첫 그림부터 뜬다.
 */
export const SPRITE_MASK_QUERY = '?mask'

/** 스프라이트 PNG 주소 → 마스크용 주소. 이미 질의가 붙었거나 data: 주소면 그대로 */
export function spriteMaskSrc(src: string): string {
  if (src.startsWith('data:') || src.includes('?')) return src
  return `${src}${SPRITE_MASK_QUERY}`
}

/** `mask-image` 값 — `url(<마스크 주소>)` */
export function spriteMaskImage(src: string): string {
  return `url(${spriteMaskSrc(src)})`
}

/** 마스크용 주소인가 — 이런 주소는 CORS 모드로 받아야 마스크가 캐시를 그대로 쓴다 */
export function isSpriteMaskSrc(src: string): boolean {
  return src.endsWith(SPRITE_MASK_QUERY)
}
