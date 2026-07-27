export interface BodyPanelProps {
  statuses: string[]
}

export function BodyPanel({ statuses }: BodyPanelProps): React.JSX.Element {
  if (statuses.length === 0) {
    return <p className="empty-record">No body report is available.</p>
  }
  return (
    <ul className="record-list body-list">
      {statuses.map((status, index) => {
        const impaired = /unavailable|impaired|unresponsive|error/iu.test(status)
        return (
          <li className={impaired ? 'body-alert' : 'body-nominal'} key={`${index}-${status}`}>
            <span className="body-symbol" aria-hidden="true">
              {impaired ? '!' : '○'}
            </span>
            <span>
              <strong>{impaired ? 'CONFLICT / IMPAIRMENT' : 'NOMINAL REPORT'}</strong>
              {status}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
