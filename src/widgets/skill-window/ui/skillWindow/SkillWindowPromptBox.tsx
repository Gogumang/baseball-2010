import { MessageBox } from '@/shared/ui'
import type { SkillWindowState } from '@/widgets/skill-window/model/useSkillWindowState'

/** 창의 대화 — 대화의 단추 클릭이 창 바깥 클릭(닫기)으로 번지지 않게 막는다. 대화 뒤에도 창은 남는다(0x147b0) */
export function SkillWindowPromptBox({ state }: { readonly state: SkillWindowState }) {
  const { prompt, setPrompt } = state
  return (
    <div onClick={(event) => event.stopPropagation()}>
      {prompt?.kind === '질문' && (
        <MessageBox
          text={prompt.text}
          buttons={['예', '아니오']}
          onAnswer={(answer) => {
            const pending = prompt
            setPrompt(null)
            if (answer === 0) pending.onYes()
            else pending.onNo?.()
          }}
        />
      )}
      {prompt?.kind === '알림' && <MessageBox text={prompt.text} buttons={['확인']} onAnswer={() => setPrompt(null)} />}
    </div>
  )
}
