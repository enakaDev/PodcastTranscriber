import { Hono } from 'hono'
import { v4 as uuidv4 } from 'uuid'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { OAuth2Client } from 'google-auth-library'
import dayjs from 'dayjs'

// Worker bindings
type Bindings = {
  DB: D1Database
  SESSION_COOKIE_NAME: string
  SESSION_TTL_SECONDS: number
}

type Variables = {
  userId? : string
}

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>()

const client = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI,
})

// Google OAuth の認可URLにリダイレクト
app.get('/auth/login', (c) => {
  const authorizeUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    state: crypto.randomUUID(),
  });
  return c.redirect(authorizeUrl);
})

// Google OAuth のコールバック処理
app.get('/auth/callback', async (c) => {
  const code = c.req.query('code')
  if (!code) return c.text('Missing code', 400)

  // 1. トークン取得
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  if (!tokens.id_token) return c.text('OAuth failed', 400)
  
    // 2. IDトークンからユーザ情報を取得
  const userInfo = parseJwt(tokens.id_token) as { email: string; sub: string }
  if (!userInfo.email) return c.text('No email found', 400)

  // 3. ユーザを DB に保存 or 取得
  const userId = crypto.randomUUID()
  await c.env.DB.prepare(`
    INSERT INTO users (id, email, provider, provider_user_id)
    VALUES (?, ?, 'google', ?)
    ON CONFLICT(email) DO UPDATE SET email=email
  `).bind(userId, userInfo.email, userInfo.sub).run()

  const row = await c.env.DB.prepare(`SELECT id FROM users WHERE email=?`).bind(userInfo.email).first<{ id: string }>()
  const finalUserId = row?.id

  // 4. セッション作成
  const sessionId = uuidv4()
  const expiresAt = dayjs().add(Number(c.env.SESSION_TTL_SECONDS), "second");
  //const expiresAt = Math.floor(Date.now() / 1000) + Number(c.env.SESSION_TTL_SECONDS)
  await c.env.DB.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`)
    .bind(sessionId, finalUserId, expiresAt.format("YYYY-MM-DD HH:mm:ss")).run()

  // 5. Cookie 発行
  setCookie(c, c.env.SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    expires: expiresAt.toDate()
  })

  return c.redirect('/')
})

// セッション検証用ミドルウェア
app.use('*', async (c, next) => {
  const sessionId = getCookie(c, c.env.SESSION_COOKIE_NAME)
  if (sessionId) {
    const row = await c.env.DB.prepare(
      `SELECT user_id FROM sessions WHERE id=? AND expires_at > ?`
    ).bind(sessionId, dayjs()).first<{ user_id: string }>()
    if (row) {
      c.set('userId', row.user_id)
    }
  }
  await next()
})

// ログアウト
app.get('/auth/logout', async (c) => {
  const sessionId = getCookie(c, c.env.SESSION_COOKIE_NAME)
  if (sessionId) {
    await c.env.DB.prepare(`DELETE FROM sessions WHERE id=?`).bind(sessionId).run()
    deleteCookie(c, c.env.SESSION_COOKIE_NAME)
  }
  return c.redirect('/')
})

// 認証必須のAPIサンプル
app.get('/me', (c) => {
  const userId = c.get('userId')
  if (!userId) return c.text('Unauthorized', 401)
  return c.json({ userId })
})

// JWT デコード関数（署名検証省略）
function parseJwt(token: string) {
  const [, payload] = token.split('.')
  return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
}

export default app
