import { updateOwnProfile } from '@/actions/profiles'
import { PageHeader } from '@/components/page-header'
import { ChangePasswordForm } from '@/components/profiles/change-password-form'
import { ProfileForm } from '@/components/profiles/profile-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { roleLabels } from '@/lib/status'

export default async function ProfilePage() {
  const user = await requireUser()
  const sections = await db.section.findMany({
    orderBy: { code: 'asc' },
    select: { id: true, code: true, name: true, isActive: true },
  })

  return (
    <>
      <PageHeader
        title="Your profile"
        description={`${roleLabels[user.role]} · roles and account status are managed by an admin.`}
      />
      <div className="grid max-w-3xl gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>
              How you appear on activities and in the office directory.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm
              action={updateOwnProfile}
              sections={sections}
              profile={{
                firstName: user.firstName,
                middleName: user.middleName ?? null,
                lastName: user.lastName,
                username: user.displayUsername ?? user.username ?? '',
                position: user.position,
                sectionId: user.sectionId,
              }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>You will be signed out everywhere after changing it.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
