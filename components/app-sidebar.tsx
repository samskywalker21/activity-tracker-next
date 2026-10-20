'use client'

import {
  Building2,
  CalendarDays,
  CalendarOff,
  ClipboardCheck,
  FolderOpen,
  Hospital,
  LayoutDashboard,
  List,
  type LucideIcon,
  MapPin,
  Network,
  ScrollText,
  Users,
  UsersRound,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import type { Role } from '@/generated/prisma/enums'

type NavItem = { title: string; href: string; icon: LucideIcon; badge?: number }

export function AppSidebar({ role, reviewCount }: { role: Role; reviewCount: number }) {
  const pathname = usePathname()
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)

  const groups: { label?: string; items: NavItem[] }[] = [
    {
      items: [
        { title: 'Dashboard', href: '/', icon: LayoutDashboard },
        { title: 'Calendar', href: '/calendar', icon: CalendarDays },
        { title: 'All activities', href: '/activities', icon: List },
        { title: 'My activities', href: '/my-activities', icon: FolderOpen },
      ],
    },
  ]
  if (role === 'ADMIN' || role === 'MANAGER') {
    groups.push({
      label: 'Manage',
      items: [
        { title: 'Review', href: '/review', icon: ClipboardCheck, badge: reviewCount },
        { title: 'Participants', href: '/manage/participants', icon: UsersRound },
        { title: 'Facilities', href: '/manage/facilities', icon: Hospital },
        { title: 'Holidays', href: '/manage/holidays', icon: CalendarOff },
      ],
    })
  }
  if (role === 'ADMIN') {
    groups.push({
      label: 'Admin',
      items: [
        { title: 'Profiles', href: '/admin/profiles', icon: Users },
        { title: 'Divisions', href: '/admin/divisions', icon: Building2 },
        { title: 'Sections', href: '/admin/sections', icon: Network },
        { title: 'LGUs', href: '/admin/lgus', icon: MapPin },
        { title: 'Audit log', href: '/admin/audit', icon: ScrollText },
      ],
    })
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-sidebar-border border-b p-4">
        <div className="flex items-center gap-2.5">
          <Image
            src="/brand/doh-central.png"
            alt="Department of Health seal"
            width={34}
            height={34}
          />
          <Image
            src="/brand/chd-nm.png"
            alt="Center for Health Development – Northern Mindanao seal"
            width={34}
            height={34}
          />
          <div className="min-w-0 leading-tight">
            <p className="font-bold text-sidebar-accent-foreground">Activity Tracker</p>
            <p className="truncate text-xs opacity-80">CHD Northern Mindanao</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label ?? 'main'}>
            {group.label && (
              <SidebarGroupLabel className="text-sidebar-foreground/60 uppercase tracking-wider">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive(item.href)}
                      render={<Link href={item.href} />}
                      className="relative h-10 before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:rounded-r before:bg-sidebar-primary before:opacity-0 data-active:font-semibold data-active:before:opacity-100"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                    {item.badge ? (
                      <SidebarMenuBadge className="top-2.5! rounded-full bg-gold font-bold text-gold-foreground peer-hover/menu-button:text-gold-foreground peer-data-active/menu-button:text-gold-foreground">
                        {item.badge}
                      </SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
