import { createContext } from 'react'

/**
 * 바텀시트를 붙일 화면 요소.
 *
 * 셀렉트박스는 보통 position:absolute 인 칸 안에 놓인다. 그 자리에서 시트를 그리면
 * 시트가 화면이 아니라 그 작은 칸을 덮어 잘린다 — 그래서 화면 요소로 포털을 연다.
 */
export const SheetHostContext = createContext<HTMLElement | null>(null)
