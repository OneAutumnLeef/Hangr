/**
 * GitHub Pages SPA fallback. Pages serves the `404.html` file for any path
 * it can't resolve to a real file — by copying `index.html` to `404.html`
 * we let React Router pick up deep links like `/Hangr/closet/abc123` after
 * a hard refresh.
 *
 * The HTTP status is technically still 404 (not 200), but the body is the
 * SPA shell, the browser renders it, and the route resolves correctly.
 * Acceptable trade-off for Hangr — there's no SEO concern on a PWA that
 * requires JS to function anyway.
 *
 * If we ever wanted a true 200 status we'd switch to the spa-github-pages
 * redirect trick (404 captures the URL into a query string, index.html
 * unpacks it). Skipped for now — adds a flash + script logic that's harder
 * to debug, and the simple copy is what most personal projects ship.
 */
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const src = resolve('dist/index.html')
const dst = resolve('dist/404.html')

if (!existsSync(src)) {
  console.error(
    '[copy-404] dist/index.html missing — did `vite build` run before this?',
  )
  process.exit(1)
}

copyFileSync(src, dst)
console.log('[copy-404] dist/404.html ← dist/index.html')
