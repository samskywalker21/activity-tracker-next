import type { ActivityFormOptions } from '@/components/activities/activity-form'
import { db } from '@/lib/db'

/** The pickers' choices: active rows, plus inactive ones the activity already uses. */
export async function loadFormOptions(
  selected: {
    sectionId?: number
    participantIds?: number[]
    lguIds?: string[]
    facilityIds?: number[]
  } = {}
): Promise<ActivityFormOptions> {
  const activeOr = <T>(ids: T[] = []) => ({ OR: [{ isActive: true }, { id: { in: ids } }] })

  const [sections, participants, lgus, facilities] = await Promise.all([
    db.section.findMany({
      where: activeOr(selected.sectionId ? [selected.sectionId] : []),
      orderBy: { code: 'asc' },
    }),
    db.participant.findMany({ where: activeOr(selected.participantIds), orderBy: { name: 'asc' } }),
    db.lgu.findMany({
      where: activeOr(selected.lguIds),
      orderBy: [{ province: 'asc' }, { muncity: 'asc' }],
    }),
    db.facility.findMany({ where: activeOr(selected.facilityIds), orderBy: { name: 'asc' } }),
  ])

  return {
    sections: sections.map((s) => ({ value: s.id, label: `${s.code} – ${s.name}` })),
    participants: participants.map((p) => ({ value: p.id, label: p.name })),
    lgus: lgus.map((l) => ({ value: l.id, label: `${l.muncity}, ${l.province}` })),
    facilities: facilities.map((f) => ({ value: f.id, label: f.name })),
  }
}
