"use client"
import React from 'react'
import { Card, CardContent, CardDescription, CardTitle, CardHeader } from "@/components/ui/card";
import { BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Bar, Legend, ResponsiveContainer } from "recharts";
import { GitCommit, GitPullRequest, MessageSquare, GitBranch } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { getDashboardStats, getMonthlyActivity } from "@/module/dashboard/actions";
import ContributionGraph from '@/module/dashboard/components/contribution-graph';
import { Spinner } from '@/components/ui/spinner';

const MainPage = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => await getDashboardStats(),
    refetchOnWindowFocus: false
  })

  const { data: monthlyActivity, isLoading: isLoadingActivity } = useQuery({
    queryKey: ["monthly-activity"],
    queryFn: async () => await getMonthlyActivity(),
    refetchOnWindowFocus: false
  })

  const cardHover =
    "transition-all duration-300 hover:shadow-[0_0_30px_rgba(99,102,241,0.35)] hover:-translate-y-1";


  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl tracking-tight font-bold'>Dashboard</h1>
        <p className='text-muted-foreground'>Overview of coding activity and AI review</p>
      </div>

      <div className='grid gap-4 md:grid-cols-4'>
        {/* total repositories */}
        <Card className={cardHover}>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Total Repositories
            </CardTitle>
            <GitCommit className='text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {isLoading ? "..." : stats?.totalRepos || 0}
            </div>
            <p className='text-xs text-muted-foreground'>Connected Repositories</p>
          </CardContent>
        </Card>

        {/* total commits */}
        <Card className={cardHover}>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Total Commits
            </CardTitle>
            <GitPullRequest className='text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {isLoading ? "..." : (stats?.totalCommits || 0).toLocaleString()}
            </div>
            <p className='text-xs text-muted-foreground'>In this year</p>
          </CardContent>
        </Card>

        {/* total pull requests */}

        <Card className={cardHover}>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Total Pull Requests
            </CardTitle>
            <MessageSquare className='text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {isLoading ? "..." : stats?.totalPRs || 0}
            </div>
            <p className='text-xs text-muted-foreground'>All time</p>
          </CardContent>
        </Card>

        {/* AI reviews */}

        <Card className={cardHover}>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              AI Reviews
            </CardTitle>
            <GitBranch className='text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {isLoading ? "..." : stats?.totalReview || 0}
            </div>
            <p className='text-xs text-muted-foreground'>Generated Reviews</p>
          </CardContent>
        </Card>

      </div>

      {/* Contribution graph */}
      <Card>
        <CardHeader>
          <CardTitle>Contribution Graph</CardTitle>
          <CardDescription>Visualize your coding frequency over the years</CardDescription>
        </CardHeader>
        <CardContent>
          <ContributionGraph />
        </CardContent>
      </Card>

      {/* Activity Overview */}
      <div className='grid gap-4 md:grid-cols-2'>
        <Card className='col-span-2'>
          <CardHeader>
            <CardTitle>Activity Overview</CardTitle>
            <CardDescription>Monthly breackdown of commits, PRs, and review (last 6 months)</CardDescription>
          </CardHeader>

          <CardContent>
            {
              isLoadingActivity ? (
                <div className='h-80 w-full flex items-center justify-center'>
                  <Spinner />
                </div>
              ) : (
                <div className='h-80 w-full'>
                  <ResponsiveContainer width={"100%"} height={"100%"}>
                    <BarChart data={monthlyActivity || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }} itemStyle={{ color: 'var(--forground)' }} />
                      <Legend />
                      <Bar dataKey="commits" name="Commits" stackId="a" fill="#8884d8" radius={[4,4,0,0]} />
                      <Bar dataKey="prs" name="Pull Requests" stackId="a" fill="#82ca9d" radius={[4,4,0,0]} />
                      <Bar dataKey="reviews" name="AI Reviews" stackId="a" fill="#ffc658" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )
            }
          </CardContent>
        </Card>
      </div>

    </div>
  )
}

export default MainPage