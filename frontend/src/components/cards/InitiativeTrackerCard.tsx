import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import './InitiativeTrackerCard.css'

interface Combatant {
  id: number
  name: string
  initiative: number
  hp: number | null
}

let nextId = 0

export default function InitiativeTrackerCard() {
  const [combatants, setCombatants] = useState<Combatant[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [nameInput, setNameInput] = useState('')
  const [initInput, setInitInput] = useState('')
  const [hpInput, setHpInput] = useState('')

  const sorted = [...combatants].sort((a, b) => b.initiative - a.initiative)

  function add() {
    const name = nameInput.trim()
    const initiative = parseInt(initInput, 10)
    if (!name || isNaN(initiative)) return
    const hp = hpInput !== '' ? parseInt(hpInput, 10) : null
    setCombatants(prev => [...prev, { id: nextId++, name, initiative, hp: isNaN(hp as number) ? null : hp }])
    setNameInput('')
    setInitInput('')
    setHpInput('')
    setCurrentIndex(0)
  }

  function remove(id: number) {
    setCombatants(prev => {
      const next = prev.filter(c => c.id !== id)
      setCurrentIndex(i => Math.min(i, Math.max(0, next.length - 1)))
      return next
    })
  }

  function nextTurn() {
    if (sorted.length === 0) return
    setCurrentIndex(i => (i + 1) % sorted.length)
  }

  function updateHp(id: number, value: string) {
    const hp = value === '' ? null : parseInt(value, 10)
    setCombatants(prev => prev.map(c => c.id === id ? { ...c, hp: isNaN(hp as number) ? null : hp } : c))
  }

  function clear() {
    setCombatants([])
    setCurrentIndex(0)
  }

  return (
    <motion.div
      className="card area-initiative initiative-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <div className="initiative-header">
        <div className="card-label">Initiative</div>
        {combatants.length > 0 && (
          <button className="initiative-clear-btn" onClick={clear}>Clear</button>
        )}
      </div>

      <div className="initiative-add-row">
        <input
          className="initiative-input"
          placeholder="Name"
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
        />
        <input
          className="initiative-input initiative-input--narrow"
          placeholder="Init"
          type="number"
          value={initInput}
          onChange={e => setInitInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
        />
        <input
          className="initiative-input initiative-input--narrow"
          placeholder="HP"
          type="number"
          value={hpInput}
          onChange={e => setHpInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
        />
        <button className="initiative-add-btn" onClick={add}>Add</button>
      </div>

      <div className="initiative-list">
        <AnimatePresence>
          {sorted.map((c, i) => (
            <motion.div
              key={c.id}
              className={`initiative-row ${i === currentIndex ? 'initiative-row--active' : ''}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              <span className="initiative-turn-marker">{i === currentIndex ? '▶' : ''}</span>
              <span className="initiative-value">{c.initiative}</span>
              <span className="initiative-name">{c.name}</span>
              {c.hp !== null && (
                <span className="initiative-hp-label">HP</span>
              )}
              <input
                className={`initiative-hp-input ${c.hp !== null && c.hp <= 0 ? 'initiative-hp-input--dead' : ''}`}
                type="number"
                value={c.hp ?? ''}
                placeholder="—"
                onChange={e => updateHp(c.id, e.target.value)}
              />
              <button className="initiative-remove-btn" onClick={() => remove(c.id)}>×</button>
            </motion.div>
          ))}
        </AnimatePresence>

        {combatants.length === 0 && (
          <div className="initiative-empty">Add combatants to begin</div>
        )}
      </div>

      {sorted.length > 1 && (
        <button className="initiative-next-btn" onClick={nextTurn}>
          Next Turn
        </button>
      )}
    </motion.div>
  )
}
