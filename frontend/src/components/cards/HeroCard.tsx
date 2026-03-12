import { motion } from 'framer-motion'
import './HeroCard.css'

export default function HeroCard() {
  return (
    <motion.div
      className="card area-hero hero-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="hero-eyebrow">Available for work</div>
      <h1 className="hero-name">Cramer Smith</h1>
      <p className="hero-tagline">Software Engineer that gets&nbsp;stuff&nbsp;done.</p>
      <div className="hero-accent-bar" />
    </motion.div>
  )
}
