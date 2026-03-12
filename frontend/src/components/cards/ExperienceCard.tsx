import { motion } from 'framer-motion'
import './ExperienceCard.css'

interface Job {
  title: string
  company: string
  location: string
  period: string
  bullets: string[]
}

const jobs: Job[] = [
  {
    title: 'Software Engineer II',
    company: 'Indeed Inc.',
    location: 'Vancouver, WA (Remote)',
    period: '6/2022 – 2/2026',
    bullets: [
      'Worked across multiple teams on CI/CD tooling and critical infrastructure, improving deployment reliability and release velocity.',
      'Served as Designated First Responder (DFR) for customer support escalations, owning issue triage and resolution while developing automation to reduce recurring support burden.',
      'Maintained and optimized infrastructure handling 2M+ requests per second.',
      'Leveraged AI agents and tooling to optimize developer workflows, accelerating productivity and codebase comprehension across teams.',
    ],
  },
  {
    title: 'Software Engineer II',
    company: 'Johanson Transportation Services',
    location: 'Tigard, OR',
    period: '7/2019 – 5/2022',
    bullets: [
      'Maintained and improved a suite of 28 internal applications built with C#, .NET, and Angular.',
      'Optimized SQL data management — reduced a critical query load time from 10s to 0.4s (96% reduction).',
      'Designed, implemented, and maintained custom business applications including internal accounting software.',
      'Owned release pipelines for all 28 internal software products.',
    ],
  },
  {
    title: 'Full Stack Web Developer',
    company: 'Source Fresh',
    location: 'Seaside, OR',
    period: '7/2018 – 2/2019',
    bullets: [
      'Built consumer-facing content and business logic prototypes for a food delivery startup.',
      'Delivered full-stack prototypes covering backend, frontend, and e-commerce architecture.',
    ],
  },
  {
    title: 'Software Engineer Intern',
    company: 'Insitu Inc.',
    location: 'Hood River, OR',
    period: '2016 – 2017',
    bullets: [
      'Delivered mission-critical ground control software for small unmanned aerial vehicles.',
      'Produced 3 commercial-ready installers within a single internship term using WiX and NSIS.',
    ],
  },
]

export default function ExperienceCard() {
  return (
    <motion.div
      className="card area-experience experience-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <div className="experience-columns">
        <div className="experience-section">
          <div className="card-label">Experience</div>
          <div className="jobs">
            {jobs.map((job, i) => (
              <div key={i} className="job">
                <div className="job-header">
                  <div>
                    <div className="job-title">{job.title}</div>
                    <div className="job-company">{job.company}</div>
                    <div className="job-location">{job.location}</div>
                  </div>
                  <div className="job-period">{job.period}</div>
                </div>
                <ul className="job-bullets">
                  {job.bullets.map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="education-section">
          <div className="card-label">Education</div>
          <div className="job">
            <div className="job-header">
              <div>
                <div className="job-title">B.S. Computer Science</div>
                <div className="job-company">Oregon State University</div>
                <div className="job-location">Corvallis, OR</div>
              </div>
              <div className="job-period">2014 – 2018</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
