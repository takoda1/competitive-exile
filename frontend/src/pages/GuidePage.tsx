import { useState } from 'react'
import './GuidePage.css'

interface CraftSection {
  title: string
  steps: string[]
}

interface ProfitCraft {
  id: string
  name: string
  timing?: string
  difficulty: 'Low' | 'Medium' | 'High'
  timeInvestment: 'Low' | 'Medium' | 'High'
  capitalInvestment: 'Low' | 'Medium' | 'High'
  capitalNote?: string
  description: string
  steps?: string[]
  sections?: CraftSection[]
  notes?: string
  links: { label: string; url: string }[]
}

const CRAFTS: ProfitCraft[] = [
  {
    id: 'split-bases',
    name: 'Splitting High Quality Bases',
    timing: 'Week 1+',
    difficulty: 'Low',
    timeInvestment: 'Low',
    capitalInvestment: 'Medium',
    description:
      'Buy ilvl 84 bases, recombinate 50/50 with an ilvl 86 base to push item level up, then triple split for profit. ES bases and necrotic armours have the best margins; ilvl 84 boots with high quality are the easiest to live search snipe.',
    steps: [
      'Live search snipe ilvl 84 gloves, helmets, or body armours with high quality (boots easiest)',
      'Recombinate 50/50 with an ilvl 86 rare base to get an ilvl 86',
      'Triple split the resulting base',
      'List the split bases',
    ],
    links: [],
  },
  {
    id: 'cloak-of-flame',
    name: 'Cloak of Flame',
    difficulty: 'Low',
    timeInvestment: 'Low',
    capitalInvestment: 'Low',
    description: 'Two strategies depending on whether you target non-corrupted or corrupted Cloaks.',
    sections: [
      {
        title: 'Option 1 — Non-corrupt (Week 1–2)',
        steps: [
          'Find Cloak of Flame with fire res = 75',
          '6-socket with bench',
          'Black Morrigan beast craft to 6-link',
          'Sell',
        ],
      },
      {
        title: 'Option 2 — Corrupted (Week 1+)',
        steps: [
          'Find Cloak of Flame with fire res ≥ 68 and "Reduced critical strike damage taken" corruption',
          'Tainted jeweller + tainted fusing to socket/link',
          'Bench to 4s or 4L if necessary',
          'Sell',
        ],
      },
    ],
    links: [],
  },
  {
    id: 'fire-cluster-jewels',
    name: 'Fire Cluster Jewels',
    timing: 'Day 1–3',
    difficulty: 'Low',
    timeInvestment: 'Low',
    capitalInvestment: 'Medium',
    capitalNote: 'Everyone is poor Day 1–3, so even medium is relative',
    description:
      'Buy 8-passive ilvl 50–67 fire cluster jewels early league while RF demand is high, then sell Day 4–5+ once prices skyrocket to divines. Only viable if RF is not nerfed going into the league.',
    steps: [
      'Buy 8-passive ilvl 50–67 fire cluster jewels Day 1–3',
      'Hold until Day 4–5+ when prices skyrocket',
      'Sell',
    ],
    links: [],
  },
  {
    id: 'cord-belts',
    name: 'Recombing Cord Belts',
    timing: 'Week 1',
    difficulty: 'Low',
    timeInvestment: 'Low',
    capitalInvestment: 'Low',
    description:
      'Experimental — may be less effective if the strategy becomes widely known. Buy low ilvl cord belts and recombinate with ilvl 86 rares, then split successes.',
    steps: [
      'Buy < ilvl 82–83 cord belts',
      'Buy a load of ilvl 86 rare belts',
      'Scour all and transmute (only recombine if dust cost is reasonable)',
      'Recombinate (50% chance)',
      'On success: use fractured fossil or single split beast to duplicate the item',
      'List — no more than 4 at once to avoid crashing the market',
    ],
    links: [],
  },
]

const BADGE_COLOR: Record<string, string> = {
  Low: 'badge-low',
  Medium: 'badge-medium',
  High: 'badge-high',
}

export default function GuidePage() {
  const [activeId, setActiveId] = useState(CRAFTS[0].id)
  const active = CRAFTS.find(c => c.id === activeId)!

  return (
    <div className="guide-page">
      <h1>Profit Craft Guides</h1>
      <p className="guide-subtitle">
        Quick references for currency-making strategies. More detail coming soon.
      </p>

      <div className="guide-layout">
        <nav className="craft-tabs">
          {CRAFTS.map(craft => (
            <button
              key={craft.id}
              className={`craft-tab ${craft.id === activeId ? 'active' : ''}`}
              onClick={() => setActiveId(craft.id)}
            >
              {craft.name}
              {craft.timing && <span className="tab-timing">{craft.timing}</span>}
            </button>
          ))}
        </nav>

        <div className="craft-panel">
          <div className="craft-header">
            <h2>{active.name}</h2>
            <div className="craft-badges">
              {active.timing && (
                <span className="badge badge-timing">{active.timing}</span>
              )}
              <span className={`badge ${BADGE_COLOR[active.difficulty]}`}>
                Difficulty: {active.difficulty}
              </span>
              <span className={`badge ${BADGE_COLOR[active.timeInvestment]}`}>
                Time: {active.timeInvestment}
              </span>
              <span
                className={`badge ${BADGE_COLOR[active.capitalInvestment]}`}
                title={active.capitalNote}
              >
                Capital: {active.capitalInvestment}
                {active.capitalNote && ' *'}
              </span>
            </div>
          </div>

          {active.capitalNote && (
            <p className="craft-note-inline">* {active.capitalNote}</p>
          )}

          <p className="craft-description">{active.description}</p>

          {active.sections ? (
            active.sections.map(section => (
              <div key={section.title} className="craft-section">
                <h3>{section.title}</h3>
                <ol className="craft-steps">
                  {section.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            ))
          ) : (
            <>
              <h3>Steps</h3>
              <ol className="craft-steps">
                {active.steps?.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </>
          )}

          {active.notes && <p className="craft-notes">{active.notes}</p>}

          {active.links.length > 0 && (
            <>
              <h3>Resources</h3>
              <ul className="craft-links">
                {active.links.map(link => (
                  <li key={link.url}>
                    <a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
