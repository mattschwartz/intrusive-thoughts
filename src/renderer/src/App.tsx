import { useEffect } from 'react'

import { GameShell } from './components/GameShell'
import { DeveloperInspector } from './components/DeveloperInspector'
import { useDeveloperInspector } from './hooks/useDeveloperInspector'
import { useGameController } from './hooks/useGameController'
import './styles/developer.css'
import './styles/text-effects.css'

function App(): React.JSX.Element {
  const controller = useGameController(window.intrusiveThoughts)
  const developer = useDeveloperInspector(
    window.intrusiveThoughts,
    controller.state.run?.runId,
    controller.loadReplay
  )

  useEffect(() => {
    document.title = window.intrusiveThoughts
      ? 'Intrusive Thoughts — field terminal'
      : 'Intrusive Thoughts — field terminal [offline]'
  }, [])

  return (
    <>
      <GameShell
        controller={controller}
        developmentEnabled={import.meta.env.DEV}
        onToggleDeveloper={developer.toggle}
      />
      <DeveloperInspector model={developer} game={controller} />
    </>
  )
}

export default App
