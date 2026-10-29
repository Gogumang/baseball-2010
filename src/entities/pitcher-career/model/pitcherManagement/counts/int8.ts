/** 칸은 s8 (ldrsb · strb) — 아래 8비트를 부호 있는 값으로 읽는다 */
export const toInt8 = (value: number) => ((value & 0xff) << 24) >> 24
