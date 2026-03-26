import { useEffect, useState } from 'react'
import './Feed.css'
import '../components/BentoGrid.css'
import LinksCard from '../components/cards/LinksCard'

interface Post {
  id: number
  type: 'thought' | 'link'
  content: string
  url: string | null
  url_title: string | null
  created_at: string
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  < 1)   return 'just now'
  if (mins  < 60)  return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  if (days  < 30)  return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Feed() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/posts')
      .then(r => r.json())
      .then(data => { setPosts(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="feed">
      <div className="feed-header">
        <h1 className="feed-title">Feed</h1>
        <p className="feed-subtitle">Thoughts, links, and things worth sharing.</p>
      </div>

      {loading && <div className="feed-empty">Loading...</div>}

      {!loading && posts.length === 0 && (
        <div className="feed-empty">Nothing here yet.</div>
      )}

      <div className="feed-posts">
        {posts.map(post => (
          <article key={post.id} className={`feed-post feed-post--${post.type}`}>
            <div className="feed-post-meta">
              <span className={`feed-post-type`}>{post.type}</span>
              <span className="feed-post-time">{timeAgo(post.created_at)}</span>
            </div>

            {post.type === 'link' && post.url ? (
              <>
                <a href={post.url} target="_blank" rel="noopener noreferrer" className="feed-post-link">
                  {post.url_title || post.url}
                  <span className="feed-post-link-arrow">↗</span>
                </a>
                {post.content && <p className="feed-post-content">{post.content}</p>}
              </>
            ) : (
              <p className="feed-post-content">{post.content}</p>
            )}
          </article>
        ))}
      </div>

      <div className="feed-links-section">
        <LinksCard />
      </div>
    </div>
  )
}
