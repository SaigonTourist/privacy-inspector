import type { DetectedTracker } from "../../types/tracker"
import { TrackerCard } from "./TrackerCard"

interface Props {
  trackers: DetectedTracker[]
}

export function TrackerList({ trackers }: Props) {
  return (
    <div>
      {trackers.map((tracker) => (
        <TrackerCard key={`${tracker.company}::${tracker.domain}`} tracker={tracker} />
      ))}
    </div>
  )
}
