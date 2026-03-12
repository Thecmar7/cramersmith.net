import { motion } from 'framer-motion'
import './LinkCard.css'

interface LinkCardProps {
  area: string
  label: string
  title: string
  href: string
  icon: React.ReactNode
}

export default function LinkCard({ area, label, title, href, icon }: LinkCardProps) {
  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`card clickable link-card ${area}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.5, delay: 0.15 }}
    >
      <div className="card-label">{label}</div>
      <div className="link-icon">{icon}</div>
      <div className="link-title">{title}</div>
      <div className="link-arrow">↗</div>
    </motion.a>
  )
}
