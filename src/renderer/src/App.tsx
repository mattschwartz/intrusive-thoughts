import { useEffect } from 'react'

import { GameShell } from './components/GameShell'
import { useGameController } from './hooks/useGameController'
import './styles/text-effects.css'

function App(): React.JSX.Element {
  const controller = useGameController(window.intrusiveThoughts)

  useEffect(() => {
    document.title = window.intrusiveThoughts
      ? 'Intrusive Thoughts — field terminal'
      : 'Intrusive Thoughts — field terminal [offline]'
  }, [])

  return <GameShell controller={controller} />
}

export default App
