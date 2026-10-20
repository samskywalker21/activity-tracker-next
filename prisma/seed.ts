// `pnpm db:seed` — reference data for a fresh database: divisions, sections, an admin
// (`admin` / `admin`), LGUs, participants and facilities. Each step skips a table that already
// has rows, so it is safe to re-run.
import 'dotenv/config'
import { auth, placeholderEmail } from '@/lib/auth'
import { db } from '@/lib/db'
import { lgus } from './data/lgus'

const provinces: Record<string, string> = {
  '101300000': 'Bukidnon',
  '101800000': 'Camiguin',
  '103500000': 'Lanao Del Norte',
  '104200000': 'Misamis Occidental',
  '104300000': 'Misamis Oriental',
}

const divisions = [
  { code: 'ORD', name: 'Office of the Regional/Assistant Regional Director' },
  { code: 'MSD', name: 'Management Support Division' },
  { code: 'LHSD', name: 'Local Health Support Division' },
  { code: 'RLED', name: 'Regulations, Licensing and Enforcement Division' },
  { code: 'PCDO', name: 'Provincial/City DOH Office' },
  { code: 'OTH', name: 'Others' },
]

// [code, name, division code]
const sections = [
  ['ORD', 'Office of the Regional Director', 'ORD'],
  ['OARD', 'Office of the Assistant Regional Director', 'ORD'],
  ['ICTU', 'Information and Communication Technology Unit', 'ORD'],
  ['HFDU', 'Health Facility Development Unit', 'ORD'],
  ['Infra', 'Infra', 'ORD'],
  ['RESDRU', 'Research, Epidemiology, Surveillance, and Disaster Response Unit', 'ORD'],
  ['CMU', 'Communication Management Unit', 'ORD'],
  ['HEPU', 'Health Education and Promotions Unit', 'ORD'],
  ['LEGAL', 'Legal Unit', 'ORD'],
  ['PACD', 'Public Assistance and Complaints Desk', 'ORD'],
  ['CAO', 'Office of the Chief Administrative Officer', 'MSD'],
  ['PROC', 'Procurement Unit', 'MSD'],
  ['PSU', 'Planning and Statistics Unit', 'MSD'],
  ['HRDU', 'Human Resource Development Unit', 'MSD'],
  ['CASH', 'Cashier Section', 'MSD'],
  ['BDGT', 'Budget Section', 'MSD'],
  ['ACCGT', 'Accounting Section', 'MSD'],
  ['PS', 'Personnel Section', 'MSD'],
  ['REC', 'Records Section', 'MSD'],
  ['SPPLY', 'Supply Section', 'MSD'],
  ['GSTS', 'General Services/Transport Section', 'MSD'],
  ['LHSD', 'Office of the Local Health Support Division Chief', 'LHSD'],
  ['FHC', 'Family Health Cluster', 'LHSD'],
  ['LHSDC', 'Local Health Systems Development Cluster', 'LHSD'],
  ['NCDC', 'Non-Communicable Diseases Cluster', 'LHSD'],
  ['IDC', 'Infectious Diseases Cluster', 'LHSD'],
  ['EOH', 'Environmental and Occupational Health Cluster', 'LHSD'],
  ['DMU', 'Development Management Unit', 'LHSD'],
  ['RLED', 'Regulations, Licensing, and Enforcement Division', 'RLED'],
  ['PBUK', 'PDOHO Bukidnon', 'PCDO'],
  ['PCAM', 'PDOHO Camiguin', 'PCDO'],
  ['PLDN', 'PDOHO Lanao del Norte', 'PCDO'],
  ['PMOC', 'PDOHO Misamis Occidental', 'PCDO'],
  ['PMOR', 'PDOHO Misamis Oriental', 'PCDO'],
  ['CCDO', 'CDOHO Cagayan de Oro', 'PCDO'],
  ['CILG', 'CDOHO Iligan', 'PCDO'],
  ['RBC', 'Regional Blood Center', 'OTH'],
  ['WL', 'Water Laboratory', 'OTH'],
  ['TBRC', 'TB/Covid Laboratory', 'OTH'],
  ['PMNP', 'Philippine Multi-Sectorial Nutrition Project', 'OTH'],
] as const

