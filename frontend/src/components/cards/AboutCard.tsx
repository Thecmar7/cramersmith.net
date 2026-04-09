import { motion } from 'framer-motion'
import { useVibe } from '../../context/VibeContext'
import './AboutCard.css'

export default function AboutCard() {
  const { vibe } = useVibe()

  return (
    <motion.div
      className="card area-about about-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <div className="card-label">About</div>
      {vibe === 'fun' ? (
        <>
          <p className="about-text">
            Outside of work, I build things with my hands. Home improvement projects, furniture in
            the shop, whatever the project calls for. I DM D&amp;D campaigns
            for my friends, stream on Twitch, and am always in the middle of something.
            Happiest when I'm making.
          </p>
          <div className="about-skills">
            {['Woodworking', 'Home Improvement', 'D&D', 'Twitch', 'Making'].map(tag => (
              <span key={tag} className="skill-tag">{tag}</span>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="about-text">
            Software engineer with <strong>8 years of experience</strong> across diverse domains,
            from CI/CD infrastructure at massive scale to full-stack product work at startups.
            I ship reliable, well-tested code fast, ramp quickly on complex systems, and communicate
            clearly across teams and with customers.
          </p>
          <div className="about-skills">
            {['Go', 'TypeScript', 'React', 'C#', 'Python', 'SQL', 'AWS', 'Kubernetes'].map(skill => (
              <span key={skill} className="skill-tag">{skill}</span>
            ))}
          </div>
        </>
      )}
    </motion.div>
  )
}
