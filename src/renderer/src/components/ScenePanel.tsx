import type { PlayerSceneView } from '../../../shared'

export interface ScenePanelProps {
  scene?: PlayerSceneView
}

export function ScenePanel({ scene }: ScenePanelProps): React.JSX.Element {
  if (!scene || scene.details.length === 0) {
    return <p className="empty-record">No observations have been reported here.</p>
  }
  return (
    <ol className="record-list observation-list">
      {scene.details.map((detail, index) => (
        <li key={detail.id}>
          <span className="record-number">{String(index + 1).padStart(2, '0')}</span>
          <div>
            <h3>{detail.label}</h3>
            <p>{detail.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
