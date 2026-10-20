import Image from 'next/image'

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-4 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-3">
          <Image
            src="/brand/doh-central.png"
            alt="Department of Health seal"
            width={56}
            height={56}
          />
          <Image
            src="/brand/chd-nm.png"
            alt="Center for Health Development – Northern Mindanao seal"
            width={56}
            height={56}
          />
        </div>
        <div>
          <p className="font-semibold">Activity Tracker</p>
          <p className="text-muted-foreground text-sm">
            DOH Center for Health Development – Northern Mindanao
          </p>
        </div>
      </div>
      {children}
    </main>
  )
}