// No "Others" row: the free-text `otherParticipants` field covers it.
const participants = [
  { name: 'Development Management Officers (DMO)', isInternal: true },
  { name: 'Nurse Deployment Program (NDP)', isInternal: true },
  { name: 'DOH Employees', isInternal: true },
  { name: 'Pharmacist Deployment Program (PDP)', isInternal: true },
  { name: 'Mid-wives', isInternal: false },
  { name: 'Barangay Health Workers (BHW)', isInternal: false },
  { name: 'Municipal Health Officers (MHO)', isInternal: false },
  { name: 'Provincial Health Officers (PHO)', isInternal: false },
]

const facilities = [
  'Hospital (Level 1)',
  'Hospital (Level 2)',
  'Hospital (Level 3)',
  'Infirmary',
  'DOH Retained Hospitals',
  'Ambulance Service Provider',
  'Ambulatory Surgical Clinic',
  'Animal Bite Treatment Center',
  'Bagong Urgent Care and Ambulatory Service',
  'Barangay Health Station',
  'Birthing Home',
  'Blood Service Facility',
  'Cancer Treatment Facility',
  'Center for Health Development',
  'Central Office',
  'City Health Office',
  'Clinical Laboratory for Molecular Pathology',
  'COVID-19 Testing Laboratory',
  'Dental Laboratory',
  'Detention Facility Clinic',
  'Dialysis Clinic',
  'Drug Abuse Treatment and Rehabilitation Centers',
  'Drug Testing Laboratory',
  'Kidney Transplant Facility',
  'Laboratory for Drinking Water Analysis',
  'Medical Facility for Overseas Workers & Seafarers',
  'Medical Outpatient Clinic',
  'Municipal Health Office',
  'Newborn Screening Center',
  'Provincial Health Office',
  'Psychiatric Care Facility',
  'Radiologic Facility',
  'Research and Teaching Laboratory',
  'Rural Health Unit',
  'School Clinic',
  'Social Hygiene Clinic',
  'Special Clinical Laboratory',
  'Stem Cell Treatment Clinics',
]

async function seed(name: string, count: () => Promise<number>, insert: () => Promise<unknown>) {
  const existing = await count()
  if (existing > 0) {
    console.log(`skipped ${name}: ${existing} row(s) already present`)
    return
  }
  await insert()
  console.log(`seeded  ${name}: ${await count()} rows`)
}

async function main() {
  await seed(
    'divisions',
    () => db.division.count(),
    () => db.division.createMany({ data: divisions })
  )

  await seed(
    'sections',
    () => db.section.count(),
    async () => {
      const divisionIds = new Map(
        (await db.division.findMany({ select: { id: true, code: true } })).map((d) => [
          d.code,
          d.id,
        ])
      )
      await db.section.createMany({
        data: sections.map(([code, name, division]) => {
          const divisionId = divisionIds.get(division)
          if (!divisionId) throw new Error(`No division seeded with code ${division}`)
          return { code, name, divisionId }
        }),
      })
    }
  )

  // The admin belongs to ICTU. Created through Better Auth so the password is hashed by the
  // same code that verifies it at sign-in.
  await seed(
    'admin',
    () => db.user.count(),
    async () => {
      const section = await db.section.findUniqueOrThrow({ where: { code: 'ICTU' } })
      const ctx = await auth.$context
      const user = await ctx.internalAdapter.createUser(
        {
          name: 'Winter Kim',
          email: placeholderEmail('admin'),
          username: 'admin',
          displayUsername: 'admin',
          firstName: 'Winter',
          lastName: 'Kim',
          position: 'Administrator',
          sectionId: section.id,
          role: 'ADMIN',
        },
        { method: 'admin' }
      )
      await ctx.internalAdapter.linkAccount({
        userId: user.id,
        providerId: 'credential',
        accountId: user.id,
        password: await ctx.password.hash('admin'),
      })
    }
  )

  await seed(
    'lgus',
    () => db.lgu.count(),
    () =>
      db.lgu.createMany({
        data: lgus.map((lgu) => ({
          id: lgu.id,
          provinceId: Number(lgu.provinceId),
          province: provinces[lgu.provinceId] ?? 'N/A',
          muncity: lgu.name,
        })),
      })
  )

  await seed(
    'participants',
    () => db.participant.count(),
    () => db.participant.createMany({ data: participants })
  )

  await seed(
    'facilities',
    () => db.facility.count(),
    () => db.facility.createMany({ data: facilities.map((name) => ({ name })) })
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
