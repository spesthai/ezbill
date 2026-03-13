import { Hono } from 'hono'
import { createSupabaseClient } from '../lib/supabase'
import { hashToken } from '../lib/token'

export interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  SLIPS_BUCKET: R2Bucket
}

// 返回给租客的账单字段白名单（不暴露 id、room_id 等内部字段）
interface BillPublic {
  currency: string
  period_start: string
  period_end: string
  due_at: string
  billing_unit: string
  billing_quantity: number
  rent_amount: number
  water_usage: number | null
  water_unit_price: number | null
  water_amount: number | null
  electricity_usage: number | null
  electricity_unit_price: number | null
  electricity_amount: number | null
  other_fees: unknown
  total_amount: number
  status: string | null
  share_expires_at: string | null
}

interface BillRow extends BillPublic {
  id: string
  share_token_hash: string
}

interface PaymentRow {
  id: string
  amount: number | null
  status: string
  slip_verified: boolean
  provider: string | null
  paid_at: string | null
  verified_at: string | null
  created_at: string
}

// Slip 上传限制
const SLIP_MAX_BYTES = 10 * 1024 * 1024   // 10 MB
const SLIP_ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

const bill = new Hono<{ Bindings: Env }>()

/**
 * GET /b/:share_token
 * 1. 计算 token 的 SHA-256 哈希
 * 2. 查询 bills WHERE share_token_hash = ?
 * 3. 校验过期时间
 * 4. 返回脱敏账单字段 + 支付记录列表
 */
bill.get('/:share_token', async (c) => {
  const { share_token } = c.req.param()

  if (!share_token || share_token.length < 16) {
    return c.json({ error: 'invalid_token' }, 400)
  }

  const db = createSupabaseClient(c.env)
  const tokenHash = await hashToken(share_token)

  // 查询账单
  let rows: BillRow[]
  try {
    rows = await db.from('bills').select(
      'id,currency,period_start,period_end,due_at,billing_unit,billing_quantity,' +
      'rent_amount,water_usage,water_unit_price,water_amount,' +
      'electricity_usage,electricity_unit_price,electricity_amount,' +
      'other_fees,total_amount,status,share_token_hash,share_expires_at',
      { share_token_hash: tokenHash }
    ) as BillRow[]
  } catch {
    return c.json({ error: 'db_error' }, 500)
  }

  if (rows.length === 0) {
    return c.json({ error: 'not_found' }, 404)
  }

  const billRow = rows[0]

  // 校验过期时间
  if (billRow.share_expires_at && new Date(billRow.share_expires_at) < new Date()) {
    return c.json({ error: 'token_expired' }, 410)
  }

  // 查询该账单的支付记录（仅返回对租客可见的字段）
  let payments: PaymentRow[] = []
  try {
    payments = await db.from('payments').select(
      'id,amount,status,slip_verified,provider,paid_at,verified_at,created_at',
      { bill_id: billRow.id }
    ) as PaymentRow[]
  } catch {
    // 支付记录查询失败不阻断主流程，降级返回空数组
    payments = []
  }

  // 脱敏：只返回白名单字段，不透传内部 id / room_id / share_token_hash
  const { id: _id, share_token_hash: _hash, ...publicBill } = billRow

  return c.json({
    bill: publicBill,
    payments: payments.map(({ id: _pid, ...p }) => p),
  })
})

/**
 * POST /b/:share_token/slip
 * 1. 校验 share_token（同 GET 逻辑）
 * 2. 校验文件类型（MIME 白名单）+ 大小限制（10MB）
 * 3. 上传到 R2，key = slips/{bill_id}/{timestamp}-{random}.ext
 * 4. 在 payments 表插入 uploaded 记录
 */
bill.post('/:share_token/slip', async (c) => {
  const { share_token } = c.req.param()

  if (!share_token || share_token.length < 16) {
    return c.json({ error: 'invalid_token' }, 400)
  }

  // 校验 token + 获取账单 id
  const db = createSupabaseClient(c.env)
  const tokenHash = await hashToken(share_token)

  let rows: BillRow[]
  try {
    rows = await db.from('bills').select(
      'id,total_amount,status,share_expires_at,share_token_hash',
      { share_token_hash: tokenHash }
    ) as BillRow[]
  } catch {
    return c.json({ error: 'db_error' }, 500)
  }

  if (rows.length === 0) {
    return c.json({ error: 'not_found' }, 404)
  }

  const billRow = rows[0]

  if (billRow.share_expires_at && new Date(billRow.share_expires_at) < new Date()) {
    return c.json({ error: 'token_expired' }, 410)
  }

  // 解析 multipart form-data
  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    return c.json({ error: 'invalid_form_data' }, 400)
  }

  const fileEntry = formData.get('slip')
  if (!fileEntry || typeof fileEntry === 'string') {
    return c.json({ error: 'slip_field_missing' }, 400)
  }
  const file = fileEntry as File

  // 校验 MIME 类型
  if (!SLIP_ALLOWED_MIME.has(file.type)) {
    return c.json({ error: 'invalid_file_type', allowed: [...SLIP_ALLOWED_MIME] }, 415)
  }

  // 校验文件大小
  if (file.size > SLIP_MAX_BYTES) {
    return c.json({ error: 'file_too_large', max_bytes: SLIP_MAX_BYTES }, 413)
  }

  // 生成 R2 object key
  const ext = file.type.split('/')[1]  // jpeg / png / webp
  const rand = Math.random().toString(36).slice(2, 8)
  const objectKey = `slips/${billRow.id}/${Date.now()}-${rand}.${ext}`

  // 上传到 R2
  try {
    await c.env.SLIPS_BUCKET.put(objectKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    })
  } catch {
    return c.json({ error: 'upload_failed' }, 500)
  }

  // 插入 payments 记录（status: uploaded）
  try {
    await db.from('payments').insert({
      bill_id: billRow.id,
      amount: (billRow as unknown as { total_amount: number }).total_amount,
      status: 'uploaded',
      slip_object_key: objectKey,
      slip_verified: false,
      provider: 'slip2go',
    })
  } catch {
    // 数据库写入失败：R2 文件已上传，但记录未写入
    // MVP 阶段记录错误后返回 500，不做回滚（文件孤立风险低，可定期清理）
    return c.json({ error: 'db_write_failed' }, 500)
  }

  return c.json({ ok: true, object_key: objectKey }, 201)
})

export default bill
