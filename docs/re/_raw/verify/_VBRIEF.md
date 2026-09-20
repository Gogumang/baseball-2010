# 검증 지침 (교차 확인)

검증 대상 문서: /Users/evan123/Desktop/code/baseball-2010-re/docs/re/<주제>.md
각 문서 구조: 1절 "구현 명세"(정리한 사람이 요약한 것) → 2절 원본 버그 → 3절 미해결 → 4절 해독 노트 전문(원 해독 에이전트가 쓴 것).
원본: /Users/evan123/Desktop/code/baseball-2010/base/work/jar/binary.mod (ARM Thumb, VA = 파일오프셋 + 0xfcc)
디스어셈 도우미: /private/tmp/claude-501/-Users-evan123-Desktop-code-baseball-2010/a8d7dac6-6002-4b07-af77-039dbed151f1/scratchpad/re
  (re dis <VA> [줄] · re func <VA> · re xref <VA> · re xval <값> · re u8|s8|u16|s16|u32 <VA> <개수> · re str <VA> · re findstr <글>)
웹 코드(검증 기준): /Users/evan123/Desktop/code/baseball-2010-re/src (main 2fa9283 과 같다)
셸의 grep·find 함수는 깨져 있다 → /usr/bin/grep, /usr/bin/find 를 쓸 것.

## 할 일
문서 1절의 항목마다 핵심 주장(식·표 값·주소·조건·웹 파일:줄)을 뽑아 **직접** 확인한다. 해독 노트를 믿지 말고 바이너리와 웹 코드를 다시 읽을 것.
- 표 값: re u8/s8/u16… 로 주소에서 직접 읽어 비교
- 식·분기: re dis 로 해당 주소 부근을 읽어 비교 (60줄 이하로 나눠)
- 웹 주장("웹은 X 한다", 파일:줄): 웹 파일을 열어 실제 코드와 비교
- 1절 요약이 4절 노트와 어긋나는 곳(옮겨 적기 실수)도 찾는다

## 결과 판정 (항목마다 하나)
✅ 맞음(무엇으로 확인했는지 한 줄) · ❌ 틀림(실제 값/코드와 근거) · ⚠️ 확인 불가(왜) · 📝 옮겨 적기 실수(1절 ↔ 4절)

## 규칙
- **저장소 파일(docs 포함)을 고치지 말 것.** 결과는 지정된 검증 파일에만 쓴다. git 명령 금지.
- **항목 하나를 확인할 때마다 결과 파일에 바로 덧붙여 저장** (네트워크 끊김이 잦다).
- 공 궤적 투영 코드는 해석하지 말 것(안전 필터 주제).
- 결과 파일 첫머리에 요약: 확인한 항목 수, ❌·📝 목록.
