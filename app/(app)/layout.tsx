import { AppHeader } from '@/components/app-header'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { roleLabels } from '@/lib/status'

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const user = await requireUser()
  const isReviewer = user.role === 'ADMIN' || user.role === 'MANAGER'

  const [section, reviewCount] = await Promise.all([
    user.sectionId ? db.section.findUnique({ where: { id: user.sectionId } }) : null,
    isReviewer ? db.activity.count({ where: { status: 'PENDING' } }) : 0,
  ])
  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()
  const detail = [roleLabels[user.role], section?.code].filter(Boolean).join(' · ')

  return (
    <SidebarProvider>
      <AppSidebar role={user.role} reviewCount={reviewCount} />
      <SidebarInset>
        <AppHeader name={user.name} initials={initials} detail={detail} />
        <main className="flex flex-1 flex-col gap-6 p-4 md:p-7">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
