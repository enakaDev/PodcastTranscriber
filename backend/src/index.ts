// index.ts
import { Hono } from 'hono'
import main from './main'
import auth from './auth'

const app = new Hono()

app.route("/main", main)
app.route("/auth", auth)

export default app
