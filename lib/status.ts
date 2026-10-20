import type { ActivityStatus, ActivityType, Role } from '@/generated/prisma/enums'

export const statusLabels: Record<ActivityStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  RETURNED: 'Returned',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
}

// Full class names so Tailwind picks them up.
export const statusDotClasses: Record<ActivityStatus, string> = {
  PENDING: 'bg-status-pending',
  APPROVED: 'bg-status-approved',
  RETURNED: 'bg-status-returned',
  REJECTED: 'bg-status-rejected',
  CANCELLED: 'bg-status-cancelled',
}

export const roleLabels: Record<Role, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  STAFF: 'Staff',
}

export const typeLabels: Record<ActivityType, string> = {
  EVENT: 'Event',
  MONITORING: 'Monitoring',
}
