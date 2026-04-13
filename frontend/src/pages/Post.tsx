import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Markdown from 'react-markdown'
import { useOGTags, excerpt } from '../hooks/useOGTags'
import './Post.css'

interface Post {
  id: number
  type: string
  title: string | null
  slug: string | null
  content: string
  image_url: string | null
  tags: string[]
  published_at: string | null
  created_at: string
}

function readingTime(content: string): string {
  const words = content.trim().split(/\s+/).length
  const mins = Math.max(1, Math.ceil(words / 200))
  return `${mins} min read`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function Post() {
  const { slug } = useParams<{ slug: string }>()
  const [post, setPost]       = useState<Post | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/posts/slug/${slug}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null }
        return r.json()
      })
      .then(data => { if (data) setPost(data) })
      .catch(() => setNotFound(true))
  }, [slug])

  useOGTags(post ? {
    title:       post.title ?? 'Post',
    description: excerpt(post.content),
    url:         `https://cramersmith.net/blog/${post.slug}`,
    image:       post.image_url,
  } : {
    title:       'cramersmith.net',
    description: 'Software engineer. Thoughts, links, and writing.',
    url:         'https://cramersmith.net/feed',
  })

  if (notFound) {
    return (
      <div className="post-page">
        <Link to="/feed" className="post-back">← Feed</Link>
        <p className="post-not-found">Post not found.</p>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="post-page">
        <Link to="/feed" className="post-back">← Feed</Link>
      </div>
    )
  }

  const publishDate = post.published_at || post.created_at

  return (
    <div className="post-page">
      <Link to="/feed" className="post-back">← Feed</Link>

      <article className="post-article">
        {post.image_url && (
          <img src={post.image_url} alt="" className="post-hero" />
        )}

        <h1 className="post-title">{post.title}</h1>

        <div className="post-meta">
          <span className="post-date">{formatDate(publishDate)}</span>
          <span className="post-dot">·</span>
          <span className="post-reading-time">{readingTime(post.content)}</span>
        </div>

        {post.tags.length > 0 && (
          <div className="post-tags">
            {post.tags.map(tag => (
              <Link key={tag} to={`/feed?tag=${encodeURIComponent(tag)}`} className="post-tag">
                #{tag}
              </Link>
            ))}
          </div>
        )}

        <div className="post-content">
          <Markdown>{post.content}</Markdown>
        </div>
      </article>
    </div>
  )
}
