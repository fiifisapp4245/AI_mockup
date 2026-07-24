import Image from "next/image"

import { ThemeToggle } from "@/components/theme-toggle"
import { MainNav } from "@/components/dashboard/main-nav"

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-svh">
      <div className="fixed inset-0 -z-10 hidden dark:block">
        <Image
          src="/backgrounds/realta-network.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-background/75" />
      </div>

      <div className="flex min-h-svh flex-col">
        <header className="flex items-center justify-between border-b bg-background/80 px-6 py-4 backdrop-blur-sm">
          <h1 className="text-lg font-semibold">Realta 3D Printing Dashboard</h1>
          <ThemeToggle />
        </header>
        <div className="border-b bg-background/80 backdrop-blur-sm">
          <MainNav />
        </div>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
