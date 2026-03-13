import { Hono } from 'hono'
import { cors } from 'hono/cors'
import billRoutes from './routes/bill'

export interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  SLIPS_BUCKET: R2Bucket
}

const app = new Hono<{ Bindings: Env }>()

// CORS：仅允许管理端和 H5 端来源
app.use('*', cors({
  origin: [
    'https://ezbill.pages.dev',
    'http://localhost:5173',
    'http://localhost:5174',
  ],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}))

// 健康检查
app.get('/health', (c) => c.json({ ok: true }))

// 租客 H5 路由（/b/:share_token, /b/:share_token/slip）
app.route('/b', billRoutes)

export default app
