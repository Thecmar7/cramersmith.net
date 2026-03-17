import { motion } from 'framer-motion'
import './ResumeCard.css'

export default function ResumeCard() {
  // TODO: Replace href with the actual path to your resume PDF once added
  const resumeAvailable = true

  return (
    <motion.div
      className={`card area-resume resume-card ${resumeAvailable ? 'clickable' : 'resume-pending'}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={resumeAvailable ? { y: -3 } : {}}
      transition={{ duration: 0.5, delay: 0.2 }}
      onClick={() => {
        if (resumeAvailable) window.open('/resume.pdf', '_blank')
      }}
    >
      <div className="card-label">Resume</div>
      <div className="resume-icon">📄</div>
      <div className="resume-title">
        {resumeAvailable ? 'Download PDF' : 'Coming soon'}
      </div>
      {resumeAvailable && <div className="resume-arrow">↓</div>}
    </motion.div>
  )
}
