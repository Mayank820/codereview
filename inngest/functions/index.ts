// import { inngest } from "@/inngest/client";
import prisma from "@/lib/db";
import { inngest } from "../client";
import { getRepofileContents } from "@/module/github/lib/github";

export const helloWorld = inngest.createFunction(
    { id: "hello-world" },
    { event: "test/hello.world" },
    async ({ event, step }) => {
        await step.sleep("wait-a-moment", "1s");
        return { message: `Hello ${event.data.email}!` };
    },
);

export const indexRepository = inngest.createFunction(
    { id: "index-repository" },
    { event: "repository.connected" },
    async ({ event, step }) => {
        const { owner, repo, githubID, userId } = event.data;

        // fetch all files in the repository
        const files = await step.run("fetch-files", async () => {
            const account = await prisma.account.findFirst({
                where: {
                    userId: userId
                }
            })

            if (!account) {
                throw new Error("Account not found");
            }

            const files = await getRepofileContents(account.accessToken!, owner, repo)
            return files
        })

        await step.run("index-codebase", async () => {
            // await indexCodebase
        })

        await step.sleep("wait-a-moment", "1s");
        return { message: `Hello ${event.data.email}!` };
    },
);