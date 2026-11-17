// The badge shelf and "I saw it!" checklist. Everything is saved on this
// device only — there are no accounts.

function Tick({ id, label, found, toggle }) {
  const on = !!found[id]
  return (
    <button className={'tick' + (on ? ' on' : '')} onClick={() => toggle(id)} aria-pressed={on}>
      <span className="box" aria-hidden="true">{on ? '✓' : ''}</span>{label}
    </button>
  )
}

export default function StargazerLog({ found, toggle, badges, planets, constellations }) {
  const earned = badges.filter((b) => b.earned).length
  return (
    <div className="panel pad log">
      <div className="badges">
        {badges.map((b) => (
          <div className={'badgecard' + (b.earned ? ' earned' : '')} key={b.id}>
            <div className="bico" aria-hidden="true">{b.ico}</div>
            <div className="bname">{b.name}</div>
            <div className="bhow">{b.how}</div>
            <div className="bbar" role="img" aria-label={`${b.have} of ${b.goal}`}><span style={{ width: `${(b.have / b.goal) * 100}%` }} /></div>
            <div className="bcount">{b.earned ? 'Earned!' : `${b.have} / ${b.goal}`}</div>
          </div>
        ))}
      </div>
      <p className="logsum">{earned === 0 ? 'Go outside, find something, then tick it off below to earn your first badge.' : `${earned} of ${badges.length} badges earned — keep looking up!`}</p>

      <div className="tickgroup">
        <div className="k">I saw…</div>
        <div className="ticks">
          <Tick id="moon" label="The Moon" found={found} toggle={toggle} />
          <Tick id="iss" label="The Space Station" found={found} toggle={toggle} />
          <Tick id="meteor" label="A shooting star" found={found} toggle={toggle} />
        </div>
      </div>
      <div className="tickgroup">
        <div className="k">Planets</div>
        <div className="ticks">
          {planets.map((p) => <Tick key={p.key} id={'planet:' + p.key} label={p.key} found={found} toggle={toggle} />)}
        </div>
      </div>
      <div className="tickgroup">
        <div className="k">Constellations</div>
        <div className="ticks">
          {constellations.map((c) => <Tick key={c.name} id={'con:' + c.name} label={c.name} found={found} toggle={toggle} />)}
        </div>
      </div>
      <p className="note">Your log is saved on this device only.</p>
    </div>
  )
}
