# Blog Upgrade Plan

Expanding the Feed from a lightweight microblog into a full blog with images, tags, markdown, and individual post pages.

---

## Overview of Changes

### New post type: `blog`
The existing `thought` and `link` types remain unchanged. A new `blog` type adds:
- `title` (required) — displayed as H1 on the post page
- `slug` (unique, auto-generated from title) — used in the URL `/blog/:slug`
- `tags` (text array) — hashtag-style categories
- `image_url` (nullable) — header image, stored as a URL for now
- `draft` (boolean, default false) — publish gate; drafts are only visible in admin

All post types gain `tags` and `image_url` support so thoughts and link posts can also have images/tags.

### Image storage
For now: image URLs entered manually in the admin. S3 upload is a future task.

### Frontend routing
- `/feed` — existing feed, updated with tags, images, markdown, and pagination
- `/blog/:slug` — new individual post page with full markdown rendering and OG meta tags

---

## Task List

### 1. DB Migration — add new fields to posts table
File: `db/migrations/002_blog_fields.sql`

- Add `title TEXT` (nullable — existing posts have none)
- Add `slug TEXT UNIQUE` (nullable — generated for blog posts only)
- Add `tags TEXT[]` (nullable — array of lowercase tag strings)
- Add `image_url TEXT` (nullable)
- Add `draft BOOLEAN NOT NULL DEFAULT FALSE`
- Expand `type` CHECK constraint to include `'blog'`

### 2. Backend — update store and queries
File: `internal/store/store.go`, `db/queries/posts.sql`

- Add new fields to `Post` struct: `Title`, `Slug`, `Tags`, `ImageURL`, `Draft`
- Update `ListPosts` query: exclude drafts, support optional tag filter, add limit/offset pagination
- Add `GetPostBySlug(slug string)` — used by the individual post page endpoint
- Update `CreatePost` to accept new fields; auto-generate slug from title if not provided
- Add `ListPostsByTag` or fold tag filtering into `ListPosts` with a parameter

### 3. Backend — new and updated API routes
File: `internal/api/router.go`

- `GET /api/posts` — add `?tag=` and `?page=` / `?limit=` query params
- `GET /api/posts/:slug` — return a single post by slug (public)
- `POST /api/posts` — accept new fields (`title`, `slug`, `tags`, `image_url`, `draft`)
- `GET /api/tags` — return all tags in use (for tag cloud / autocomplete in admin)

### 4. Backend — RSS feed
File: `internal/api/router.go` (new handler)

- `GET /rss.xml` — Atom/RSS 2.0 feed of published blog posts
- Include title, link, description (first ~200 chars of content), pubDate
- Set correct `Content-Type: application/rss+xml` header

### 5. Frontend — install react-markdown
```bash
cd frontend && npm install react-markdown
```
Use `react-markdown` to render post content. Apply to all post types so thoughts can use basic formatting too.

### 6. Frontend — update Feed page
File: `frontend/src/pages/Feed.tsx`, `Feed.css`

- Render content through `react-markdown` instead of raw text
- Show `image_url` as a header image on posts that have one
- Show tags as clickable badge pills below post content
- Clicking a tag filters the feed (local state or URL param `?tag=`)
- For `blog` type posts: show title as a heading, truncate content at ~300 chars with a "Read more →" link to `/blog/:slug`
- Add pagination controls (simple prev/next or "Load more" button)

### 7. Frontend — individual post page
File: `frontend/src/pages/Post.tsx` (new), `Post.css` (new)

- Route: `/blog/:slug`
- Fetch from `GET /api/posts/:slug`
- Render: title (H1), tags, image, full markdown content, back link to `/feed`
- Set `<title>` and OG meta tags dynamically (title, description from first ~160 chars, image)
- Show reading time estimate (words / 200 wpm)

### 8. Frontend — Admin updates
File: `frontend/src/pages/Admin.tsx`

- Add `blog` as a third post type option
- Blog form fields: title input, slug input (auto-populated, editable), tags input (comma-separated or pill UI), image URL input, draft checkbox
- Thoughts and links: add optional tags and image URL fields
- Markdown preview pane for content textarea (toggle button)
- Show `[DRAFT]` badge on unpublished posts in the post list
- Add "Publish" button to toggle draft status without deleting/recreating

### 9. Frontend — routing
File: `frontend/src/main.tsx` or wherever routes are defined

- Add route `/blog/:slug` → `<Post />`
- Update nav if needed

### 10. Open Graph meta tags
File: `frontend/src/pages/Post.tsx`

Use `react-helmet-async` (or similar) to set per-page:
```html
<title>{post.title} | cramersmith.net</title>
<meta property="og:title" content={post.title} />
<meta property="og:description" content={excerpt} />
<meta property="og:image" content={post.image_url} />
<meta property="og:url" content={`https://cramersmith.net/blog/${post.slug}`} />
<meta name="twitter:card" content="summary_large_image" />
```

---

## Order of Attack

Do these roughly in order — each builds on the previous:

1. DB migration (unblocks everything else)
2. Store + queries update
3. API routes update
4. `react-markdown` install
5. Feed page update (images, tags, truncation, markdown)
6. Individual post page + routing
7. Admin update (new fields, markdown preview, draft toggle)
8. RSS feed
9. OG meta tags (react-helmet-async)

---

## Deferred / Future

- S3 image upload (currently: paste URL in admin)
- Full-text search across posts
- **Reads count** — track how many times each blog post page has been viewed. Same pattern as the existing visit counter: increment on `GET /api/posts/slug/:slug`, store in a `reads` column on the posts table, display on the post page and in the admin post list.
- Post series / table of contents for long posts
- Comments (third-party embed like giscus, or roll your own)
- Email newsletter digest
