import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import './DiceRollerCard.css'

const DICE = [4, 6, 8, 10, 12, 20, 100]
const ROLL_TYPES = ['Attack', 'Damage', 'Save', 'Check', 'Initiative', 'Custom']

interface RollEntry {
  id: number
  rollType: string
  diceCount: number
  dieSize: number
  rolls: number[]
  total: number
}

export default function DiceRollerCard() {
  const [dieSize, setDieSize]     = useState(20)
  const [diceCount, setDiceCount] = useState(1)
  const [rollType, setRollType]   = useState('Attack')
  const [customType, setCustomType] = useState('')
  const [current, setCurrent]     = useState<RollEntry | null>(null)
  const [history, setHistory]     = useState<RollEntry[]>([])
  const [counter, setCounter]     = useState(0)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [token, setToken]         = useState(() => sessionStorage.getItem('adminKey') || '')
  const [tokenInput, setTokenInput] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)

  function roll() {
    const rolls = Array.from({ length: diceCount }, () => Math.floor(Math.random() * dieSize) + 1)
    const total = rolls.reduce((a, b) => a + b, 0)
    const label = rollType === 'Custom' ? (customType.trim() || 'custom') : rollType.toLowerCase()
    const entry: RollEntry = { id: counter, rollType: label, diceCount, dieSize, rolls, total }
    setCurrent(entry)
    setHistory(h => [entry, ...h].slice(0, 6))
    setCounter(c => c + 1)
    setSaved(false)
  }

  async function save(t = token) {
    if (!current || !t) { setNeedsAuth(true); return }
    setSaving(true)
    try {
      const r = await fetch('/api/dice-rolls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({
          roll_type:  current.rollType,
          dice_count: current.diceCount,
          die_size:   current.dieSize,
          modifier:   0,
          rolls:      current.rolls,
          total:      current.total,
        }),
      })
      if (r.status === 401) { setNeedsAuth(true); setToken(''); sessionStorage.removeItem('adminKey') }
      else { setSaved(true); setNeedsAuth(false) }
    } finally {
      setSaving(false)
    }
  }

  function submitToken() {
    const t = tokenInput.trim()
    if (!t) return
    setToken(t)
    sessionStorage.setItem('adminKey', t)
    setTokenInput('')
    save(t)
  }

  const isCrit = current && diceCount === 1 && dieSize === 20 && current.rolls[0] === 20
  const isFail = current && diceCount === 1 && dieSize === 20 && current.rolls[0] === 1

  return (
    <motion.div
      className="card area-dice dice-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="card-label">Dice Roller</div>

      <div className="dice-selector">
        {DICE.map(d => (
          <button
            key={d}
            className={`die-btn ${dieSize === d ? 'die-btn--active' : ''}`}
            onClick={() => setDieSize(d)}
          >
            d{d}
          </button>
        ))}
      </div>

      <div className="dice-quantity-row">
        <span className="dice-quantity-label">Quantity</span>
        <div className="dccheck-stepper">
          <button onClick={() => setDiceCount(n => Math.max(1, n - 1))}>−</button>
          <span className="dccheck-value">{diceCount}</span>
          <button onClick={() => setDiceCount(n => Math.min(20, n + 1))}>+</button>
        </div>
        <span className="dice-summary">{diceCount}d{dieSize}</span>
      </div>

      <div className="dice-type-row">
        {ROLL_TYPES.map(t => (
          <button
            key={t}
            className={`die-btn ${rollType === t ? 'die-btn--active' : ''}`}
            onClick={() => setRollType(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {rollType === 'Custom' && (
        <input
          className="dice-custom-input"
          placeholder="Label this roll…"
          value={customType}
          onChange={e => setCustomType(e.target.value)}
        />
      )}

      <button className="roll-btn" onClick={roll}>
        Roll {diceCount}d{dieSize}
      </button>

      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            key={current.id}
            className={`roll-result ${isCrit ? 'roll-result--crit' : ''} ${isFail ? 'roll-result--fail' : ''}`}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <span className="roll-result-number">{current.total}</span>
            <span className="roll-result-dice">
              {current.rolls.length > 1
                ? `[${current.rolls.join(', ')}]`
                : null}
            </span>
            {isCrit && <span className="roll-result-label">Nat 20!</span>}
            {isFail && <span className="roll-result-label">Nat 1</span>}
          </motion.div>
        )}
      </AnimatePresence>

      {current && !needsAuth && (
        <button
          className={`save-btn ${saved ? 'save-btn--saved' : ''}`}
          onClick={() => save()}
          disabled={saving || saved}
        >
          {saved ? 'Saved' : saving ? 'Saving…' : `Save ${current.rollType} roll`}
        </button>
      )}

      {current && needsAuth && (
        <div className="dice-auth-row">
          <input
            className="dice-custom-input"
            type="password"
            placeholder="Enter token to save…"
            value={tokenInput}
            onChange={e => setTokenInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitToken()}
          />
          <button className="save-btn" onClick={submitToken}>Save</button>
        </div>
      )}

      {history.length > 1 && (
        <div className="roll-history">
          {history.slice(1).map(r => (
            <span key={r.id} className="roll-history-item">
              {r.rollType}: {r.diceCount}d{r.dieSize} → {r.total}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  )
}
