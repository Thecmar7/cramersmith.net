import { useEffect, useState } from 'react'
import './Admin.css'

interface Post {
  id: number
  type: string
  content: string
  url: string | null
  url_title: string | null
  image_url: string | null
  tags: string[]
  draft: boolean
  published_at: string | null
  created_at: string
}

interface ReferralLink {
  token: string
  label: string
  count: number
  created_at: string
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function Admin() {
  const [password, setPassword] = useState(() => sessionStorage.getItem('adminKey') || '')
  const [authed, setAuthed]     = useState(false)
  const [posts, setPosts]       = useState<Post[]>([])
  const [type, setType]         = useState<'thought' | 'link' | 'blog'>('thought')
  const [title, setTitle]       = useState('')
  const [slug, setSlug]         = useState('')
  const [content, setContent]   = useState('')
  const [url, setUrl]           = useState('')
  const [urlTitle, setUrlTitle] = useState('')
  const [status, setStatus]     = useState('')
  const [tags, setTags]               = useState('')
  const [draft, setDraft]             = useState(false)
  const [postToBsky, setPostToBsky]   = useState(false)
  const [imageUrl, setImageUrl]       = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [refLinks, setRefLinks]       = useState<ReferralLink[]>([])
  const [refLabel, setRefLabel]       = useState('')
  const [refStatus, setRefStatus]     = useState('')

  useEffect(() => {
    if (password) { loadPosts(); loadRefLinks() }
  }, [])

  function savePassword() {
    sessionStorage.setItem('adminKey', password)
    loadPosts()
    loadRefLinks()
  }

  async function loadRefLinks() {
    const r = await fetch('/api/referral-links', {
      headers: { Authorization: `Bearer ${password}` },
    })
    if (r.ok) setRefLinks(await r.json())
  }

  async function createRefLink() {
    if (!refLabel.trim()) return
    setRefStatus('Generating...')
    const r = await fetch('/api/referral-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` },
      body: JSON.stringify({ label: refLabel.trim() }),
    })
    if (r.ok) {
      setRefLabel('')
      setRefStatus('Created!')
      loadRefLinks()
      setTimeout(() => setRefStatus(''), 2000)
    } else {
      setRefStatus('Error.')
    }
  }

  async function loadPosts() {
    const r = await fetch('/api/posts?include_drafts=true', {
      headers: { Authorization: `Bearer ${password}` },
    })
    if (r.ok) {
      setPosts(await r.json())
      setAuthed(true)
    } else if (r.status === 401 || r.status === 403) {
      setAuthed(false)
      setStatus('Wrong password.')
    } else {
      setAuthed(false)
      setStatus(`Server error (${r.status}) — check the logs.`)
    }
  }

