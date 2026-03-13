/**
 * 用 service_role key 创建 Supabase REST 客户端（绕过 RLS）。
 * 仅在 Worker 内部调用，不暴露给前端。
 */
export function createSupabaseClient(env: { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string }) {
  const headers = {
    'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }

  function from(table: string) {
    return {
      /** SELECT，支持简单 eq 过滤和列选择 */
      select(columns = '*', filters: Record<string, string> = {}) {
        const params = new URLSearchParams({ select: columns })
        for (const [k, v] of Object.entries(filters)) {
          params.set(k, `eq.${v}`)
        }
        const url = `${env.SUPABASE_URL}/rest/v1/${table}?${params}`
        return fetch(url, { headers }).then(async (r) => {
          const data = await r.json() as unknown[]
          if (!r.ok) throw new Error(JSON.stringify(data))
          return data
        })
      },
      /** INSERT，返回新插入的行 */
      insert(row: Record<string, unknown>) {
        const url = `${env.SUPABASE_URL}/rest/v1/${table}`
        return fetch(url, {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify(row),
        }).then(async (r) => {
          const data = await r.json() as unknown[]
          if (!r.ok) throw new Error(JSON.stringify(data))
          return data
        })
      },
      /** PATCH，按 eq 过滤后更新 */
      update(filters: Record<string, string>, patch: Record<string, unknown>) {
        const params = new URLSearchParams()
        for (const [k, v] of Object.entries(filters)) {
          params.set(k, `eq.${v}`)
        }
        const url = `${env.SUPABASE_URL}/rest/v1/${table}?${params}`
        return fetch(url, {
          method: 'PATCH',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify(patch),
        }).then(async (r) => {
          const data = await r.json() as unknown[]
          if (!r.ok) throw new Error(JSON.stringify(data))
          return data
        })
      },
    }
  }

  return { from }
}

export type SupabaseClient = ReturnType<typeof createSupabaseClient>
