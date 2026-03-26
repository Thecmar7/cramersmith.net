import { motion } from 'framer-motion'
import { useVibe } from '../../context/VibeContext'
import './HeroCard.css'

export default function HeroCard() {
  const { vibe } = useVibe()

  return (
    <motion.div
      className="card area-hero hero-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="hero-eyebrow">
        {vibe === 'fun' ? 'Maker · DM · Streamer' : 'Available for work'}
      </div>
      <h1 className="hero-name">Cramer Smith</h1>
      <p className="hero-tagline">
        {vibe === 'fun'
          ? 'Engineer by day. Maker by night.'
          : 'Software Engineer that gets\u00a0stuff\u00a0done.'}
      </p>
      <div className="hero-accent-bar" />
    </motion.div>
  )
}
