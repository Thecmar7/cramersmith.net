# Tasks

Bug fixes and improvements identified from code review.

---

## Bugs

- [ ] **Rate limiter uses RemoteAddr with port** (`internal/api/router.go:77`)
  Behind App Runner's load balancer, `r.RemoteAddr` is the load balancer's IP — not the client's. All clients share one bucket, so 10 failed attempts from anyone locks everyone out. Should extract the real client IP from `X-Forwarded-For`.

- [ ] **Rate limiter fires on all requests, not just failures** (`internal/api/router.go:74-83`)
  The limiter is meant to block brute-force auth attempts but wraps entire route handlers, so it counts successful requests too. A legitimate user who posts 10 times in 15 minutes gets blocked. Should only count failed auth (401/403) responses.

- [x] **`CreatePost` returns `&p` on scan error** (`internal/store/store.go:152-157`)
  If `Scan` fails, `p` is a zero-value struct. The nil-check on `p.Tags` and the `return &p, err` still run, handing the caller a pointer to garbage data. Should be `return nil, err` on scan failure.

- [x] **Backend rejects link posts with no content** (`internal/api/router.go:185-188`)
  `content is required` check applies to all post types. The frontend marks content optional for link posts, so posting a bare link with no commentary fails silently with a 400. Fix: only require content when `body.Type == "thought"`.

- [x] **Admin optimistically removes post without checking response** (`frontend/src/pages/Admin.tsx:147-151`)
  `setPosts(p => p.filter(...))` runs unconditionally after the DELETE fetch, regardless of whether it succeeded. On a 500 or network error, the post vanishes from the UI but still exists in the DB — a refresh brings it back. Should check `r.ok` first.

- [x] **`logout` defined after early return** (`frontend/src/pages/Admin.tsx:174`)
  `logout()` is declared in the authed branch, after the `if (!authed) return` early exit. Works in practice since it's only called in authed JSX, but functions should be defined before any early returns.

---

## Smells

- [ ] **Rate limiter map never evicts empty entries** (`internal/api/router.go:34-51`)
  IP keys are added to `rl.hits` but never removed even when their slice empties. Slow memory leak — negligible for a personal site but worth a `delete(rl.hits, ip)` when `len(recent) == 0`.

- [ ] **`parseNamedQueries` strips all `--` lines from query bodies** (`internal/store/store.go:94-97`)
  Any inline SQL comment inside a named query block gets silently deleted. No current queries use inline comments, but it's a hidden footgun. Should only strip comment-only lines that appear *after* the last SQL statement, not all `--` lines.

- [ ] **Admin `Post` interface missing `tags` field** (`frontend/src/pages/Admin.tsx:4-12`)
  The API now returns `tags` on every post but the Admin's `Post` interface doesn't declare it. Not a runtime bug since tags aren't rendered in the post list, but the type is stale.

- [ ] **`useEffect` stale closure on `password`** (`frontend/src/pages/Admin.tsx:38-41`)
  `loadPosts` and `loadRefLinks` close over `password` but the effect declares no deps (`[]`). Works correctly on first load, but ESLint's exhaustive-deps rule would flag it. Fix: add `password` to deps, or initialize auth state differently.
