import type { PlayerInventoryItem } from '../../../shared'

export interface InventoryPanelProps {
  items: PlayerInventoryItem[]
}

export function InventoryPanel({
  items
}: InventoryPanelProps): React.JSX.Element {
  if (items.length === 0) {
    return <p className="empty-record">No carried objects are recorded.</p>
  }
  return (
    <ul className="record-list inventory-list">
      {items.map((item) => (
        <li key={item.id}>
          <span className="inventory-mark" aria-hidden="true">
            ◇
          </span>
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  )
}
