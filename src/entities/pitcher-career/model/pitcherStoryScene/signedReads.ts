/** s8 로 읽는다 (ldrsb) — 아래 8비트를 부호 있는 값으로 */
export const toInt8 = (value: number) => ((value & 0xff) << 24) >> 24
/** s16 로 읽는다 — 통산 합산 0x9da28 은 u16 로 적고(strh) 조건은 ldrsh 로 읽는다 */
export const toInt16 = (value: number) => ((value & 0xffff) << 16) >> 16
/** u8 로 읽는다 (ldrb) */
export const toUint8 = (value: number) => value & 0xff
