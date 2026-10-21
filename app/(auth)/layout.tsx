import { CalendarDays } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <header className="flex items-center justify-between gap-3 border-gold border-b-4 bg-sidebar px-4 py-3 text-sidebar-foreground md:px-10">
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <Image
            src="/brand/doh-central.png"
            alt="Department of Health seal"
            width={44}
            height={44}
            className="size-9 md:size-11"
          />
          <Image
            src="/brand/chd-nm.png"
            alt="Center for Health Development – Northern Mindanao seal"
            width={44}
            height={44}
            className="size-9 md:size-11"
          />
          <div className="ml-1 min-w-0">
            <p className="font-bold text-base text-white">Activity Tracker</p>
            <p className="hidden text-sm sm:block">
              DOH Center for Health Development – Northern Mindanao
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/calendar" />}
          className="size-11 shrink-0 border-sidebar-border bg-transparent text-white hover:bg-sidebar-accent hover:text-white sm:h-10 sm:w-auto dark:bg-transparent"
        >
          <CalendarDays />
          <span className="sr-only sm:not-sr-only">Public calendar</span>
        </Button>
      </header>
      <main className="flex flex-1 justify-center bg-card px-4 py-10 md:py-14">{children}</main>
    </>
  )
}
