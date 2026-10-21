// `pnpm db:samples` — sample data for trying the app out, on top of `pnpm db:seed`: a manager and
// four staff (password = username) and about thirty activities from October to December 2026,
// with their status history and a few comments. Skipped if the sample users already exist.
// Also the national holidays of those months, each skipped if its day already has a holiday.
// Not audited: like the regular seed, it is set-up data, not something anyone did.
import 'dotenv/config'
import type { ActivityStatus, ActivityType } from '@/generated/prisma/enums'
import { auth, placeholderEmail } from '@/lib/auth'
import { dayBounds, parseDateTime, parseDay } from '@/lib/dates'
import { db } from '@/lib/db'

const people = [
  {
    username: 'mreyes',
    firstName: 'Maria',
    lastName: 'Reyes',
    position: 'Division Chief',
    section: 'LHSD',
    role: 'MANAGER',
  },
  {
    username: 'jdelacruz',
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    position: 'IT Officer',
    section: 'ICTU',
    role: 'STAFF',
  },
  {
    username: 'asantos',
    firstName: 'Ana',
    lastName: 'Santos',
    position: 'Nurse V',
    section: 'FHC',
    role: 'STAFF',
  },
  {
    username: 'rgarcia',
    firstName: 'Ramon',
    lastName: 'Garcia',
    position: 'Epidemiologist',
    section: 'IDC',
    role: 'STAFF',
  },
  {
    username: 'lbautista',
    firstName: 'Liza',
    lastName: 'Bautista',
    position: 'Health Educator',
    section: 'HEPU',
    role: 'STAFF',
  },
] as const

type Username = (typeof people)[number]['username']

type Sample = {
  title: string
  type: ActivityType
  by: Exclude<Username, 'mreyes'>
  venue: string
  /** `yyyy-MM-dd` start day and number of days. */
  day: string
  days?: number
  /** Wall-clock start and end; omitted for all-day activities. */
  time?: [string, string]
  status: ActivityStatus
  /** Why it was returned, rejected or cancelled. */
  note?: string
  virtual?: boolean
}

