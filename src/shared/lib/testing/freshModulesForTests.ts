import { vi } from 'vitest'

/**
 * 시험 준비 파일 — 격리를 끈 화면 무리(`dom`, `tools/vitestProjects.ts`)의 **맨 앞**에 싣는다. 앞 파일이 읽은 앱 모듈을 버려
 * 이 파일이 앱 모듈(과 그 모듈 상태 — 스킨 깜빡이 셈 · 앱 틱 · 공용 창 셈 …)을 처음부터 다시 읽게 한다.
 * 바깥 꾸러미(react · react-dom · testing-library)는 Node 가 들고 있어 다시 읽지 않는다 — 격리 비용의 대부분이 그쪽이다(r364).
 */
vi.resetModules()
