import { Search } from 'lucide-react'
import { NotificationBell } from '@/components/notification-bell'
import { ThemeToggle } from '@/components/theme-toggle'
import { Input } from '@/components/ui/input'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { UserMenu } from '@/components/user-menu'

export function AppHeader({
  name,
  initials,
  detail,
}: {
  name: string
  initials: string
  detail: string
}) {
  return (
    <header className="sticky top-0 z-10 flex h-15 items-center gap-2 border-b bg-card px-4 md:px-7">
      <SidebarTrigger className="size-10 md:hidden" />
      <search className="w-full max-w-sm">
        <form action="/activities" className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            name="q"
            placeholder="Search activities"
            aria-label="Search activities"
            className="h-10 pl-9"
          />
        </form>
      </search>
      <div className="ml-auto flex items-center gap-1">
        <NotificationBell />
        <ThemeToggle />
        <UserMenu name={name} initials={initials} detail={detail} />
      </div>
    </header>
  )
}
