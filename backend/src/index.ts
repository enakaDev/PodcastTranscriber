// index.ts
import { Hono } from 'hono'
import main from './main'
import auth from './auth'
import { cors } from 'hono/cors';

const app = new Hono()
app.use("*", cors()); // CORS有効化

app.route("/main", main)
app.route("/auth", auth)

export default app
