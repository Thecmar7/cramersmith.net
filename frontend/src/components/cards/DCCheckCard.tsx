import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import './DCCheckCard.css'

const QUICK_DCS = [
  { dc: 5,  label: 'Very Easy' },
  { dc: 10, label: 'Easy' },
  { dc: 15, label: 'Medium' },
  { dc: 20, label: 'Hard' },
  { dc: 25, label: 'Very Hard' },
  { dc: 30, label: 'Nearly Impossible' },
]

interface Result {
  roll: number
  total: number
  dc: number
  passed: boolean
  id: number
}

export default function DCCheckCard() {
  const [dc, setDc] = useState(15)
  const [modifier, setModifier] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const [counter, setCounter] = useState(0)

  function roll() {
    const rolled = Math.floor(Math.random() * 20) + 1
    const total = rolled + modifier
    setResult({ roll: rolled, total, dc, passed: total >= dc, id: counter })
    setCounter(c => c + 1)
  }

  const margin = result ? Math.abs(result.total - result.dc) : 0

  return (
    <motion.div
      className="card area-dccheck dccheck-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
    >
      <div className="card-label">DC Check</div>

      <div className="dccheck-row">
        <div className="dccheck-field">
          <span className="dccheck-field-label">DC</span>
          <div className="dccheck-quick">
            {QUICK_DCS.map(({ dc: d, label }) => (
              <button
                key={d}
                className={`dc-btn ${dc === d ? 'dc-btn--active' : ''}`}
                onClick={() => setDc(d)}
                title={label}
              >
                <span className="dc-btn-number">{d}</span>
                <span className="dc-btn-label">{label}</span>
              </button>
            ))}
          </div>
          <div className="dccheck-stepper">
            <button onClick={() => setDc(d => Math.max(1, d - 1))}>−</button>
            <span className="dccheck-value">{dc}</span>
            <button onClick={() => setDc(d => d + 1)}>+</button>
          </div>
        </div>

        <div className="dccheck-field">
          <span className="dccheck-field-label">Modifier</span>
          <div className="dccheck-stepper">
            <button onClick={() => setModifier(m => m - 1)}>−</button>
            <span className="dccheck-value">{modifier >= 0 ? `+${modifier}` : modifier}</span>
            <button onClick={() => setModifier(m => m + 1)}>+</button>
          </div>
        </div>
      </div>

      <button className="roll-btn" onClick={roll}>
        Roll d20{modifier !== 0 ? (modifier > 0 ? ` +${modifier}` : ` ${modifier}`) : ''} vs DC {dc}
      </button>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={result.id}
            className={`dccheck-result ${result.passed ? 'dccheck-result--pass' : 'dccheck-result--fail'}`}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          >
            <span className="dccheck-outcome">{result.passed ? 'Pass' : 'Fail'}</span>
            <span className="dccheck-detail">
              {result.roll} rolled {modifier !== 0 && `· ${result.total} total `}
              · {result.passed ? `beats DC by ${margin}` : `missed by ${margin}`}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
