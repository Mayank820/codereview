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

export const createWebHook = async (owner: string, repo: string) => {
    const token = await getGithubAccessToken();

    const octokit = new Octokit({
        auth: token,
    })

    const webHookUrl = `${process.env.NEXT_PUBLIC_APP_BASE_URL}/api/webhooks/github`

    const { data: hooks } = await octokit.rest.repos.listWebhooks({
        owner,
        repo
    })

    const existingHook = hooks.find(hook => hook.config.url === webHookUrl)

    if (existingHook) {
        return existingHook.id
    }

    const { data } = await octokit.rest.repos.createWebhook({
        owner,
        repo,
        config: {
            url: webHookUrl,
            content_type: "json",
            secret: process.env.GITHUB_WEBHOOK_SECRET
        },
        events: ["pull_request"]
    })
    return data
}

export const deleteWebHook = async (owner: string, repo: string) => {
    const token = await getGithubAccessToken();

    const octokit = new Octokit({
        auth: token,
    })

    const webHookUrl = `${process.env.NEXT_PUBLIC_APP_BASE_URL}/api/webhooks/github`

    try {
        const { data: hooks } = await octokit.rest.repos.listWebhooks({
            owner,
            repo
        })

        const hookToDelete = hooks.find(hook => hook.config.url === webHookUrl)

        if (hookToDelete) {
            await octokit.rest.repos.deleteWebhook({
                owner,
                repo,
                hook_id: hookToDelete.id
            })
            return true
        }

        return false

    } catch (error) {
        console.error("Error deleting webhook", error);
        return false
    }

}

export async function getRepofileContents(
    token: string,
    owner: string,
    repo: string,
    path: string = ""
): Promise<{ path: string, content: string }[]> {
    const octokit = new Octokit({
        auth: token,
    })

    const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path
    })

    if (!Array.isArray(data)) {
        // basic check if it's a file
        if (data.type === "file" && data.content) {
            return [{
                path: data.path,
                content: Buffer.from(data.content, "base64").toString("utf-8")
            }]
        }
        return []
    }

    let files: { path: string, content: string }[] = []

    for (const item of data) {
        if (item.type === "file" && item.content) {
            const { data: fileData } = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: item.path
            })

            if (!Array.isArray(fileData) && fileData.type === "file" && fileData.content) {
                // filtering out the non-code file like (img, svg etc..., also filter out the node_modules folder and text file like pdf, txt etc..., allow all type of code files)
                // but for now we are pushing everything that look like text files.
                if (!item.path.match(/\.(?:md|txt|pdf|jpg|jpeg|png|gif|svg|webp)$/i)) {
                    files.push({
                        path: fileData.path,
                        content: Buffer.from(fileData.content, "base64").toString("utf-8")
                    })
                }
            }
        }

        else if (item.type === "dir") {
            const nestedFiles = await getRepofileContents(token, owner, repo, item.path)
            files = [...files, ...nestedFiles]
        }
    }

    return files
}

export interface ChangedFile {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch?: string;
}

/**
 * Returns the files changed in a pull request, each with its unified diff patch.
 * `patch` is undefined for binary or very large files.
 */
export async function getPullRequestFiles(
    token: string,
    owner: string,
    repo: string,
    prNumber: number
): Promise<ChangedFile[]> {
    const octokit = new Octokit({ auth: token })

    const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100,
    })

    return files.map((f) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch,
    }))
}

/**
 * Posts an AI-generated review as a single PR-level comment (event: COMMENT).
 * Returns the id of the created review.
 */
export async function postPullRequestReview(
    token: string,
    owner: string,
    repo: string,
    prNumber: number,
    body: string
): Promise<number> {
    const octokit = new Octokit({ auth: token })

    const { data } = await octokit.rest.pulls.createReview({
        owner,
        repo,
        pull_number: prNumber,
        event: "COMMENT",
        body,
    })

    return data.id
}