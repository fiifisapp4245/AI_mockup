import Image from "next/image"

import { ThemeToggle } from "@/components/theme-toggle"
import { MainNav } from "@/components/dashboard/main-nav"

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-svh">
      <div className="flex min-h-svh flex-col">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-b bg-background/80 px-6 py-4 backdrop-blur-sm dark:bg-black dark:backdrop-blur-none">
          <Image
            src="/02_RT_LOGO_V2_NO-BACKGROUND_TRANSPARENT-01-e1695126249249-qcn33hj1et36toqhvkqx41yywm61qufsfwo1yojfxs.png"
            alt="Realta"
            width={173}
            height={56}
            priority
            className="h-8 w-auto justify-self-start"
          />
          <h1 className="justify-self-center text-sm font-semibold tracking-widest text-foreground uppercase">
            3D Printing Schedule Optimizer
          </h1>
          <div className="justify-self-end">
            <ThemeToggle />
          </div>
        </header>
        <div className="border-b bg-background/80 backdrop-blur-sm">
          <MainNav />
        </div>
        <main className="flex-1 bg-background p-6">{children}</main>
      </div>
    </div>
  )
}
