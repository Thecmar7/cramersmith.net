import { useState } from 'react'
import { motion } from 'framer-motion'
import './ConditionsCard.css'

const conditions = [
  { name: 'Blinded',       desc: "Can't see. Attacks against you have advantage; your attacks have disadvantage." },
  { name: 'Charmed',       desc: "Can't attack the charmer. Charmer has advantage on social checks against you." },
  { name: 'Deafened',      desc: "Can't hear. Auto-fail any check requiring hearing." },
  { name: 'Exhaustion',    desc: 'Levels 1–6: disadvantage on checks → speed halved → disadvantage on attacks/saves → speed 0 → fail all saves → death.' },
  { name: 'Frightened',    desc: "Disadvantage on checks/attacks while source is visible. Can't move closer to source." },
  { name: 'Grappled',      desc: 'Speed becomes 0. Ends if grappler is incapacitated or you are moved out of reach.' },
  { name: 'Incapacitated', desc: "Can't take actions or reactions." },
  { name: 'Invisible',     desc: 'Can\'t be seen. Your attacks have advantage; attacks against you have disadvantage.' },
  { name: 'Paralyzed',     desc: 'Incapacitated, can\'t move or speak. Auto-fail Str/Dex saves. Attacks within 5 ft are crits.' },
  { name: 'Petrified',     desc: 'Turned to stone. Incapacitated. Auto-fail Str/Dex saves. Resistance to all damage. Immune to poison/disease.' },
  { name: 'Poisoned',      desc: 'Disadvantage on attack rolls and ability checks.' },
  { name: 'Prone',         desc: 'Disadvantage on attacks. Attacks within 5 ft have advantage against you; ranged attacks have disadvantage.' },
  { name: 'Restrained',    desc: 'Speed 0. Disadvantage on attacks and Dex saves. Attacks against you have advantage.' },
  { name: 'Stunned',       desc: 'Incapacitated, can\'t move. Auto-fail Str/Dex saves. Attacks against you have advantage.' },
  { name: 'Unconscious',   desc: 'Incapacitated, drop items, fall prone. Auto-fail Str/Dex saves. Attacks within 5 ft are crits.' },
]

export default function ConditionsCard() {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <motion.div
      className="card area-conditions conditions-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <div className="card-label">Conditions</div>
      <div className="conditions-list">
        {conditions.map(c => (
          <div
            key={c.name}
            className={`condition-row ${expanded === c.name ? 'condition-row--open' : ''}`}
            onClick={() => setExpanded(expanded === c.name ? null : c.name)}
          >
            <div className="condition-name">{c.name}</div>
            {expanded === c.name && (
              <div className="condition-desc">{c.desc}</div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  )
}
