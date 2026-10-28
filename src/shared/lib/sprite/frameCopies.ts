/**
 * **부른 쪽 효과 0x11(뒤집기) = 파트 효과 없이 복사** — 반투명 파트가 든 프레임의 복사판(`frames/copy/NNN.png`).
 *
 * 원본 프레임 그리기 0xc9f98 (직접 뜸):
 * ```
 * ca074  [sp+0x2c](부른 쪽 효과) == 0x11 → ca07c 뒤집기 갈래
 * ca088~ca0d0  파트마다 이미지 그리기 vt+0xc(X − (dx + 폭), Y + dy, …, 효과 0x11, 축 b) — 파트+0x10 · +0x14 를 안 읽는다
 * ```
 * 곧 0x66(반투명 L/16) 파트도 섞지 않고 **불투명하게 그대로** 찍힌다. 구운 `frames/NNN.png` 는 0x66 파트를 섞어 두었으므로
 * `tools/decode_pzx.py` 의 `write_frame_copies` 가 반투명 효과를 뺀 판을 따로 낸다(원점은 구운 프레임과 같다).
 * 뒤집어 그리는 자리(우타 타자 0x78d16 · 좌투 투구 바람 38df0 · 좌타 돌발 초상 0x8f310)만 이 판을 쓴다.
 */

/** `copy.json` 을 둔 폴더 — 0x66 파트가 있는 프레임을 뒤집어 그리는 곳만 (`frameCopies.test` 가 파일과 맞춰 본다) */
export const FRAME_COPY_FOLDERS: ReadonlySet<string> = new Set([
  'event_char_0',
  'event_char_1',
  'item_bat_head_3',
  'item_bat_head_4',
  'item_bat_head_5',
  'item_bat_head_6',
  'player_effect',
])

/** `./sprites/player_effect/frames` → 복사판 목록이 있는가 */
export function hasFrameCopies(framesFolder: string): boolean {
  const match = /sprites\/([^/]+)\/frames$/.exec(framesFolder)
  return match !== null && FRAME_COPY_FOLDERS.has(match[1])
}

export const frameCopiesUrl = (framesFolder: string) => `${framesFolder}/copy.json`
export const frameCopyUrl = (framesFolder: string, frame: number) => `${framesFolder}/copy/${String(frame).padStart(3, '0')}.png`

/** 받은 `copy.json`(모양이 틀리면 빈 목록)에 그 프레임이 있는가 */
export function isCopiedFrame(listing: unknown, frame: number): boolean {
  return Array.isArray(listing) && listing.includes(frame)
}

/** 받은 `copy.json` 에서 고른 프레임들의 복사판 주소 (미리 받기) */
export function frameCopyUrlsOf(framesFolder: string, listing: unknown, frames: readonly number[]): string[] {
  return [...new Set(frames)].filter((frame) => isCopiedFrame(listing, frame)).map((frame) => frameCopyUrl(framesFolder, frame))
}

/**
 * 뒤집어 그릴 프레임의 그림 주소 — 목록에 있으면 복사판, 아니면(목록이 아직이거나 반투명 파트가 없으면) 구운 프레임.
 * `listing` 이 아직 null 이면 구운 프레임(예전 근사)이다.
 */
export function flippedFrameUrlOf(framesFolder: string, frame: number, listing: unknown): string {
  return hasFrameCopies(framesFolder) && isCopiedFrame(listing, frame)
    ? frameCopyUrl(framesFolder, frame)
    : `${framesFolder}/${String(frame).padStart(3, '0')}.png`
}
