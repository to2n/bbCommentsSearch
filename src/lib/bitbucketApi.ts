import type {
  BbPrComment,
  BbProject,
  BbPullRequest,
  BbRepo,
  Page,
} from '../types/bitbucket'

type AuthScheme = 'bearer' | 'token'

export type BitbucketClientConfig = {
  baseUrl: string
  token: string
  authScheme: AuthScheme
}

export class BitbucketClient {
  private readonly baseUrl: string
  private readonly token: string
  private readonly authScheme: AuthScheme

  constructor(cfg: BitbucketClientConfig) {
    this.baseUrl = cfg.baseUrl.replace(/\/+$/, '')
    this.token = cfg.token.trim()
    this.authScheme = cfg.authScheme
  }

  private authHeaderValue(): string {
    const scheme = this.authScheme === 'token' ? 'Token' : 'Bearer'
    return `${scheme} ${this.token}`
  }

  private apiUrl(path: string, query?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(this.baseUrl + path)
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined) continue
        url.searchParams.set(k, String(v))
      }
    }
    return url.toString()
  }

  private async request<T>(
    path: string,
    opts?: {
      query?: Record<string, string | number | boolean | undefined>
      signal?: AbortSignal
    },
  ): Promise<T> {
    if (!this.baseUrl) throw new Error('Base URL не задан')
    if (!this.token) throw new Error('Token не задан')

    const res = await fetch(this.apiUrl(path, opts?.query), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: this.authHeaderValue(),
      },
      signal: opts?.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      const hint = text ? `: ${text.slice(0, 300)}` : ''
      if (res.status === 401 || res.status === 403) {
        throw new Error(`Auth ошибка (${res.status}). Проверьте токен/права${hint}`)
      }
      throw new Error(`HTTP ${res.status}${hint}`)
    }

    return (await res.json()) as T
  }

  private async *paginate<T>(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
    signal?: AbortSignal,
  ): AsyncGenerator<T[], void, unknown> {
    let start = 0
    // Bitbucket DC обычно лимитит 25/50; увеличим до 100 где можно.
    const limit = Number(query?.limit ?? 100)

    for (;;) {
      const page = await this.request<Page<T>>(path, {
        query: { ...query, start, limit },
        signal,
      })
      yield page.values
      if (page.isLastPage) return
      start = page.nextPageStart ?? (start + page.values.length)
    }
  }

  async checkConnection(signal?: AbortSignal): Promise<void> {
    // Небольшой "пинг": читаем 1 проект.
    await this.request<Page<BbProject>>('/rest/api/1.0/projects', {
      query: { limit: 1 },
      signal,
    })
  }

  async listProjects(signal?: AbortSignal): Promise<BbProject[]> {
    const out: BbProject[] = []
    for await (const chunk of this.paginate<BbProject>('/rest/api/1.0/projects', { limit: 100 }, signal)) {
      out.push(...chunk)
    }
    return out
  }

  async listRepos(projectKey: string, signal?: AbortSignal): Promise<BbRepo[]> {
    const out: BbRepo[] = []
    for await (const chunk of this.paginate<BbRepo>(
      `/rest/api/1.0/projects/${encodeURIComponent(projectKey)}/repos`,
      { limit: 100 },
      signal,
    )) {
      out.push(...chunk)
    }
    return out
  }

  async listPullRequests(projectKey: string, repoSlug: string, signal?: AbortSignal): Promise<BbPullRequest[]> {
    const out: BbPullRequest[] = []
    for await (const chunk of this.paginate<BbPullRequest>(
      `/rest/api/1.0/projects/${encodeURIComponent(projectKey)}/repos/${encodeURIComponent(repoSlug)}/pull-requests`,
      { limit: 100, state: 'ALL', order: 'NEWEST' },
      signal,
    )) {
      out.push(...chunk)
    }
    return out
  }

  async listPullRequestComments(
    projectKey: string,
    repoSlug: string,
    prId: number,
    signal?: AbortSignal,
  ): Promise<BbPrComment[]> {
    const out: BbPrComment[] = []
    for await (const chunk of this.paginate<BbPrComment>(
      `/rest/api/1.0/projects/${encodeURIComponent(projectKey)}/repos/${encodeURIComponent(repoSlug)}/pull-requests/${prId}/comments`,
      { limit: 100 },
      signal,
    )) {
      out.push(...chunk)
    }
    return out
  }
}

export function flattenComments(comments: BbPrComment[]): BbPrComment[] {
  const out: BbPrComment[] = []
  const stack = [...comments]
  while (stack.length) {
    const cur = stack.shift()!
    out.push(cur)
    if (cur.comments?.length) {
      // ответы идут после родителя
      stack.unshift(...cur.comments)
    }
  }
  return out
}
