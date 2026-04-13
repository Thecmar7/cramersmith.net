import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import Markdown from 'react-markdown'
import './Feed.css'
import '../components/BentoGrid.css'
import LinksCard from '../components/cards/LinksCard'

interface Post {
  id: number
  type: 'thought' | 'link' | 'blog'
  title: string | null
  slug: string | null
  content: string
  url: string | null
  url_title: string | null
  image_url: string | null
  tags: string[]
  published_at: string | null
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
  const [posts, setPosts]   = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTag = searchParams.get('tag')

  useEffect(() => {
    setLoading(true)
    const url = activeTag ? `/api/posts?tag=${encodeURIComponent(activeTag)}` : '/api/posts'
    fetch(url)
      .then(r => r.json())
      .then(data => { setPosts(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [activeTag])

  function selectTag(tag: string) {
    setSearchParams({ tag })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function clearTag() {
    setSearchParams({})
  }

  return (
    <div className="feed">
      <div className="feed-header">
        <h1 className="feed-title">Feed</h1>
        <p className="feed-subtitle">Thoughts, links, and things worth sharing.</p>
      </div>

      {activeTag && (
        <div className="feed-tag-filter">
          <span className="feed-tag-filter-label">#{activeTag}</span>
          <button className="feed-tag-filter-clear" onClick={clearTag}>✕ clear</button>
        </div>
      )}

      {loading && <div className="feed-empty">Loading...</div>}

      {!loading && posts.length === 0 && (
        <div className="feed-empty">
          {activeTag ? `No posts tagged #${activeTag}.` : 'Nothing here yet.'}
        </div>
      )}

      <div className="feed-posts">
        {posts.map(post => (
          <article key={post.id} className={`feed-post feed-post--${post.type}`}>
            <div className="feed-post-meta">
              <span className="feed-post-type">{post.type}</span>
              <span className="feed-post-time">{timeAgo(post.created_at)}</span>
            </div>

            {post.image_url && (
              <img src={post.image_url} alt="" className="feed-post-image" />
            )}

            {post.type === 'blog' && post.slug ? (
              <>
                {post.title && (
                  <Link to={`/blog/${post.slug}`} className="feed-post-blog-title">
                    {post.title}
                  </Link>
                )}
                <div className="feed-post-content feed-post-content--clamped">
                  <Markdown>{post.content}</Markdown>
                </div>
                <Link to={`/blog/${post.slug}`} className="feed-post-readmore">
                  Read more →
                </Link>
              </>
            ) : post.type === 'link' && post.url ? (
              <>
                <a href={post.url} target="_blank" rel="noopener noreferrer" className="feed-post-link">
                  {post.url_title || post.url}
                  <span className="feed-post-link-arrow">↗</span>
                </a>
                {post.content && (
                  <div className="feed-post-content">
                    <Markdown>{post.content}</Markdown>
                  </div>
                )}
              </>
            ) : (
              <div className="feed-post-content">
                <Markdown>{post.content}</Markdown>
              </div>
            )}

            {post.tags.length > 0 && (
              <div className="feed-post-tags">
                {post.tags.map(tag => (
                  <button
                    key={tag}
                    className={`feed-post-tag ${activeTag === tag ? 'active' : ''}`}
                    onClick={() => activeTag === tag ? clearTag() : selectTag(tag)}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
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
