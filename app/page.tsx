import Image from 'next/image'

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="flex items-center gap-4">
        <Image
          src="/brand/doh-central.png"
          alt="Department of Health seal"
          width={64}
          height={64}
        />
        <Image
          src="/brand/chd-nm.png"
          alt="Center for Health Development – Northern Mindanao seal"
          width={64}
          height={64}
        />
      </div>
      <h1 className="font-semibold text-2xl">Activity Tracker</h1>
    </main>
  )
}
