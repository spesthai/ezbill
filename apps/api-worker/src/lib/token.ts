/**
 * share_token 工具函数
 *
 * 规则：数据库只存 SHA-256 哈希（hex），不落库明文 token。
 * Worker 收到明文 token 后计算哈希，与数据库对比。
 */

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** 生成高熵明文 token（128 bit = 16 bytes，hex = 32 chars） */
export function generateToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}
