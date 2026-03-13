import { useEffect, useState } from 'react'
import './Admin.css'

interface Post {
  id: number
  type: string
  content: string
  url: string | null
  url_title: string | null
  created_at: string
}

export default function Admin() {
  const [password, setPassword] = useState(() => localStorage.getItem('adminKey') || '')
  const [authed, setAuthed]     = useState(false)
  const [posts, setPosts]       = useState<Post[]>([])
  const [type, setType]         = useState<'thought' | 'link'>('thought')
  const [content, setContent]   = useState('')
  const [url, setUrl]           = useState('')
  const [urlTitle, setUrlTitle] = useState('')
  const [status, setStatus]     = useState('')

  useEffect(() => {
    if (password) loadPosts()
  }, [])

  function savePassword() {
    localStorage.setItem('adminKey', password)
    loadPosts()
  }

  async function loadPosts() {
    const r = await fetch('/api/posts', {
      headers: { Authorization: `Bearer ${password}` },
    })
    if (r.ok) {
      setPosts(await r.json())
      setAuthed(true)
    } else {
      setAuthed(false)
      setStatus('Wrong password.')
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('Posting...')
    const body: Record<string, string | null> = { type, content }
    if (type === 'link') {
      body.url       = url || null
      body.url_title = urlTitle || null
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
      setContent(''); setUrl(''); setUrlTitle('')
      setStatus('Posted!')
      loadPosts()
      setTimeout(() => setStatus(''), 2000)
    } else {
      setStatus('Error posting.')
    }
  }

  async function deletePost(id: number) {
    await fetch(`/api/posts/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${password}` },
    })
    setPosts(p => p.filter(x => x.id !== id))
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
      <h1 className="admin-title">New Post</h1>

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
        </div>

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
          placeholder={type === 'link' ? 'Comment (optional)' : 'What\'s on your mind?'}
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={4}
          required={type === 'thought'}
        />

        <button className="admin-btn admin-btn--submit" type="submit">Post</button>
        {status && <p className="admin-status">{status}</p>}
      </form>

      <div className="admin-posts">
        <h2 className="admin-section-title">Posts</h2>
        {posts.map(post => (
          <div key={post.id} className="admin-post">
            <div className="admin-post-info">
              <span className="admin-post-type">{post.type}</span>
              <span className="admin-post-content">
                {post.type === 'link' ? (post.url_title || post.url) : post.content}
              </span>
            </div>
            <button className="admin-delete" onClick={() => deletePost(post.id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  )
}
