import { signOut } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { requireUser } from '@/lib/session'

// Placeholder shell; the real sidebar and header come with the Phase 3 design.
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const user = await requireUser()

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <span className="font-semibold">Activity Tracker</span>
        <div className="flex items-center gap-3 text-sm">
          <span>
            {user.name} <span className="text-muted-foreground">· {user.role}</span>
          </span>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  )
}
