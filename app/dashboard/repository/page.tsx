"use client"

import React, { use } from 'react'
import { Card, CardContent, CardDescription, CardTitle, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ExternalLink, Star, Search } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRepositories } from '@/module/repository/hooks/use-repositories';
import { RepositoryListSkeleton } from '@/module/repository/components/repository-skeleton';
import { useConnectRepository } from '@/module/repository/hooks/use-connect-repository';


interface Repository {
    id: number,
    name: string,
    full_name: string,
    description: string,
    html_url: string,
    stargazers_count: number
    language: string | null
    topics: string[]
    isConnected: boolean
}

const RepositoryPage = () => {
    const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useRepositories()

    const { mutate: connectRepo } = useConnectRepository();

    const [localConnectingId, setLocalConnectingId] = useState<number | null>(null);

    const [searchQuery, setSearchQuery] = useState('');

    const observerTarget = useRef<HTMLDivElement>(null);

    // Check if there are more pages to fetch
    useEffect(() => {
        // Create an IntersectionObserver to detect when the sentinel
        const observer = new IntersectionObserver(entries => {
            // If the sentinel is visible and there are more pages to fetch
            if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
                fetchNextPage()
            }
        },
            {
                // triggers when the sentinel is 10% visible
                threshold: 0.1
            }
        )

        const currentTarget = observerTarget.current;

        if (currentTarget) {
            observer.observe(currentTarget);
        }

        return () => {
            if (currentTarget) {
                observer.unobserve(currentTarget);
            }
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage])

    if (isLoading) {
        return (
            <div className='space-y-4'>
                <div>
                    <h1 className='text-3xl font-bold tracking-tight'>Repositories</h1>
                    <p className='text-muted-foreground'>Manage and view your repositories</p>
                </div>
                <RepositoryListSkeleton />
            </div>
        )
    }

    if (isError) {
        return (
            <div>
                <h3 className='text-3xl font-bold tracking-tight'>Failed to load repositories</h3>
            </div>
        )
    }

    const allRepositories = data?.pages.flatMap(page => page) || [];

    const filteredRepositories = allRepositories.filter((repo: Repository) => (
        repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        repo.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    ))

    const handleConnect = (repo: any) => {
        setLocalConnectingId(repo.id);
        connectRepo({
            owner: repo.full_name.split("/")[0],
            repo: repo.name,
            githubID: repo.id
        },
            {
                onSettled: () => setLocalConnectingId(null)
            })
    }

    return (
        <div className='space-y-4'>
            <div>
                <h1 className='text-3xl font-bold tracking-tight'>Repositories</h1>
                <p className='text-muted-foreground'>Manage and view your repositories</p>
            </div>


            <div className='relative'>
                <Search className='absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground' />
                <Input
                    placeholder='Search repositories...'
                    className='pl-12'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className='grid gap-4'>
                {
                    filteredRepositories.map((repo: any) => (
                        <Card key={repo.id} className='hover:shadow-md transition-shadow'>
                            <CardHeader className='flex items-start justify-between'>
                                <div className='space-x-2 flex-1'>
                                    <div className='flex items-center gap-2'>
                                        <CardTitle className='text-lg'>
                                            {repo.name}
                                        </CardTitle>
                                        <Badge>
                                            {repo.language || "Unknown"}
                                        </Badge>
                                        {repo.isConnected && <Badge variant="secondary">Connected</Badge>}
                                    </div>
                                    <CardDescription>
                                        {repo.description}
                                    </CardDescription>
                                </div>
                                <div className='flex gap-2'>
                                    <Button asChild variant="secondary" size="sm">
                                        <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className='w-4 h-4' />
                                        </a>
                                    </Button>
                                    <Button asChild variant="secondary" size="sm">
                                        <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
                                            <Star className='w-4 h-4' />
                                        </a>
                                    </Button>
                                    <Button
                                        onClick={() => handleConnect(repo)}
                                        disabled={localConnectingId === repo.id || repo.isConnected}
                                        variant={repo.isConnected ? "outline" : "secondary"}
                                    >
                                        {localConnectingId === repo.id ? "Connecting..." : repo.isConnected ? "Connected" : "Connect"}
                                    </Button>
                                </div>
                            </CardHeader>
                        </Card>
                    ))
                }
            </div>

            <div ref={observerTarget} className='py-4'>
                {isFetchingNextPage && <RepositoryListSkeleton />}
                {
                    !hasNextPage && allRepositories.length > 0 && (
                        <p className='text-center text-muted-foreground text-sm'>No more repositories</p>
                    )
                }
            </div>

        </div>
    )
}

export default RepositoryPage