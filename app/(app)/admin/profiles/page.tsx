import { Plus } from 'lucide-react'
import { createLoader, parseAsStringEnum } from 'nuqs/server'
import { FilterBar, SearchFilter, SelectFilter } from '@/components/filter-bar'
import { PageHeader } from '@/components/page-header'
import { PaginationBar } from '@/components/pagination-bar'
import { ProfileDialog } from '@/components/profiles/profile-dialog'
import { ProfilesTable } from '@/components/profiles/profiles-table'
import { Button } from '@/components/ui/button'
import { Role } from '@/generated/prisma/enums'
import { db } from '@/lib/db'
import { loadListParams, PAGE_SIZE, statusItems, statusWhere } from '@/lib/search-params'
import { requireRole } from '@/lib/session'
import { roleLabels } from '@/lib/status'

const loadRoleParam = createLoader({ role: parseAsStringEnum(Object.values(Role)) })

export default async function ProfilesPage({ searchParams }: PageProps<'/admin/profiles'>) {
  const admin = await requireRole(['ADMIN'])
  const { q, status, page, skip, take } = await loadListParams(searchParams)
  const { role } = await loadRoleParam(searchParams)

  const contains = { contains: q, mode: 'insensitive' as const }
  const where = {
    ...statusWhere(status),
    ...(role && { role }),
    ...(q && {
      OR: [
        { firstName: contains },
        { middleName: contains },
        { lastName: contains },
        { username: contains },
        { position: contains },
        { section: { OR: [{ code: contains }, { name: contains }] } },
        { section: { division: { OR: [{ code: contains }, { name: contains }] } } },
      ],
    }),
  }
  const [users, total, sections] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip,
      take,
      include: { section: { select: { code: true } } },
    }),
    db.user.count({ where }),
    db.section.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, isActive: true },
    }),
  ])

  return (
    <>
      <PageHeader
        title="Profiles"
        description="Everyone who can sign in, their role and their section."
        actions={
          <ProfileDialog
            sections={sections}
            trigger={
              <Button>
                <Plus data-icon="inline-start" />
                Create profile
              </Button>
            }
          />
        }
      />
      <FilterBar>
        <SearchFilter placeholder="Search name, username or section" />
        <SelectFilter
          name="role"
          label="Roles"
          items={Object.values(Role).map((r) => ({ value: r, label: roleLabels[r] }))}
        />
        <SelectFilter name="status" label="Statuses" items={statusItems} />
      </FilterBar>
      <ProfilesTable
        currentUserId={admin.id}
        sections={sections}
        rows={users.map((user) => ({
          id: user.id,
          name: user.name,
          firstName: user.firstName,
          middleName: user.middleName,
          lastName: user.lastName,
          username: user.displayUsername ?? user.username ?? '',
          position: user.position,
          sectionId: user.sectionId,
          section: user.section.code,
          role: user.role,
          isActive: user.isActive,
        }))}
      />
      <PaginationBar
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        searchParams={await searchParams}
      />
    </>
  )
}
