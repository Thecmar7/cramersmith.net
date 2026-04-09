import { useEffect } from 'react'
import '../components/BentoGrid.css'
import DiceRollerCard from '../components/cards/DiceRollerCard'
import DCCheckCard from '../components/cards/DCCheckCard'
import ConditionsCard from '../components/cards/ConditionsCard'
import InitiativeTrackerCard from '../components/cards/InitiativeTrackerCard'

export default function DnDScreen() {
  useEffect(() => {
    document.documentElement.setAttribute('data-page', 'dnd')
    return () => document.documentElement.removeAttribute('data-page')
  }, [])

  return (
    <div className="grid">
      <DiceRollerCard />
      <DCCheckCard />
      <ConditionsCard />
      <InitiativeTrackerCard />
    </div>
  )
}
