import { useMemo, useRef, useState } from 'react'
import './App.css'
import { ConnectionForm, type ConnectionValue } from './components/ConnectionForm'
import { ProjectPicker } from './components/ProjectPicker'
import { CommentsView } from './components/CommentsView'
import { BitbucketClient, flattenComments } from './lib/bitbucketApi'
import { clearConfig, loadConfig, saveConfig, type StoredConfig } from './lib/storage'
import { mapPool } from './lib/pool'
import type { BbProject, NormalizedComment } from './types/bitbucket'

type UiStatus =
  | { kind: 'idle' }
  | { kind: 'loading-projects' }
  | { kind: 'ready' }
  | { kind: 'fetching-comments'; done: number; total?: number }

function App() {
  const [cfg, setCfg] = useState<StoredConfig>(() => loadConfig())
  const [status, setStatus] = useState<UiStatus>({ kind: 'idle' })
  const [error, setError] = useState<string | undefined>(undefined)
  const [projects, setProjects] = useState<BbProject[]>([])
  const [comments, setComments] = useState<NormalizedComment[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const connectionValue: ConnectionValue = useMemo(
    () => ({ baseUrl: cfg.baseUrl, token: cfg.token, authScheme: cfg.authScheme }),
    [cfg.baseUrl, cfg.token, cfg.authScheme],
  )

  const selectedProjects = useMemo(() => {
    const set = new Set(cfg.selectedProjectKeys)
    return projects.filter((p) => set.has(p.key))
  }, [cfg.selectedProjectKeys, projects])

  function setConnection(next: ConnectionValue) {
    const updated: StoredConfig = { ...cfg, ...next }
    setCfg(updated)
    saveConfig(updated)
  }

  function setSelectedProjectKeys(keys: string[]) {
    const updated: StoredConfig = { ...cfg, selectedProjectKeys: keys }
    setCfg(updated)
    saveConfig(updated)
  }

  function client(): BitbucketClient {
    return new BitbucketClient({ baseUrl: cfg.baseUrl, token: cfg.token, authScheme: cfg.authScheme })
  }

  async function onConnect() {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setError(undefined)
    setComments([])
    setStatus({ kind: 'loading-projects' })
    try {
      const bb = client()
      await bb.checkConnection(abortRef.current.signal)
      const list = await bb.listProjects(abortRef.current.signal)
      list.sort((a, b) => a.key.localeCompare(b.key))
      setProjects(list)
      // если раньше были выбранные ключи — оставим
      setStatus({ kind: 'ready' })
    } catch (e) {
      setStatus({ kind: 'idle' })
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function onClear() {
    abortRef.current?.abort()
    clearConfig()
    const cleared = loadConfig()
    setCfg(cleared)
    setProjects([])
    setComments([])
    setError(undefined)
    setStatus({ kind: 'idle' })
  }

  async function fetchAllComments() {
    if (!cfg.selectedProjectKeys.length) {
      setError('Выберите хотя бы один проект')
      return
    }
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setError(undefined)
    setComments([])
    setStatus({ kind: 'fetching-comments', done: 0 })

    try {
      const bb = client()
      const signal = abortRef.current.signal

      // 1) repos по проектам
      const reposByProject = await mapPool(
        cfg.selectedProjectKeys,
        4,
        async (projectKey) => ({ projectKey, repos: await bb.listRepos(projectKey, signal) }),
      )

      // 2) pull requests по репам
      const repoTuples = reposByProject.flatMap((x) => x.repos.map((r) => ({ projectKey: x.projectKey, repoSlug: r.slug })))

      setStatus({ kind: 'fetching-comments', done: 0, total: repoTuples.length })

      const prsByRepo = await mapPool(repoTuples, 4, async (t, idx) => {
        const prs = await bb.listPullRequests(t.projectKey, t.repoSlug, signal)
        setStatus((s) => (s.kind === 'fetching-comments' ? { ...s, done: idx + 1 } : s))
        return { ...t, prs }
      })

      // 3) comments по PR
      const prTuples = prsByRepo.flatMap((x) => x.prs.map((pr) => ({ projectKey: x.projectKey, repoSlug: x.repoSlug, prId: pr.id, prTitle: pr.title })))

      setStatus({ kind: 'fetching-comments', done: 0, total: prTuples.length })

      const commentChunks = await mapPool(prTuples, 6, async (t, idx) => {
        const raw = await bb.listPullRequestComments(t.projectKey, t.repoSlug, t.prId, signal)
        const flat = flattenComments(raw)
        const norm: NormalizedComment[] = flat
          .filter((c) => (c.text ?? '').trim().length > 0)
          .map((c) => ({
            projectKey: t.projectKey,
            repoSlug: t.repoSlug,
            prId: t.prId,
            prTitle: t.prTitle,
            commentId: c.id,
            author: c.author?.displayName || c.author?.name || c.author?.slug || 'unknown',
            createdDate: c.createdDate,
            text: c.text,
            // ссылка на PR: на большинстве версий это работает
            url: `${cfg.baseUrl.replace(/\/+$/, '')}/projects/${encodeURIComponent(t.projectKey)}/repos/${encodeURIComponent(t.repoSlug)}/pull-requests/${t.prId}/overview`,
          }))
        setStatus((s) => (s.kind === 'fetching-comments' ? { ...s, done: idx + 1 } : s))
        return norm
      })

      const all = commentChunks.flat()
      all.sort((a, b) => b.createdDate - a.createdDate)
      setComments(all)
      setStatus({ kind: 'ready' })
    } catch (e) {
      setStatus({ kind: 'ready' })
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function cancel() {
    abortRef.current?.abort()
  }

  const busy = status.kind === 'loading-projects' || status.kind === 'fetching-comments'

  return (
    <div className="app">
      <header className="top">
        <div>
          <div className="brand">bbCommentsSearch</div>
          <div className="muted">Bitbucket DC → проекты → PR комментарии → нечеткий поиск</div>
        </div>
        {status.kind === 'fetching-comments' ? (
          <div className="progress">
            <div className="mono">
              {status.total ? `${status.done}/${status.total}` : `${status.done}`}
            </div>
            <button className="btn" type="button" onClick={cancel}>
              Отмена
            </button>
          </div>
        ) : null}
      </header>

      <main className="grid">
        <ConnectionForm
          value={connectionValue}
          onChange={setConnection}
          onConnect={onConnect}
          onClear={onClear}
          busy={busy}
          error={error}
        />

        {projects.length ? (
          <>
            <ProjectPicker projects={projects} selectedKeys={cfg.selectedProjectKeys} onChangeSelected={setSelectedProjectKeys} />
            <section className="panel">
              <h2>Сбор</h2>
              <div className="muted">
                Выбрано проектов: <span className="mono">{selectedProjects.length}</span>
              </div>
              <div className="row actions">
                <button className="btn primary" type="button" onClick={fetchAllComments} disabled={busy}>
                  {status.kind === 'fetching-comments' ? 'Собираю…' : 'Получить комментарии'}
                </button>
              </div>
              <div className="hint">
                На больших инстансах это может занять время: идёт перебор repo → PR → comments.
              </div>
            </section>
          </>
        ) : null}

        {comments.length ? <CommentsView comments={comments} /> : null}
      </main>
    </div>
  )
}

export default App
