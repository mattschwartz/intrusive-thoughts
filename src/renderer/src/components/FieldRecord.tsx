import { useState } from 'react'

import type { PlayerSceneView } from '../../../shared'
import { BodyPanel } from './BodyPanel'
import { InventoryPanel } from './InventoryPanel'
import { ScenePanel } from './ScenePanel'

type RecordView = 'scene' | 'carried' | 'body'

export interface FieldRecordProps {
  scene?: PlayerSceneView
}

const tabs: ReadonlyArray<{ id: RecordView; label: string }> = [
  { id: 'scene', label: 'Scene' },
  { id: 'carried', label: 'Carried' },
  { id: 'body', label: 'Body' }
]

export function FieldRecord({ scene }: FieldRecordProps): React.JSX.Element {
  const [view, setView] = useState<RecordView>('scene')

  return (
    <aside className="field-record" aria-labelledby="field-record-heading">
      <header className="record-header">
        <div>
          <p className="kicker">FIELD RECORD</p>
          <h2 id="field-record-heading">{scene?.locationLabel ?? 'Unresolved'}</h2>
        </div>
        <span className="record-index" aria-hidden="true">
          {scene?.locationId ?? '—'}
        </span>
      </header>
      <div className="record-tabs" role="tablist" aria-label="Field record views">
        {tabs.map((tab) => (
          <button
            type="button"
            role="tab"
            id={`record-tab-${tab.id}`}
            aria-controls={`record-panel-${tab.id}`}
            aria-selected={view === tab.id}
            tabIndex={view === tab.id ? 0 : -1}
            key={tab.id}
            onClick={() => setView(tab.id)}
            onKeyDown={(event) => {
              const currentIndex = tabs.findIndex((item) => item.id === view)
              const offset =
                event.key === 'ArrowRight'
                  ? 1
                  : event.key === 'ArrowLeft'
                    ? -1
                    : 0
              if (offset) {
                event.preventDefault()
                const next = tabs[(currentIndex + offset + tabs.length) % tabs.length]
                setView(next.id)
                document.getElementById(`record-tab-${next.id}`)?.focus()
              }
            }}
          >
            {tab.label}
            <span className="tab-count">
              {tab.id === 'scene'
                ? scene?.details.length ?? 0
                : tab.id === 'carried'
                  ? scene?.inventory.length ?? 0
                  : scene?.bodyStatus.length ?? 0}
            </span>
          </button>
        ))}
      </div>
      <div
        className="record-panel"
        role="tabpanel"
        id={`record-panel-${view}`}
        aria-labelledby={`record-tab-${view}`}
      >
        {view === 'scene' && <ScenePanel scene={scene} />}
        {view === 'carried' && <InventoryPanel items={scene?.inventory ?? []} />}
        {view === 'body' && <BodyPanel statuses={scene?.bodyStatus ?? []} />}
      </div>
    </aside>
  )
}
