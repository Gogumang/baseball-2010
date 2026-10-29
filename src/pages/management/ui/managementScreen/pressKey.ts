/** 누름 칸이 보내는 키 — 메뉴 훅의 window 키 듣개가 그대로 받는다 */
export const pressKey = (key: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key }))
