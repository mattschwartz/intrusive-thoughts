function App(): React.JSX.Element {
  const version = window.intrusiveThoughts?.getVersion()
  const bridgeIsPresent = typeof version === 'string'

  document.title = bridgeIsPresent
    ? 'Intrusive Thoughts — behavioral prototype'
    : 'Intrusive Thoughts — behavioral prototype [preload unavailable]'

  return (
    <main className="prototype-shell">
      <section className="status-panel" aria-labelledby="prototype-title">
        <p className="eyebrow">SYSTEM / INITIALIZATION</p>
        <h1 id="prototype-title">
          Intrusive Thoughts <span aria-hidden="true">—</span> behavioral prototype
        </h1>
        <p className="runtime-status">
          The agent runtime is not yet connected.
        </p>
        <div className="bridge-status" role="status">
          <span
            className={`status-light ${bridgeIsPresent ? 'online' : 'offline'}`}
            aria-hidden="true"
          />
          Preload bridge: {bridgeIsPresent ? `present (${version})` : 'unavailable'}
        </div>
      </section>
    </main>
  )
}

export default App
