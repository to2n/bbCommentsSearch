export type Page<T> = {
  size: number
  limit: number
  isLastPage: boolean
  values: T[]
  start: number
  nextPageStart?: number
}

export type BbProject = {
  key: string
  id: number
  name: string
  description?: string
}

export type BbRepo = {
  id: number
  slug: string
  name: string
  project: { key: string }
}

export type BbPullRequest = {
  id: number
  title: string
  state: string
  open: boolean
  closed: boolean
  createdDate: number
  updatedDate: number
  fromRef?: { id: string; displayId: string }
  toRef?: { id: string; displayId: string }
}

export type BbUser = {
  name?: string
  displayName?: string
  emailAddress?: string
  slug?: string
}

export type BbPrComment = {
  id: number
  text: string
  createdDate: number
  updatedDate: number
  version: number
  author: BbUser
  parent?: { id: number }
  comments?: BbPrComment[]
}

export type NormalizedComment = {
  projectKey: string
  repoSlug: string
  prId: number
  prTitle?: string
  commentId: number
  author: string
  createdDate: number
  text: string
  url?: string
}