  async function uploadImage(file: File) {
    setImageUploading(true)
    const form = new FormData()
    form.append('image', file)
    try {
      const r = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${password}` },
        body: form,
      })
      if (r.ok) {
        const { url: uploaded } = await r.json()
        setImageUrl(uploaded)
      } else {
        const msg = await r.text()
        setStatus(`Upload failed: ${msg}`)
      }
    } catch {
      setStatus('Upload failed.')
    } finally {
      setImageUploading(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('Posting...')
    const parsedTags = tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    const body: Record<string, string | string[] | null | boolean> = {
      type,
      content,
      image_url: imageUrl ?? null,
      tags: parsedTags,
      draft,
      post_to_bluesky: postToBsky,
    }
    if (type === 'link') {
      body.url       = url || null
      body.url_title = urlTitle || null
    }
    if (type === 'blog') {
      body.title = title || null
      body.slug  = slug || null
    }
    const r = await fetch('/api/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${password}`,
      },
      body: JSON.stringify(body),
    })
    if (r.ok) {
      setTitle(''); setSlug(''); setContent(''); setUrl(''); setUrlTitle(''); setTags(''); setDraft(false); setPostToBsky(false); setImageUrl(null)
      setStatus(postToBsky ? 'Posted! (+ Bluesky)' : 'Posted!')
      loadPosts()
      setTimeout(() => setStatus(''), 2000)
    } else {
      setStatus('Error posting.')
    }
  }

  async function publishPost(id: number) {
    const r = await fetch(`/api/posts/${id}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${password}` },
    })
    if (r.ok) {
      const updated = await r.json()
      setPosts(p => p.map(x => x.id === id ? updated : x))
    } else {
      setStatus(`Publish failed (${r.status}).`)
    }
  }

  async function deletePost(id: number) {
    const r = await fetch(`/api/posts/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${password}` },
    })
    if (r.ok) {
      setPosts(p => p.filter(x => x.id !== id))
    } else {
      setStatus(`Delete failed (${r.status}).`)
    }
  }

  function logout() {
    sessionStorage.removeItem('adminKey')
    setPassword('')
    setAuthed(false)
    setStatus('')
  }

  if (!authed) {
    return (
      <div className="admin">
        <div className="admin-login">
          <h1 className="admin-title">Admin</h1>
          <input
            className="admin-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && savePassword()}
          />
          <button className="admin-btn" onClick={savePassword}>Enter</button>
          {status && <p className="admin-status">{status}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="admin">
      <div className="admin-topbar">
        <h1 className="admin-title">New Post</h1>
        <button className="admin-logout" onClick={logout}>Log out</button>
      </div>

      <form className="admin-form" onSubmit={submit}>
        <div className="admin-type-toggle">
          <button
            type="button"
            className={`admin-type-btn ${type === 'thought' ? 'active' : ''}`}
            onClick={() => setType('thought')}
          >
            Thought
          </button>
          <button
            type="button"
            className={`admin-type-btn ${type === 'link' ? 'active' : ''}`}
            onClick={() => setType('link')}
          >
            Link
          </button>
          <button
            type="button"
            className={`admin-type-btn ${type === 'blog' ? 'active' : ''}`}
            onClick={() => setType('blog')}
          >
            Blog
          </button>
        </div>

        {type === 'blog' && (
          <>
            <input
              className="admin-input"
              type="text"
              placeholder="Title"
              value={title}
              required
              onChange={e => {
                setTitle(e.target.value)
                if (!slug || slug === slugify(title)) {
                  setSlug(slugify(e.target.value))
                }
              }}
            />
            <input
              className="admin-input"
              type="text"
              placeholder="Slug (auto-generated)"
              value={slug}
              onChange={e => setSlug(e.target.value)}
            />
          </>
        )}

        {type === 'link' && (
          <>
            <input
              className="admin-input"
              type="url"
              placeholder="URL"
              value={url}
              onChange={e => setUrl(e.target.value)}
            />
            <input
              className="admin-input"
              type="text"
              placeholder="Title (optional — leave blank to use URL)"
              value={urlTitle}
              onChange={e => setUrlTitle(e.target.value)}
            />
          </>
        )}

        <textarea
          className="admin-textarea"
          placeholder={
            type === 'blog' ? 'Write your post in markdown…' :
            type === 'link' ? 'Comment (optional)' :
            "What's on your mind?"
          }
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={type === 'blog' ? 16 : 4}
          required={type === 'thought'}
        />

        <input
          className="admin-input"
          type="text"
          placeholder="Tags (comma-separated, e.g. travel, food)"
          value={tags}
          onChange={e => setTags(e.target.value)}
        />

        <div className="admin-image-section">
          {imageUrl ? (
            <div className="admin-image-preview">
              <img src={imageUrl} alt="preview" className="admin-image-thumb" />
              <button type="button" className="admin-image-remove" onClick={() => setImageUrl(null)}>
                Remove image
              </button>
            </div>
          ) : (
            <label className="admin-image-upload">
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f) }}
              />
              {imageUploading ? 'Uploading...' : '+ Add image'}
            </label>
          )}
        </div>

        <div className="admin-toggles">
          <label className="admin-bsky-label">
            <input
              type="checkbox"
              checked={draft}
              onChange={e => setDraft(e.target.checked)}
            />
            Save as draft
          </label>
          <label className="admin-bsky-label">
            <input
              type="checkbox"
              checked={postToBsky}
              onChange={e => setPostToBsky(e.target.checked)}
              disabled={draft}
            />
            Post to Bluesky
          </label>
        </div>

        <button className="admin-btn admin-btn--submit" type="submit">
          {draft ? 'Save draft' : 'Post'}
        </button>
        {status && <p className="admin-status">{status}</p>}
      </form>

      <div className="admin-posts">
        <h2 className="admin-section-title">Posts</h2>
        {posts.map(post => (
          <div key={post.id} className={`admin-post ${post.draft ? 'admin-post--draft' : ''}`}>
            <div className="admin-post-info">
              <span className="admin-post-type">{post.type}</span>
              {post.draft && <span className="admin-draft-badge">DRAFT</span>}
              <span className="admin-post-content">
                {post.type === 'link' ? (post.url_title || post.url) : post.content}
              </span>
            </div>
            <div className="admin-post-actions">
              {post.draft && (
                <button className="admin-publish" onClick={() => publishPost(post.id)}>Publish</button>
              )}
              <button className="admin-delete" onClick={() => deletePost(post.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-referrals">
        <h2 className="admin-section-title">Referral Links</h2>
        <div className="admin-referral-form">
          <input
            className="admin-input"
            type="text"
            placeholder="Label (e.g. instagram bio)"
            value={refLabel}
            onChange={e => setRefLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createRefLink()}
          />
          <button className="admin-btn" onClick={createRefLink}>Generate</button>
          {refStatus && <p className="admin-status">{refStatus}</p>}
        </div>
        {refLinks.map(link => {
          const url = `${window.location.origin}/?ref=${link.token}`
          return (
            <div key={link.token} className="admin-post">
              <div className="admin-post-info">
                <span className="admin-post-type">{link.count}</span>
                <span className="admin-post-content">{link.label}</span>
                <span className="admin-ref-token">{link.token}</span>
              </div>
              <button
                className="admin-delete"
                onClick={() => navigator.clipboard.writeText(url)}
              >
                Copy
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