const samples: Sample[] = [
  // October: mostly done and approved.
  {
    title: 'Orientation on the Health Information System',
    type: 'EVENT',
    by: 'jdelacruz',
    venue: 'CHD-NM Conference Room',
    day: '2026-10-02',
    time: ['08:00', '12:00'],
    status: 'APPROVED',
  },
  {
    title: 'Dengue surveillance validation, Bukidnon',
    type: 'MONITORING',
    by: 'rgarcia',
    venue: 'Provincial Health Office, Malaybalay',
    day: '2026-10-05',
    days: 3,
    status: 'APPROVED',
  },
  {
    title: 'Breastfeeding awareness forum',
    type: 'EVENT',
    by: 'asantos',
    venue: 'Capitol Gymnasium, Oroquieta',
    day: '2026-10-07',
    time: ['09:00', '16:00'],
    status: 'APPROVED',
  },
  {
    title: 'Network cabling of the RHU, Libona',
    type: 'MONITORING',
    by: 'jdelacruz',
    venue: 'Rural Health Unit, Libona',
    day: '2026-10-09',
    time: ['08:00', '17:00'],
    status: 'CANCELLED',
    note: 'The RHU is under renovation until November.',
  },
  {
    title: 'School-based immunization monitoring',
    type: 'MONITORING',
    by: 'asantos',
    venue: 'Iligan City schools',
    day: '2026-10-12',
    days: 2,
    status: 'APPROVED',
  },
  {
    title: 'Healthy lifestyle webinar for LGU workers',
    type: 'EVENT',
    by: 'lbautista',
    venue: 'Zoom',
    day: '2026-10-14',
    time: ['13:30', '16:00'],
    status: 'APPROVED',
    virtual: true,
  },
  {
    title: 'Rabies prevention campaign kick-off',
    type: 'EVENT',
    by: 'rgarcia',
    venue: 'Plaza Divisoria, Cagayan de Oro',
    day: '2026-10-16',
    time: ['07:00', '11:00'],
    status: 'REJECTED',
    note: 'Already covered by the city health office’s own campaign that week.',
  },
  {
    title: 'Data quality check of FHSIS reports',
    type: 'MONITORING',
    by: 'jdelacruz',
    venue: 'CHD-NM Conference Room',
    day: '2026-10-19',
    time: ['08:00', '17:00'],
    status: 'APPROVED',
  },
  {
    title: 'Mental health first aid training',
    type: 'EVENT',
    by: 'lbautista',
    venue: 'Mallberry Suites, Cagayan de Oro',
    day: '2026-10-21',
    days: 3,
    status: 'APPROVED',
  },
  {
    title: 'TB case finding in Camiguin',
    type: 'MONITORING',
    by: 'rgarcia',
    venue: 'Provincial Hospital, Mambajao',
    day: '2026-10-26',
    days: 2,
    status: 'APPROVED',
  },
  {
    title: 'Family planning counseling workshop',
    type: 'EVENT',
    by: 'asantos',
    venue: 'CHD-NM Training Hall',
    day: '2026-10-27',
    time: ['08:00', '17:00'],
    status: 'PENDING',
  },
  {
    title: 'Website content review meeting',
    type: 'EVENT',
    by: 'jdelacruz',
    venue: 'Google Meet',
    day: '2026-10-29',
    time: ['14:00', '15:30'],
    status: 'PENDING',
    virtual: true,
  },

  // November: a mix still in review.
  {
    title: 'Undas health stations, cemeteries of Cagayan de Oro',
    type: 'MONITORING',
    by: 'lbautista',
    venue: 'Various cemeteries, Cagayan de Oro',
    day: '2026-10-31',
    days: 3,
    status: 'APPROVED',
  },
  {
    title: 'Nutrition month follow-up visits',
    type: 'MONITORING',
    by: 'asantos',
    venue: 'Barangay health stations, Lanao del Norte',
    day: '2026-11-04',
    days: 2,
    status: 'RETURNED',
    note: 'Please list the barangays you will visit and attach the itinerary.',
  },
  {
    title: 'Cybersecurity awareness session',
    type: 'EVENT',
    by: 'jdelacruz',
    venue: 'CHD-NM Conference Room',
    day: '2026-11-06',
    time: ['09:00', '11:30'],
    status: 'APPROVED',
  },
  {
    title: 'Measles outbreak response drill',
    type: 'EVENT',
    by: 'rgarcia',
    venue: 'Northern Mindanao Medical Center',
    day: '2026-11-10',
    time: ['08:00', '17:00'],
    status: 'PENDING',
  },
  {
    title: 'Anti-smoking caravan',
    type: 'EVENT',
    by: 'lbautista',
    venue: 'Ozamiz City Plaza',
    day: '2026-11-12',
    time: ['08:00', '15:00'],
    status: 'PENDING',
  },
  {
    title: 'Maternal care facility assessment',
    type: 'MONITORING',
    by: 'asantos',
    venue: 'Birthing homes, Misamis Oriental',
    day: '2026-11-16',
    days: 4,
    status: 'APPROVED',
  },
  {
    title: 'eLearning platform pilot for midwives',
    type: 'EVENT',
    by: 'jdelacruz',
    venue: 'Zoom',
    day: '2026-11-18',
    time: ['13:00', '16:00'],
    status: 'RETURNED',
    note: 'Coordinate the schedule with the Family Health Cluster first.',
    virtual: true,
  },
  {
    title: 'HIV testing and counseling outreach',
    type: 'EVENT',
    by: 'rgarcia',
    venue: 'Social Hygiene Clinic, Iligan',
    day: '2026-11-20',
    time: ['09:00', '16:00'],
    status: 'PENDING',
  },
  {
    title: 'Oral health month school visits',
    type: 'MONITORING',
    by: 'lbautista',
    venue: 'Public schools, Gingoog',
    day: '2026-11-24',
    days: 2,
    status: 'APPROVED',
  },
  {
    title: 'Year-end ICT equipment inventory',
    type: 'MONITORING',
    by: 'jdelacruz',
    venue: 'CHD-NM offices',
    day: '2026-11-26',
    days: 2,
    status: 'PENDING',
  },

  // December: mostly waiting for review.
  {
    title: 'World AIDS Day observance',
    type: 'EVENT',
    by: 'rgarcia',
    venue: 'Limketkai Center, Cagayan de Oro',
    day: '2026-12-01',
    time: ['08:00', '12:00'],
    status: 'APPROVED',
  },
  {
    title: 'Newborn screening program review',
    type: 'EVENT',
    by: 'asantos',
    venue: 'CHD-NM Training Hall',
    day: '2026-12-03',
    time: ['08:30', '16:30'],
    status: 'PENDING',
  },
  {
    title: 'Firecracker injury prevention briefing',
    type: 'EVENT',
    by: 'lbautista',
    venue: 'Microsoft Teams',
    day: '2026-12-07',
    time: ['10:00', '11:30'],
    status: 'PENDING',
    virtual: true,
  },
  {
    title: 'Health facility licensing inspection, Valencia',
    type: 'MONITORING',
    by: 'rgarcia',
    venue: 'Valencia City hospitals',
    day: '2026-12-09',
    days: 2,
    status: 'RETURNED',
    note: 'Add the licensing officer as a participant.',
  },
  {
    title: 'Christmas season health advisory planning',
    type: 'EVENT',
    by: 'lbautista',
    venue: 'CHD-NM Conference Room',
    day: '2026-12-11',
    time: ['13:00', '15:00'],
    status: 'PENDING',
  },
  {
    title: 'Data privacy compliance audit',
    type: 'MONITORING',
    by: 'jdelacruz',
    venue: 'CHD-NM offices',
    day: '2026-12-14',
    days: 3,
    status: 'PENDING',
  },
  {
    title: 'Year-end family health cluster assessment',
    type: 'EVENT',
    by: 'asantos',
    venue: 'Pearlmont Inn, Cagayan de Oro',
    day: '2026-12-16',
    days: 2,
    status: 'PENDING',
  },
  {
    title: 'Holiday season disease surveillance',
    type: 'MONITORING',
    by: 'rgarcia',
    venue: 'Provincial health offices, Region 10',
    day: '2026-12-21',
    days: 5,
    status: 'PENDING',
  },
]

