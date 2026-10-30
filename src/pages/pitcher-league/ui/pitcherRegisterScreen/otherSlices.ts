/**
 * 투수 등록 화면이 쓰는 **다른 조각** — 타자 등록과 같은 줄 키 0x16f28(`pages/create-player`) · 공 무늬 바탕(`pages/special`) ·
 * 관리 화면 그림 층(`pages/management`). 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다.
 */
export { nameWithoutLastChar, registerKeyOf, registerKeyOutcomeOf } from '@/pages/create-player/lib/registerKeys'
export type { RegisterKey } from '@/pages/create-player/lib/registerKeys'
export { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
export * as managementStyles from '@/pages/management/ui/ManagementScreen.css'
