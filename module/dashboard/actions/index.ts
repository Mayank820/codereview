"use server"

import { fetechUserContribution, getGithubAccessToken } from "@/module/github/lib/github";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Octokit } from "octokit";
import prisma from "@/lib/db";


export async function getContributionStats() {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        })
        if (!session?.user) {
            throw new Error("User not authenticated");
        }

        const token = await getGithubAccessToken();

        const octokit = new Octokit({
            auth: token,
        })

        const { data: user } = await octokit.rest.users.getAuthenticated();

        const userName = user.login

        const calendar = await fetechUserContribution(token, userName)

        if (!calendar) {
            return null
        }

        const contributions = calendar.weeks.flatMap((week: any) => week.contributionDays.map((day: any) => ({
            date: day.date,
            count: day.contributionCount,
            level: Math.min(4, Math.floor(day.contributionCount / 3))  // convert to 0-4 scale
        })))

        return {
            contributions,
            totalContributions: calendar.totoalContributions
        }

    } catch (error) {
        console.log("Error fetching contribution stats", error);
        return null
    }
}

export async function getDashboardStats() {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        })

        if (!session) {
            throw new Error("User not authenticated");
        }

        const token = await getGithubAccessToken();

        const octokit = new Octokit({
            auth: token,
        })

        // Get Users github userName 
        const { data: user } = await octokit.rest.users.getAuthenticated();

        // TODO: fetch total connected repo from db
        // const totalRepo = await prisma.repository.findMany({
        //     where: {
        //         userId: session.user.id
        //     }
        // })
        const totalRepos = 30

        const calendar = await fetechUserContribution(token, user.login)
        const totalCommits = calendar?.totoalContributions || 0

        const { data: prs } = await octokit.rest.search.issuesAndPullRequests({
            q: `author:${user.login} is:pr`,
            per_page: 1
        })

        const totalPRs = prs.total_count

        // TODO: count total ai review from database
        const totalReview = 44

        return { totalRepos, totalCommits, totalPRs, totalReview }

    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        return { totalRepos: 0, totalCommits: 0, totalPRs: 0, totalReview: 0 }
    }
}

export async function getMonthlyActivity() {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        })

        if (!session) {
            throw new Error("User not authenticated");
        }

        const token = await getGithubAccessToken();

        const octokit = new Octokit({
            auth: token,
        })

        const { data: user } = await octokit.rest.users.getAuthenticated();

        const calendar = await fetechUserContribution(token, user.login)

        if (!calendar) {
            return []
        }

        const monthlyData: {
            [key: string]: { commits: number, prs: number, review: number }
        } = {};

        const monthNames = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
        ];

        // initialize last 6 months only from now
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const month = monthNames[date.getMonth()];
            monthlyData[month] = { commits: 0, prs: 0, review: 0 };
        }

        calendar.weeks.forEach((week: any) => {
            week.contributionDays.forEach((day: any) => {
                const date = new Date(day.date);
                const monthKey = monthNames[date.getMonth()];
                if (monthlyData[monthKey]) {
                    monthlyData[monthKey].commits += day.contributionCount;
                }
            })
        })

        // fetch review from database for last 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6); // Set to 6 months ago

        // TODO: review's real data
        const generateSampleReview = () => {
            const sampleReview = []
            const now = new Date()

            // Generate random review over the past 6 months
            const randomDaysAgo = Math.floor(Math.random() * 30) + 1; // Random days ago between 1 and 30
            const reviewDate = new Date(now)
            reviewDate.setDate(reviewDate.getDate() - randomDaysAgo)

            sampleReview.push({
                createdAt: reviewDate,
            })

            return sampleReview
        }

        const reviews = generateSampleReview()

        reviews.forEach((review) => {
            const monthKey = monthNames[new Date(review.createdAt).getMonth()];
            if (monthlyData[monthKey]) {
                monthlyData[monthKey].review += 1
            }
        })

        const since = sixMonthsAgo.toISOString().split("T")[0];

        const { data: prs } = await octokit.rest.search.issuesAndPullRequests({
            q: `author:${user.login} type:pr created:>${since}`,
            per_page: 100,
        });

        prs.items.forEach((pr: any) => {
            const date = new Date(pr.created_at)
            const monthKey = monthNames[date.getMonth()];
            if (monthlyData[monthKey]) {
                monthlyData[monthKey].prs += 1
            }
        })

        return Object.keys(monthlyData).map((name) => ({
            name,
            ...monthlyData[name]
        }))

    } catch (error) {
        console.error("Error fetching monthly activity:", error);
        return []
    }
}
