export type Child = Node | string | number | false | null | undefined | Child[]

export interface ElOptions {
  class?: string
  id?: string
  title?: string
  text?: string
  html?: string
  attrs?: Record<string, string | number | boolean | undefined>
  props?: Record<string, unknown>
  on?: Record<string, (event: any) => void>
  dataset?: Record<string, string | number>
  style?: string
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElOptions = {},
  children: Child[] | Child = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (options.class) node.className = options.class
  if (options.id) node.id = options.id
  if (options.title) node.title = options.title
  if (options.style) node.setAttribute('style', options.style)
  if (options.text !== undefined) node.textContent = options.text
  if (options.html !== undefined) node.innerHTML = options.html
  if (options.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) {
      if (value === undefined || value === false) continue
      node.setAttribute(key, value === true ? '' : String(value))
    }
  }
  if (options.props) Object.assign(node, options.props)
  if (options.on) {
    for (const [type, listener] of Object.entries(options.on)) {
      node.addEventListener(type, listener as EventListener)
    }
  }
  if (options.dataset) {
    for (const [key, value] of Object.entries(options.dataset)) node.dataset[key] = String(value)
  }
  appendChildren(node, children)
  return node
}

type AppendTarget = HTMLElement | DocumentFragment

function appendOne(node: AppendTarget, child: Child): void {
  if (child === false || child === null || child === undefined) return
  if (Array.isArray(child)) {
    for (const item of child) appendOne(node, item)
    return
  }
  node.append(child instanceof Node ? child : document.createTextNode(String(child)))
}

export function appendChildren(node: AppendTarget, children: Child[] | Child): void {
  appendOne(node, children)
}

export function clear(node: HTMLElement): void {
  node.replaceChildren()
}

export function mount(node: HTMLElement, children: Child[] | Child): void {
  clear(node)
  appendChildren(node, children)
}

export function svgIcon(name: string, size = 18): SVGSVGElement {
  const paths: Record<string, string> = {
    projects: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v5"/>',
    source: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    editor: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    materials: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    preview: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    drawing: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    print: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    warning: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    cube: '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '1.7')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.innerHTML = paths[name] ?? paths.cube
  return svg
}

export function toast(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
  let host = document.querySelector<HTMLDivElement>('.toast-host')
  if (!host) {
    host = h('div', { class: 'toast-host' })
    document.body.append(host)
  }
  const item = h('div', { class: `toast toast-${type}`, text: message })
  host.append(item)
  window.setTimeout(() => {
    item.classList.add('toast-leave')
    window.setTimeout(() => item.remove(), 220)
  }, 2800)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(Math.round(value))
}

export function downloadText(filename: string, text: string, type = 'text/plain'): void {
  const blob = new Blob([text], { type: `${type};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
