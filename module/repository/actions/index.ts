"use server"
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getRepositories } from "@/module/github/lib/github";
import { github } from "better-auth";

/**
 * This file contains the actions for the repository module.
 * It handles the fetching of repositories from both the database and the github API.
 * It also checks if the user is authenticated before fetching the repositories.
 * The fetchRepositories action fetches the repositories from the github API and the database.
 * It then maps the repositories from the github API to include a boolean indicating if the repository is connected to the user's account in the database.
 */
export const fetchRepositories = async (page: number = 1, perPage: number = 10) => {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        throw new Error("User not authenticated");
    }

    const githubRepos = await getRepositories(page, perPage);

    const dbRepos = await prisma.repository.findMany({
        where: {
            userId: session.user.id
        }
    })

    const connectedRepoId = new Set(dbRepos.map(repo => repo.githubID));

    return githubRepos.data.map((repo: any) => (
        {
            ...repo,
            isConnected: connectedRepoId.has(BigInt(repo.id))
        }
    ))

}