const comments: { title: string; by: Username; body: string }[] = [
  {
    title: 'Nutrition month follow-up visits',
    by: 'asantos',
    body: 'Itinerary is being finalized with the PDOHO.',
  },
  {
    title: 'Measles outbreak response drill',
    by: 'mreyes',
    body: 'Please confirm that NMMC has agreed to the date.',
  },
  {
    title: 'Measles outbreak response drill',
    by: 'rgarcia',
    body: 'Confirmed by their chief of hospital yesterday.',
  },
  {
    title: 'Year-end ICT equipment inventory',
    by: 'mreyes',
    body: 'Include the provincial offices if there is time.',
  },
  {
    title: 'World AIDS Day observance',
    by: 'lbautista',
    body: 'HEPU can help with the IEC materials.',
  },
]

/** Philippine regular and special non-working days, October to December 2026. */
const holidays: [day: string, name: string][] = [
  ['2026-11-01', "All Saints' Day"],
  ['2026-11-30', 'Bonifacio Day'],
  ['2026-12-08', 'Feast of the Immaculate Conception of Mary'],
  ['2026-12-24', 'Christmas Eve'],
  ['2026-12-25', 'Christmas Day'],
  ['2026-12-30', 'Rizal Day'],
  ['2026-12-31', 'Last Day of the Year'],
]

const DAY = 24 * 60 * 60 * 1000
const now = new Date()

/** At most `now`: a sample can't have been filed or decided in the future. */
const notAfterNow = (date: Date, hoursAgo: number) =>
  date < now ? date : new Date(now.getTime() - hoursAgo * 60 * 60 * 1000)

