import { Octokit } from "octokit";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { headers } from "next/headers";

/**
 * Retrieves the access token for the user's Github account.              
 * @returns The access token for the user's Github account, if available. Otherwise, null.
 */
export const getGithubAccessToken = async () => {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        throw new Error("User not authenticated");
    }

    const account = await prisma.account.findFirst({
        where: {
            userId: session.user.id,
            providerId: "github"
        }
    })

    if (!account?.accessToken) {
        throw new Error("No github access token found");
    }
    return account.accessToken

};

export async function fetechUserContribution(token: string, userName: string) {
    const octokit = new Octokit({
        auth: token,
    })

    const query = `
    query($userName: String!) {
        user(login: $userName) {
            contributionsCollection {
                contributionCalendar {
                    totoalContributions: totalContributions
                    weeks {
                        contributionDays {
                            contributionCount
                            date
                            color
                        }
                    }
                }
            }
        }
    }
    `

    // interface contributionData {
    //     user: {
    //         contributionsCollection: {
    //             contributionCalendar: {
    //                 totoalContributions: number
    //                 weeks: {
    //                     contributionDays: {
    //                         contributionCount: number
    //                         date: string | Date
    //                         color: string
    //                     }
    //                 }
    //             }
    //         }
    //     }
    // }

    try {
        const response: any = await octokit.graphql(query, {
            userName
        })
        return response.user.contributionsCollection.contributionCalendar
    } catch (error) {
        console.error("Error fecthing user contribution", error);
        return null
    }
}

export const getRepositories = async (page: number = 1, perPage: number = 10) => {
    const token = await getGithubAccessToken();

    const octokit = new Octokit({
        auth: token,
    })

    const data = await octokit.rest.repos.listForAuthenticatedUser({
        sort: "updated",
        direction: "desc",
        visibility: "all",
        per_page: perPage,
        page: page
    })

    return data
}   