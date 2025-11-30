import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import dayjs from 'dayjs'
import { cors } from 'hono/cors'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'

// Worker bindings
type Bindings = {
  DB: D1Database
  SESSION_COOKIE_NAME: string
  SESSION_TTL_SECONDS: number
  FRONTEND_URL: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  GOOGLE_REDIRECT_URI: string
}

type Variables = {
  userId?: string
}

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>()

app.use(
  '*',
  cors({
    origin: (_, c) => c.env.FRONTEND_URL, // 固定URLでもOK
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
  })
)

// Google OAuth の認可URLにリダイレクト
app.get('/login', (c) => {
  const params: URLSearchParams = new URLSearchParams({
    response_type: 'code',
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: c.env.GOOGLE_REDIRECT_URI,
    scope: 'openid email profile',
    state: crypto.randomUUID(),
  })
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
})

// Google OAuth のコールバック処理
app.get('/callback', async (c) => {
  const code = c.req.query('code')
  if (!code) return c.text('Missing code', 400)

  // 1. トークン取得
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: c.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code'
    })
  })
  const tokensJson = await tokenRes.json();
  if (typeof tokensJson !== 'object' || !tokensJson ) return c.text('OAuth failed', 400)
  const tokens = tokensJson as Record<string, string>;
  if (!tokens.id_token) return c.text('OAuth failed', 400)
  
    // 2. IDトークンからユーザ情報を取得
  const userInfo = parseJwt(tokens.id_token) as { email: string; sub: string }
  if (!userInfo.email) return c.text('No email found', 400)

  // 3. ユーザを DB に保存 or 取得
  const userId = crypto.randomUUID()
  await c.env.DB.prepare(`
    INSERT INTO users (user_id, email, provider, provider_user_id)
    VALUES (?, ?, 'google', ?)
    ON CONFLICT(email) DO NOTHING
  `).bind(userId, userInfo.email, userInfo.sub).run()

  const row = await c.env.DB.prepare(`SELECT user_id FROM users WHERE email=?`).bind(userInfo.email).first<{ user_id: string }>()
  const finalUserId = row?.user_id

  // 4. セッション作成
  const sessionId = crypto.randomUUID()
  const expiresAt = dayjs().add(Number(c.env.SESSION_TTL_SECONDS), "second");
  await c.env.DB.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`)
    .bind(sessionId, finalUserId, expiresAt.format("YYYY-MM-DD HH:mm:ss")).run()

  // 5. Cookie 発行
  setCookie(c, c.env.SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    path: '/',
    expires: expiresAt.toDate()
  })

  return c.redirect(c.env.FRONTEND_URL)  // フロントのURLにリダイレクト
})

// セッション検証用ミドルウェア
app.use('*', async (c, next) => {
  const sessionId = getCookie(c, c.env.SESSION_COOKIE_NAME)
  if (sessionId) {
    const row = await c.env.DB.prepare(
      `SELECT user_id FROM sessions WHERE id=? AND expires_at > ?`
    ).bind(sessionId, dayjs().format("YYYY-MM-DD HH:mm:ss")).first<{ user_id: string }>()
    if (row) {
      c.set('userId', row.user_id)
    }
  }
  await next()
})

// ログアウト
app.get('/logout', async (c) => {
  const sessionId = getCookie(c, c.env.SESSION_COOKIE_NAME)
  if (sessionId) {
    await c.env.DB.prepare(`DELETE FROM sessions WHERE id=?`).bind(sessionId).run()
    deleteCookie(c, c.env.SESSION_COOKIE_NAME)
  }
  return c.json({ success: true })
})

// 認証必須のAPIサンプル
app.get('/me', (c) => {
  const userId = c.get('userId')
  if (!userId) return c.text('Unauthorized', 401)
  return c.json({ userId })
})

// user情報を一括で取得する処理
app.get('/userInfo', async (c) => {
  const userId = c.get('userId')
  if (!userId) return c.text('Unauthorized', 401)
  const users = await c.env.DB.prepare(`SELECT * FROM users WHERE user_id = ?`).bind(userId).first<{user_id: string, email: string}>();
  const deepgramKey = await c.env.DB.prepare(`SELECT * FROM api_keys WHERE user_id = ? AND provider = 'deepgram'`).bind(userId).first<{encrypted_key: string}>();
  const deeplKey = await c.env.DB.prepare(`SELECT * FROM api_keys WHERE user_id = ? AND provider = 'deepl'`).bind(userId).first<{encrypted_key: string}>();
  return c.json({
    userId,
    email: users?.email,
    apiKey: {
      deepgram: deepgramKey?.encrypted_key,
      deepl: deeplKey?.encrypted_key
    }
  })
})

const apiKeySchema = z.object({
  deepgram: z.string().optional(),
  deepl: z.string().optional(),
})

// APIキー保存処理
app.post("/saveApiKeys", zValidator("json", apiKeySchema), async (c) => {
  const userId = c.get('userId')
  if (!userId) return c.text('Unauthorized', 401)
  const { deepgram, deepl } = await c.req.json();
  if (deepgram) {
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO api_keys (user_id, provider, encrypted_key)
      VALUES (?, 'deepgram', ?)
    `).bind(userId, deepgram).run()
  }
  if (deepl) {
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO api_keys (user_id, provider, encrypted_key)
      VALUES (?, 'deepl', ?)
    `).bind(userId, deepl).run()
  }
  return c.json({ success: true })
})

// JWT デコード関数（署名検証省略）
function parseJwt(token: string) {
  const [, payload] = token.split('.')
  return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
}

export default app
