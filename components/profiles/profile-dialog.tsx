'use client'

import { type ReactElement, useState } from 'react'
import { createProfile, updateProfile } from '@/actions/profiles'
import {
  ProfileForm,
  type ProfileValues,
  type SectionOption,
} from '@/components/profiles/profile-form'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

/** Admin: create (no `profile`) or edit someone's profile. `trigger` opens it. */
export function ProfileDialog({
  profile,
  sections,
  trigger,
}: {
  profile?: ProfileValues & { id: string }
  sections: SectionOption[]
  trigger: ReactElement
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{profile ? 'Edit profile' : 'Create profile'}</DialogTitle>
        </DialogHeader>
        <ProfileForm
          inDialog
          profile={profile}
          sections={sections}
          action={profile ? (values) => updateProfile(profile.id, values) : createProfile}
          onSaved={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
