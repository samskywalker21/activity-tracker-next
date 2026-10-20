// Folds the conflict check's buckets into what the activity form shows. Pure.
import type { ActivityStatus } from '@/generated/prisma/enums'

export type ConflictActivity = {
  id: number
  title: string
  start: Date
  end: Date
  allDay: boolean
  status: ActivityStatus
}
export type ConflictHoliday = { id: number; name: string; start: Date; end: Date }

/** What `checkConflicts` returns. `date` holds every overlapping activity. */
export type Conflicts = {
  date: ConflictActivity[]
  participants: ConflictActivity[]
  lgus: ConflictActivity[]
  facilities: ConflictActivity[]
  holidays: ConflictHoliday[]
}

/** What an overlapping activity shares with the one being checked, besides the time. */
export type SharedKind = 'participants' | 'lgus' | 'facilities'
export const sharedLabels: Record<SharedKind, string> = {
  participants: 'same participants',
  lgus: 'same LGUs',
  facilities: 'same facilities',
}

export type GroupedConflict = ConflictActivity & { shares: SharedKind[] }

export type GroupedConflicts = {
  /** Overlapping activities that also share a participant, LGU or facility. */
  clashes: GroupedConflict[]
  /** Overlapping activities that share nothing else: worth knowing, rarely a problem. */
  sameTime: GroupedConflict[]
  holidays: ConflictHoliday[]
  /** Each activity once, however many buckets it is in, plus the holidays. */
  total: number
}

export function groupConflicts(conflicts: Conflicts): GroupedConflicts {
  const byId = new Map<number, GroupedConflict>()
  for (const row of conflicts.date) byId.set(row.id, { ...row, shares: [] })
  for (const kind of Object.keys(sharedLabels) as SharedKind[]) {
    for (const row of conflicts[kind]) {
      const item = byId.get(row.id) ?? { ...row, shares: [] }
      item.shares.push(kind)
      byId.set(row.id, item)
    }
  }

  const rows = [...byId.values()]
  return {
    clashes: rows.filter((row) => row.shares.length > 0),
    sameTime: rows.filter((row) => row.shares.length === 0),
    holidays: conflicts.holidays,
    total: rows.length + conflicts.holidays.length,
  }
}
