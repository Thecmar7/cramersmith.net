import '../components/BentoGrid.css'
import PhotoCard from '../components/cards/PhotoCard'
import HeroCard from '../components/cards/HeroCard'
import AboutCard from '../components/cards/AboutCard'
import ExperienceCard from '../components/cards/ExperienceCard'
import LinksCard from '../components/cards/LinksCard'

export default function Portfolio() {
  return (
    <div className="grid">
      <PhotoCard />
      <HeroCard />
      <LinksCard />
      <AboutCard />
      <ExperienceCard />
    </div>
  )
}
