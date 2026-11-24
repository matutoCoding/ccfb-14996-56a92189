import './styles.css'
import { h, svgIcon } from './ui/dom'
import { ensureSeeded } from './db/db'
import { renderProjects } from './pages/projects'
import { renderSource } from './pages/source'
import { renderEditor } from './pages/editor'
import { renderMaterials } from './pages/materials'
import { renderPreview } from './pages/preview'
import { renderDrawings } from './pages/drawings'

type PageHandle = { destroy?: () => void } | void

const routes = [
  { path: '/projects', label: '项目列表', icon: 'projects' },
  { path: '/source', label: '原稿处理', icon: 'source' },
  { path: '/editor', label: '排块编辑', icon: 'editor' },
  { path: '/materials', label: '材料库', icon: 'materials' },
  { path: '/preview', label: '墙面预览', icon: 'preview' },
  { path: '/drawings', label: '施工图', icon: 'drawing' },
] as const

function parseRoute(): { path: string; query: URLSearchParams } {
  const raw = window.location.hash.slice(1) || '/projects'
  const [path, queryString = ''] = raw.split('?')
  return { path: path || '/projects', query: new URLSearchParams(queryString) }
}

function renderShell(activePath: string, pageHost: HTMLElement): void {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return
  app.replaceChildren(
    h('div', { class: 'app-shell' }, [
      h('aside', { class: 'sidebar' }, [
        h('div', { class: 'brand' }, [
          h('div', { class: 'brand-mark' }, [svgIcon('cube', 22)]),
          h('div', { class: 'brand-text' }, [
            h('div', { class: 'brand-title', text: 'Mosaic Light' }),
            h('div', { class: 'brand-sub', text: '排块 · 光照 · 施工图' }),
          ]),
        ]),
        h('nav', { class: 'nav' }, routes.map((route) => h('a', {
          class: `nav-link ${activePath.startsWith(route.path) ? 'active' : ''}`,
          attrs: { href: `#${route.path}` },
        }, [svgIcon(route.icon, 18), h('span', { text: route.label })]))),
        h('div', { class: 'sidebar-foot' }, [
          h('strong', { text: 'WebGL2 Instancing' }),
          h('div', { text: '20 万块单 Draw Call · IndexedDB 本地存储 · Lab/CIEDE2000 配色' }),
        ]),
      ]),
      pageHost,
    ]),
  )
}

async function route(): Promise<void> {
  const { path, query } = parseRoute()
  let pageHost = document.querySelector<HTMLElement>('#page')
  if (!pageHost) {
    pageHost = h('main', { id: 'page', class: 'page' })
  }

  renderShell(path, pageHost)
  pageHost.replaceChildren(h('div', { class: 'card empty-state' }, [
    h('div', { class: 'empty-icon' }, [svgIcon('cube', 28)]),
    h('h2', { text: '正在打开工作室…' }),
    h('p', { text: '首次启动会在 IndexedDB 中生成人像、几何、半穹顶样稿和材料库。' }),
  ]))

  let handle: PageHandle
  try {
    if (path === '/projects') handle = await renderProjects(pageHost)
    else if (path === '/source') handle = await renderSource(pageHost, query)
    else if (path === '/editor') handle = await renderEditor(pageHost, query)
    else if (path === '/materials') handle = await renderMaterials(pageHost)
    else if (path === '/preview') handle = await renderPreview(pageHost, query)
    else if (path === '/drawings') handle = await renderDrawings(pageHost, query)
    else {
      window.location.hash = '#/projects'
      return
    }
    ;(route as unknown as { lastHandle?: PageHandle }).lastHandle = handle
  } catch (error) {
    console.error(error)
    pageHost.replaceChildren(h('div', { class: 'card empty-state' }, [
      h('h2', { text: '页面启动失败' }),
      h('p', { text: (error as Error).message }),
      h('button', { class: 'btn btn-primary', on: { click: () => window.location.reload() } }, '重新加载'),
    ]))
  }
}

window.addEventListener('hashchange', () => {
  const current = route as unknown as { lastHandle?: PageHandle }
  current.lastHandle?.destroy?.()
  void route()
})

void ensureSeeded().then(() => route()).catch((error) => {
  console.error(error)
  const app = document.querySelector('#app')
  app?.replaceChildren(h('div', { class: 'page' }, [h('div', { class: 'danger-panel', text: `IndexedDB 初始化失败：${(error as Error).message}` })]))
})
