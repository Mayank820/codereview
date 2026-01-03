"use client"

import React, { use } from 'react'
import { Github, Settings, BookOpen, Moon, Sun, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarSeparator } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Link from "next/link";
import Logout from "@/module/auth/components/logout";
import { useSession } from '@/lib/auth-client';
import { title } from 'process';

export const AppSidebar = () => {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const pathName = usePathname();
    const { data: session } = useSession()

    useEffect(() => {
        setMounted(true);
    }, []);

    const navigationItem = [
        {
            title: "Dashboard",
            href: "/dashboard",
            icon: BookOpen
        },
        {
            title: "Repository",
            href: "/repository",
            icon: Github
        },
        {
            title: "Reviews",
            href: "/dashboard/reviews",
            icon: BookOpen
        },
        {
            title: "Subscriptions",
            href: "/subscriptions",
            icon: BookOpen
        },
        {
            title: "Settings",
            href: "/settings",
            icon: Settings
        }
    ]

    const isActive = (url: string) => {
        return pathName === url || pathName.startsWith(`${url}/`)
    }

    if (!mounted || !session) return null

    const user = session.user
    const userName = user.name || "GUEST"
    const userEmail = user.email || ""
    const userAvatar = user.image || ""
    const userInitial = userName.split(" ").map((name) => name.charAt(0)).join("").toUpperCase()

    return (
        <Sidebar>
            <SidebarHeader className='border-b'>
                <div className='flex flex-col gap-4 px-2 py-6'>
                    <div className='flex items-center gap-4 px-3 py-4 rounded-lg bg-sidebar-accent/50 hover:bg-sidebar-accent/70 transition-colors'>
                        <div className='flex items-center justify-center w-12 h-12 rounded-lg bg-primary text-primary-foreground shrink-0'>
                            <Github className='w-6 h-6' />
                        </div>
                        <div className='flex-1 min-w-0'>
                            <p className='text-xs font-semibold text-sidebar-accent-foreground tracking-wide'>Connected Account</p>
                            <p className='text-sm font-medium text-sidebar-foreground truncate'>{userName}</p>
                        </div>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent className='px-3 py-6 flex-col gap-1'>
                <div className='mb-2'>
                    <p className='text-xs font-semibold tracking-widest text-sidebar-accent-foreground mb-2 uppercase px-3'>Menu</p>
                </div>
                <SidebarMenu className='gap-2'>
                    {navigationItem.map((item) => (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                                asChild
                                tooltip={item.title}
                                className={`h-11 px-4 rounded-lg transition-all duration-200 ${isActive(item.href)
                                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                                    : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                                    }`}
                            >
                                <Link href={item.href} className="flex items-center gap-3">
                                    <item.icon className="h-5 w-5 shrink-0" />
                                    <span className="text-sm font-medium">{item.title}</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarContent>

            <SidebarFooter className='border-t px-3 py-4'>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <SidebarMenuButton size="lg" className='h-12 px-4 rounded-lg data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-sidebar-accent/50 transition-colors'>
                                    <Avatar className='h-10 w-10 rounded-lg shrink-0'>
                                        <AvatarImage src={userAvatar || "/placeholder.jpg"} alt={userName} />
                                        <AvatarFallback className='rounded-lg'>{userInitial}</AvatarFallback>
                                    </Avatar>
                                    <div className='grid flex-1 text-left text-sm leading-relaxed min-w-0'>
                                        <p className="text-sm font-medium leading-none truncate">{userName}</p>
                                        <p className="text-xs text-sidebar-foreground/70 truncate">{userEmail}</p>
                                    </div>
                                </SidebarMenuButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                className='w-80 rounded-lg'
                                align='end'
                                side='right'
                                sideOffset={8}
                            >
                                <div className='px-2 py-3 border-t border-b'>
                                    <DropdownMenuItem asChild>
                                        <button
                                            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                                            className='w-full px-3 py-3 flex items-center cursor-pointer gap-3 rounded-md hover:bg-sidebar-accent/50 transition-colors text-sm font-medium'
                                        >
                                            {theme === "dark" ? (
                                                <>
                                                    <Sun className='w-5 h-5 mr-3 shrink-0' />
                                                    <span>Light Mode</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Moon className='w-5 h-5 mr-3 shrink-0' />
                                                    <span>Dark Mode</span>
                                                </>
                                            )}
                                        </button>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className='cursor-pointer px-3 py-3 my-1 rounded-md hover:bg-red-500/10 hover:text-red-600 transition-colors font-medium s'>
                                        <LogOut className='w-5 h-5 mr-3 shrink-0' />
                                        <Logout>Sign Out</Logout>
                                    </DropdownMenuItem>
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    )
}

