import { useMemo, useState } from 'react'

export type ConnectionValue = {
  baseUrl: string
  token: string
  authScheme: 'bearer' | 'token'
}

export function ConnectionForm(props: {
  value: ConnectionValue
  onChange: (next: ConnectionValue) => void
  onConnect: () => void
  onClear: () => void
  busy: boolean
  error?: string
}) {
  const { value, onChange } = props
  const [showToken, setShowToken] = useState(false)

  const normalizedBaseUrl = useMemo(() => value.baseUrl.trim().replace(/\/+$/, ''), [value.baseUrl])

  return (
    <section className="panel">
      <h2>Подключение</h2>
      <div className="row">
        <label>
          Base URL Bitbucket DC
          <input
            value={value.baseUrl}
            onChange={(e) => onChange({ ...value, baseUrl: e.target.value })}
            placeholder="https://bitbucket.company.local"
            autoComplete="off"
          />
          <div className="hint">Будет использовано: {normalizedBaseUrl || '—'}</div>
        </label>
      </div>

      <div className="row two">
        <label>
          Auth scheme
          <select
            value={value.authScheme}
            onChange={(e) => onChange({ ...value, authScheme: e.target.value as ConnectionValue['authScheme'] })}
          >
            <option value="bearer">Bearer</option>
            <option value="token">Token</option>
          </select>
        </label>
        <label>
          Token
          <div className="tokenRow">
            <input
              type={showToken ? 'text' : 'password'}
              value={value.token}
              onChange={(e) => onChange({ ...value, token: e.target.value })}
              placeholder="вставьте токен"
              autoComplete="off"
            />
            <button type="button" className="btn" onClick={() => setShowToken((v) => !v)}>
              {showToken ? 'Скрыть' : 'Показать'}
            </button>
          </div>
        </label>
      </div>

      {props.error ? <div className="error">{props.error}</div> : null}

      <div className="row actions">
        <button className="btn primary" type="button" onClick={props.onConnect} disabled={props.busy}>
          {props.busy ? 'Подключаюсь…' : 'Загрузить проекты'}
        </button>
        <button className="btn" type="button" onClick={props.onClear} disabled={props.busy}>
          Очистить
        </button>
      </div>

      <div className="hint">
        Если запросы падают из‑за CORS, используйте готовый `local-cors-proxy`.
        Запуск: заполните `.env` (BITBUCKET_BASE_URL) и выполните `npm run cors-proxy`.
        Тогда в поле Base URL укажите: `http://localhost:8010/proxy`.
      </div>
    </section>
  )
}
