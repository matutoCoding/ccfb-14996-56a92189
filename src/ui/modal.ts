import { appendChildren, h, type Child } from './dom'

export interface ModalHandle {
  close: () => void
  body: HTMLDivElement
}

export function openModal(title: string, content: Child): ModalHandle {
  const body = h('div', { class: 'modal-body' })
  const backdrop = h('div', { class: 'modal-backdrop' })
  const close = () => {
    backdrop.remove()
    document.removeEventListener('keydown', onKey)
  }
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close()
  }
  const modal = h('div', { class: 'modal', attrs: { role: 'dialog', 'aria-modal': 'true' } }, [
    h('div', { class: 'modal-head' }, [
      h('div', { class: 'modal-title', text: title }),
      h('button', { class: 'btn btn-ghost sm', text: '关闭', on: { click: close } }),
    ]),
    body,
  ])
  backdrop.append(modal)
  backdrop.addEventListener('pointerdown', (event) => {
    if (event.target === backdrop) close()
  })
  document.addEventListener('keydown', onKey)
  appendChildren(body, content)
  document.body.append(backdrop)
  return { close, body }
}
