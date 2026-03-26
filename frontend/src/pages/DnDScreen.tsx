import '../components/BentoGrid.css'
import DiceRollerCard from '../components/cards/DiceRollerCard'
import DCCheckCard from '../components/cards/DCCheckCard'
import ConditionsCard from '../components/cards/ConditionsCard'

export default function DnDScreen() {
  return (
    <div className="grid">
      <DiceRollerCard />
      <DCCheckCard />
      <ConditionsCard />
    </div>
  )
}
