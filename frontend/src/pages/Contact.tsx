import { useMemo } from 'react'
import { useOGTags } from '../hooks/useOGTags'
import './Contact.css'

// Decode ROT13 — used to obfuscate the email address in source and bundle.
const rot13 = (s: string) =>
  s.replace(/[a-zA-Z]/g, c =>
    String.fromCharCode(c.charCodeAt(0) + (c.toLowerCase() < 'n' ? 13 : -13))
  )

// Not a recognizable email address in source or the compiled JS bundle.
const ENCODED_EMAIL = 'penzre.f.fzvgu@tznvy.pbz'

const socialLinks = [
  { label: 'GitHub',   handle: '@Thecmar7',                   href: 'https://github.com/Thecmar7' },
  { label: 'LinkedIn', handle: 'cramer-smith',                href: 'https://www.linkedin.com/in/cramer-smith/' },
  { label: 'Bluesky',  handle: '@cramandcheese.bsky.social',  href: 'https://bsky.app/profile/cramandcheese.bsky.social' },
]

export default function Contact() {
  const email = useMemo(() => rot13(ENCODED_EMAIL), [])

  useOGTags({
    title:       'Contact',
    description: 'Get in touch with Cramer Smith.',
    url:         'https://cramersmith.net/contact',
    type:        'website',
  })

  return (
    <div className="contact-page">
      <h1 className="contact-heading">Contact</h1>
      <p className="contact-intro">
        Best way to reach me is email. I'm also around in a few other places.
      </p>

      <section className="contact-section">
        <h2 className="contact-label">Email</h2>
        <a href={`mailto:${email}`} className="contact-email">
          {email}
        </a>
      </section>

      <section className="contact-section">
        <h2 className="contact-label">Elsewhere</h2>
        <div className="contact-links">
          {socialLinks.map(link => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="contact-link"
            >
              <span className="contact-link-label">{link.label}</span>
              <span className="contact-link-handle">{link.handle}</span>
              <span className="contact-link-arrow">↗</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