async function main() {
  let added = 0
  for (const [day, name] of holidays) {
    const { start, end } = dayBounds(parseDay(day))
    if (await db.holiday.findFirst({ where: { start } })) continue
    await db.holiday.create({ data: { name, start, end } })
    added++
  }
  console.log(`seeded  holidays: ${added} of ${holidays.length}`)

  if (await db.user.findUnique({ where: { username: 'mreyes' } })) {
    console.log('skipped samples: the sample users already exist')
    return
  }

  const ids = {} as Record<Username, string>
  const names = {} as Record<Username, string>
  for (const person of people) {
    const section = await db.section.findUniqueOrThrow({ where: { code: person.section } })
    const { user } = await auth.api.signUpEmail({
      body: {
        name: `${person.firstName} ${person.lastName}`,
        email: placeholderEmail(person.username),
        username: person.username,
        password: person.username,
        firstName: person.firstName,
        lastName: person.lastName,
        position: person.position,
        sectionId: section.id,
        role: person.role,
      },
    })
    ids[person.username] = user.id
    names[person.username] = user.name
  }

  const [participants, lgus, facilities] = await Promise.all([
    db.participant.findMany({ select: { id: true } }),
    db.lgu.findMany({ select: { id: true } }),
    db.facility.findMany({ select: { id: true } }),
  ])
  // A few of each, picked by position so every run gives the same data.
  const pick = <T>(rows: T[], i: number, n: number) =>
    Array.from({ length: n }, (_, k) => rows[(i * 7 + k * 3) % rows.length])

  for (const [i, sample] of samples.entries()) {
    const creator = ids[sample.by]
    const sectionId = (await db.user.findUniqueOrThrow({ where: { id: creator } })).sectionId
    const lastDay = new Date(parseDay(sample.day).getTime() + ((sample.days ?? 1) - 1) * DAY)
    const { start, end } = sample.time
      ? {
          start: parseDateTime(sample.day, sample.time[0]),
          end: parseDateTime(sample.day, sample.time[1]),
        }
      : dayBounds(parseDay(sample.day), lastDay)

    // Filed two weeks ahead, decided the next day; neither later than now.
    const filedAt = notAfterNow(new Date(start.getTime() - 14 * DAY), 48 + i)
    const decidedAt = notAfterNow(new Date(filedAt.getTime() + DAY), 24 - (i % 20))
    // The creator cancels their own; the manager makes every other decision.
    const decidedBy = sample.status === 'CANCELLED' ? creator : ids.mreyes

    await db.activity.create({
      data: {
        title: sample.title,
        type: sample.type,
        status: sample.status,
        virtual: sample.virtual ?? false,
        allDay: !sample.time,
        start,
        end,
        owner: names[sample.by],
        venue: sample.venue,
        sectionId,
        createdById: creator,
        updatedById: creator,
        createdAt: filedAt,
        participants: { connect: pick(participants, i, 2) },
        lgus: { connect: pick(lgus, i, sample.type === 'MONITORING' ? 3 : 1) },
        facilities: { connect: sample.type === 'MONITORING' ? pick(facilities, i, 2) : [] },
        events: {
          create: [
            { actorId: creator, fromStatus: null, toStatus: 'PENDING', createdAt: filedAt },
            ...(sample.status === 'PENDING'
              ? []
              : [
                  {
                    actorId: decidedBy,
                    fromStatus: 'PENDING' as const,
                    toStatus: sample.status,
                    note: sample.note ?? null,
                    createdAt: decidedAt,
                  },
                ]),
          ],
        },
      },
    })
  }

  for (const comment of comments) {
    const activity = await db.activity.findFirstOrThrow({ where: { title: comment.title } })
    await db.comment.create({
      data: { activityId: activity.id, authorId: ids[comment.by], body: comment.body },
    })
  }

  console.log(`seeded  samples: ${people.length} users, ${samples.length} activities`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
