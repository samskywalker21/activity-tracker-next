'use client'

import { cn } from 'cn'
import { formatDistanceToNowStrict } from 'date-fns'
import { Bell, BellOff, MessageSquare } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  getNotifications,
  getUnreadCount,
  markNotificationsSeen,
  type Notification,
} from '@/actions/notifications'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { statusDotClasses } from '@/lib/status'

type Unread = { count: number; seenAt: Date }

async function fetchUnread() {
  const result = await getUnreadCount()
  return result.ok ? result.data : null
}

/**
 * The header bell. Polls the cheap unread count every minute and when the tab comes back into
 * view; the list loads only when it opens. Opening it marks everything seen, but the list keeps
 * the "new" dots from the moment it opened so they don't vanish while being read.
 */
export function NotificationBell() {
  const [unread, setUnread] = useState<Unread | null>(null)
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<Notification[] | null>(null)
  const [seenAt, setSeenAt] = useState<Date | null>(null)

  useEffect(() => {
    const refresh = () => fetchUnread().then((data) => data && setUnread(data))
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    refresh()
    const timer = setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  async function openBell(next: boolean) {
    setOpen(next)
    if (!next) return
    setSeenAt(unread?.seenAt ?? null)
    const result = await getNotifications()
    setList(result.ok ? result.data : [])
    if (unread?.count) {
      await markNotificationsSeen()
      setUnread(await fetchUnread())
    }
  }

  const count = unread?.count ?? 0

  return (
    <Popover open={open} onOpenChange={openBell}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            className="relative"
            aria-label={count ? `Notifications, ${count} unread` : 'Notifications'}
          />
        }
      >
        <Bell />
        {count > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 font-semibold text-[10px] text-white tabular-nums">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] gap-0 p-0">
        <h2 className="border-b px-4 py-3 font-semibold">Notifications</h2>
        {list === null ? (
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : list.length === 0 ? (
          <p className="flex flex-col items-center gap-1 p-6 text-muted-foreground text-sm">
            <BellOff className="size-6" />
            Nothing yet
          </p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {list.map((item) => (
              <li key={item.key}>
                <Link
                  href={`/activities/${item.activityId}`}
                  onClick={() => setOpen(false)}
                  className="flex gap-3 px-4 py-3 outline-none hover:bg-muted focus-visible:bg-muted"
                >
                  {item.status ? (
                    <span
                      aria-hidden
                      className={cn(
                        'mt-1.5 size-2.5 shrink-0 rounded-full',
                        statusDotClasses[item.status]
                      )}
                    />
                  ) : (
                    <MessageSquare
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    />
                  )}
                  <div className="grid min-w-0 flex-1 gap-0.5 text-sm">
                    <p>
                      <span className="font-medium">{item.actor}</span> {item.verb}{' '}
                      <span className="font-medium">{item.activityTitle}</span>
                    </p>
                    {item.quote && (
                      <p className="line-clamp-2 text-muted-foreground">“{item.quote}”</p>
                    )}
                    <p className="text-muted-foreground text-xs">
                      {formatDistanceToNowStrict(item.createdAt, { addSuffix: true })}
                    </p>
                  </div>
                  {seenAt && item.createdAt > seenAt && (
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary">
                      <span className="sr-only">New</span>
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
