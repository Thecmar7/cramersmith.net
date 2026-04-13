import { useEffect } from 'react'

interface OGTags {
  title: string
  description: string
  url: string
  image?: string | null
  type?: string
}

function setMeta(property: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
    ?? document.querySelector<HTMLMetaElement>(`meta[name="${property}"]`)
  if (!el) {
    el = document.createElement('meta')
    // Use name= for twitter:* tags, property= for og:* tags
    if (property.startsWith('twitter:')) {
      el.setAttribute('name', property)
    } else {
      el.setAttribute('property', property)
    }
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

// Strips markdown syntax to produce plain text for descriptions.
function stripMarkdown(md: string): string {
  return md
    .replace(/#{1,6}\s+/g, '')       // headings
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold
    .replace(/\*(.+?)\*/g, '$1')     // italic
    .replace(/`{1,3}[^`]*`{1,3}/g, '') // code
    .replace(/!\[.*?\]\(.*?\)/g, '') // images
    .replace(/\[(.+?)\]\(.*?\)/g, '$1') // links
    .replace(/>\s+/g, '')            // blockquotes
    .replace(/\n+/g, ' ')            // newlines
    .trim()
}

function excerpt(content: string, maxLen = 160): string {
  const plain = stripMarkdown(content)
  if (plain.length <= maxLen) return plain
  return plain.slice(0, plain.lastIndexOf(' ', maxLen)) + '…'
}

export function useOGTags({ title, description, url, image, type = 'article' }: OGTags) {
  useEffect(() => {
    const prev = {
      title: document.title,
      ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? '',
      ogDesc:  document.querySelector('meta[property="og:description"]')?.getAttribute('content') ?? '',
      ogUrl:   document.querySelector('meta[property="og:url"]')?.getAttribute('content') ?? '',
      ogType:  document.querySelector('meta[property="og:type"]')?.getAttribute('content') ?? '',
      twTitle: document.querySelector('meta[name="twitter:title"]')?.getAttribute('content') ?? '',
      twDesc:  document.querySelector('meta[name="twitter:description"]')?.getAttribute('content') ?? '',
    }

    document.title = `${title} | cramersmith.net`
    setMeta('og:title', title)
    setMeta('og:description', description)
    setMeta('og:url', url)
    setMeta('og:type', type)
    setMeta('twitter:title', title)
    setMeta('twitter:description', description)
    if (image) setMeta('og:image', image)
    if (image) setMeta('twitter:image', image)

    return () => {
      document.title = prev.title
      setMeta('og:title', prev.ogTitle)
      setMeta('og:description', prev.ogDesc)
      setMeta('og:url', prev.ogUrl)
      setMeta('og:type', prev.ogType)
      setMeta('twitter:title', prev.twTitle)
      setMeta('twitter:description', prev.twDesc)
    }
  }, [title, description, url, image, type])
}

export { excerpt }
