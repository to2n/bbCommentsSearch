const KEY = 'bbcs:v1'

export type StoredConfig = {
  baseUrl: string
  token: string
  authScheme: 'bearer' | 'token'
  selectedProjectKeys: string[]
}

export function loadConfig(): StoredConfig {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      return {
        baseUrl: '',
        token: '',
        authScheme: 'bearer',
        selectedProjectKeys: [],
      }
    }

    const parsed = JSON.parse(raw) as Partial<StoredConfig>
    return {
      baseUrl: parsed.baseUrl ?? '',
      token: parsed.token ?? '',
      authScheme: parsed.authScheme === 'token' ? 'token' : 'bearer',
      selectedProjectKeys: Array.isArray(parsed.selectedProjectKeys)
        ? parsed.selectedProjectKeys.filter((x): x is string => typeof x === 'string')
        : [],
    }
  } catch {
    return {
      baseUrl: '',
      token: '',
      authScheme: 'bearer',
      selectedProjectKeys: [],
    }
  }
}

export function saveConfig(cfg: StoredConfig) {
  localStorage.setItem(KEY, JSON.stringify(cfg))
}

export function clearConfig() {
  localStorage.removeItem(KEY)
}
