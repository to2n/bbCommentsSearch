import { useMemo, useState } from 'react'
import Fuse from 'fuse.js'
import type { NormalizedComment } from '../types/bitbucket'

export function CommentsView(props: { comments: NormalizedComment[] }) {
  const [q, setQ] = useState('')

  const fuse = useMemo(() => {
    return new Fuse(props.comments, {
      includeScore: true,
      threshold: 0.35,
      ignoreLocation: true,
      keys: [
        { name: 'text', weight: 0.7 },
        { name: 'author', weight: 0.2 },
        { name: 'projectKey', weight: 0.05 },
        { name: 'repoSlug', weight: 0.05 },
      ],
    })
  }, [props.comments])

  const filtered = useMemo(() => {
    const query = q.trim()
    if (!query) return props.comments
    return fuse.search(query).map((r) => r.item)
  }, [q, fuse, props.comments])

  return (
    <section className="panel">
      <h2>Комментарии</h2>

      <div className="row two">
        <label>
          Нечеткий поиск
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="текст / автор / repo" />
        </label>
        <label>
          Результатов
          <input value={String(filtered.length)} readOnly />
        </label>
      </div>

      <div className="list">
        {filtered.map((c) => (
          <div key={`${c.projectKey}:${c.repoSlug}:${c.prId}:${c.commentId}`} className="comment">
            <div className="commentHeader">
              <div className="mono">
                {c.projectKey}/{c.repoSlug} #{c.prId}
              </div>
              <div className="muted">{new Date(c.createdDate).toLocaleString()}</div>
            </div>
            <div className="commentMeta">
              <span className="pill">{c.author}</span>
              {c.prTitle ? <span className="muted">{c.prTitle}</span> : null}
              {c.url ? (
                <a className="link" href={c.url} target="_blank" rel="noreferrer">
                  открыть
                </a>
              ) : null}
            </div>
            <pre className="commentText">{c.text}</pre>
          </div>
        ))}
        {!filtered.length ? <div className="muted">Нет комментариев</div> : null}
      </div>
    </section>
  )
}
