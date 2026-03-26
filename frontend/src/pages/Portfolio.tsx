import '../components/BentoGrid.css'
import { useVibe } from '../context/VibeContext'
import PhotoCard from '../components/cards/PhotoCard'
import HeroCard from '../components/cards/HeroCard'
import AboutCard from '../components/cards/AboutCard'
import ExperienceCard from '../components/cards/ExperienceCard'
import LinksCard from '../components/cards/LinksCard'
import DnDScreen from './DnDScreen'

export default function Portfolio() {
  const { vibe } = useVibe()

  if (vibe === 'dnd') return <DnDScreen />

  return (
    <div className="grid">
      <PhotoCard />
      <HeroCard />
      <LinksCard />
      <AboutCard />
      {vibe === 'professional' && <ExperienceCard />}
    </div>
  )
}
