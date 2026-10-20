'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { useMemo } from 'react'
import { setProfileActive } from '@/actions/profiles'
import { ActiveBadge } from '@/components/active-badge'
import { DataTable, type features } from '@/components/data-table'
import { NoResults } from '@/components/no-results'
import { PasswordDialog } from '@/components/profiles/password-dialog'
import { ProfileDialog } from '@/components/profiles/profile-dialog'
import type { ProfileValues, SectionOption } from '@/components/profiles/profile-form'
import { RoleSelect } from '@/components/profiles/role-select'
import { SetActiveButton } from '@/components/set-active-button'
import { Button } from '@/components/ui/button'
import type { Role } from '@/generated/prisma/enums'

export type ProfileRow = ProfileValues & {
  id: string
  name: string
  section: string
  role: Role
  isActive: boolean
}

const columnHelper = createColumnHelper<typeof features, ProfileRow>()

export function ProfilesTable({
  rows,
  sections,
  currentUserId,
}: {
  rows: ProfileRow[]
  sections: SectionOption[]
  currentUserId: string
}) {
  // Built here because the row actions need the section list and who is signed in.
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('name', {
          header: 'Name',
          cell: ({ row: { original: profile } }) => (
            <div className="flex flex-col">
              <span className="font-semibold">{profile.name}</span>
              <span className="text-muted-foreground text-xs">{profile.username}</span>
            </div>
          ),
        }),
        columnHelper.accessor('position', { header: 'Position' }),
        columnHelper.accessor('section', { header: 'Section' }),
        columnHelper.accessor('role', {
          header: 'Role',
          cell: ({ row: { original: profile } }) => (
            <RoleSelect
              userId={profile.id}
              name={profile.name}
              role={profile.role}
              disabled={profile.id === currentUserId}
            />
          ),
        }),
        columnHelper.accessor('isActive', {
          header: 'Status',
          cell: ({ getValue }) => <ActiveBadge isActive={getValue()} />,
        }),
        columnHelper.display({
          id: 'actions',
          header: () => <span className="sr-only">Actions</span>,
          cell: ({ row: { original: profile } }) => (
            <div className="flex justify-end gap-1">
              <ProfileDialog
                profile={profile}
                sections={sections}
                trigger={
                  <Button variant="ghost" size="sm">
                    Edit
                  </Button>
                }
              />
              <PasswordDialog userId={profile.id} name={profile.name} />
              {profile.id !== currentUserId && (
                <SetActiveButton
                  isActive={profile.isActive}
                  name={profile.name}
                  description={
                    profile.isActive
                      ? 'They are signed out at once and cannot sign in until reactivated. Their activities stay.'
                      : 'They will be able to sign in again.'
                  }
                  onConfirm={() => setProfileActive(profile.id, !profile.isActive)}
                />
              )}
            </div>
          ),
        }),
      ]),
    [sections, currentUserId]
  )

  return <DataTable columns={columns} data={rows} empty={<NoResults what="profiles" />} />
}
