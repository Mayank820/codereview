import type React from 'react'
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { requireAuth } from '@/module/auth/utils/auth-util';

const DashBoardLayout = async (
    { children }: { children: React.ReactNode }
) => {
    await requireAuth()
    return (
        <div>
            <SidebarProvider>
                <AppSidebar />
                <SidebarInset>
                    <header className='flex h-16 items-center gap-2 px-4 shrink-0 border-b '>
                        <SidebarTrigger className='-ml-1' />
                        <Separator orientation='vertical' className='mx-2 h-4' />
                        <h1 className='text-xl font-semibold text-foreground'>Dashboard</h1>
                    </header>
                    <main className='flex-1 overflow-auto p-4 md:p-6'>
                        {children}
                    </main>
                </SidebarInset>
            </SidebarProvider>
        </div>
    )
}

export default DashBoardLayout