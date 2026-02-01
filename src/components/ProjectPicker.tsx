import { useMemo, useState } from 'react'
import type { BbProject } from '../types/bitbucket'

export function ProjectPicker(props: {
  projects: BbProject[]
  selectedKeys: string[]
  onChangeSelected: (keys: string[]) => void
}) {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return props.projects
    return props.projects.filter((p) => {
      return (
        p.key.toLowerCase().includes(query) ||
        p.name.toLowerCase().includes(query) ||
        (p.description ?? '').toLowerCase().includes(query)
      )
    })
  }, [props.projects, q])

  const selected = new Set(props.selectedKeys)

  function toggle(key: string) {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    props.onChangeSelected(Array.from(next).sort())
  }

  function setAllFiltered(on: boolean) {
    const next = new Set(selected)
    for (const p of filtered) {
      if (on) next.add(p.key)
      else next.delete(p.key)
    }
    props.onChangeSelected(Array.from(next).sort())
  }

  return (
    <section className="panel">
      <h2>Проекты</h2>

      <div className="row two">
        <label>
          Поиск
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="key / name" />
        </label>
        <label>
          Выбрано
          <input value={String(props.selectedKeys.length)} readOnly />
        </label>
      </div>

      <div className="row actions">
        <button className="btn" type="button" onClick={() => setAllFiltered(true)}>
          Выбрать отфильтрованные
        </button>
        <button className="btn" type="button" onClick={() => setAllFiltered(false)}>
          Снять отфильтрованные
        </button>
      </div>

      <div className="list">
        {filtered.map((p) => (
          <label key={p.key} className="listItem">
            <input type="checkbox" checked={selected.has(p.key)} onChange={() => toggle(p.key)} />
            <div className="mono">{p.key}</div>
            <div className="grow">
              <div className="title">{p.name}</div>
              {p.description ? <div className="muted">{p.description}</div> : null}
            </div>
          </label>
        ))}
        {!filtered.length ? <div className="muted">Ничего не найдено</div> : null}
      </div>
    </section>
  )
}
