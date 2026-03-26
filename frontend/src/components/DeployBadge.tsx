const hash = import.meta.env.VITE_GIT_HASH as string | undefined
const date = import.meta.env.VITE_GIT_DATE as string | undefined

export default function DeployBadge() {
  if (!hash || !date) return null

  const short = hash.slice(0, 7)
  const url = `https://github.com/Thecmar7/cramersmith.net/commit/${hash}`

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        position: 'fixed',
        bottom: '10px',
        right: '14px',
        fontSize: '11px',
        color: 'var(--text-muted)',
        opacity: 0.6,
        fontFamily: 'monospace',
        letterSpacing: '0.02em',
        textDecoration: 'none',
        zIndex: 9999,
      }}
    >
      {date} · {short}
    </a>
  )
}
