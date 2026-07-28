// import { inngest } from "@/inngest/client";
import prisma from "@/lib/db";
import { inngest } from "../client";
import { getRepofileContents, getPullRequestFiles, postPullRequestReview } from "@/module/github/lib/github";
import { indexCodebase, reteriveContext } from "@/module/ai/lib/rag";
import { generateReview } from "@/module/ai/lib/review";
import { canGenerateReview, incrementReviewCount } from "@/module/payment/lib/usage";

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
                where: { userId }
            })

            if (!account) {
                throw new Error("Account not found");
            }

            // Ensure we have a valid GitHub token
            if (!account.accessToken) {
                throw new Error("GitHub access token missing for account");
            }

            const fetched = await getRepofileContents(account.accessToken, owner, repo)
            if (!fetched || fetched.length === 0) {
                console.warn(`No files returned from GitHub for ${owner}/${repo}`);
                // You may decide to continue with empty array or throw – here we throw to surface the issue
                throw new Error("Fetched repository files are empty – cannot index");
            }
            return fetched;
        })

        await step.run("index-codebase", async () => {
            await indexCodebase(`${owner}/${repo}`, files)
        })

        return { success: true, indexedFiles: files.length }
    },
);

const IGNORE_PATH = /(^|\/)(node_modules|\.next|dist|build|coverage|vendor)\//i;
const IGNORE_FILE = /\.(lock|png|jpe?g|gif|svg|webp|ico|mp4|pdf|woff2?|ttf|eot)$|(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/i;

function isReviewable(filename: string) {
    return !IGNORE_PATH.test(filename) && !IGNORE_FILE.test(filename);
}

function buildDiff(
    files: { filename: string; status: string; additions: number; deletions: number; patch?: string }[]
) {
    return files
        .map((f) => `### ${f.filename} (${f.status} +${f.additions}/-${f.deletions})\n\`\`\`diff\n${f.patch}\n\`\`\``)
        .join("\n\n")
        .slice(0, 40000);
}

export const reviewPullRequest = inngest.createFunction(
    {
        id: "review-pull-request",
        concurrency: { limit: 3 },
        retries: 3,
        // Dedup re-deliveries of the same commit; a new commit (headSha) re-reviews.
        idempotency: "event.data.repositoryId + '-' + event.data.prNumber + '-' + event.data.headSha",
    },
    { event: "pull_request.review_requested" },
    async ({ event, step }) => {
        const { repositoryId, userId, owner, repo, prNumber, prTitle, prUrl } = event.data;

        // Create a pending review row up front so it appears in the UI immediately.
        const review = await step.run("create-review", () =>
            prisma.review.create({
                data: {
                    repositoryId,
                    prNumber,
                    prTitle,
                    prUrl,
                    review: "",
                    status: "pending",
                },
            })
        );

        try {
            const gate = await step.run("check-review-limit", () => canGenerateReview(userId));
            if (!gate.allowed) {
                await step.run("mark-limited", () =>
                    prisma.review.update({
                        where: { id: review.id },
                        data: { status: "failed", review: `⚠️ ${gate.reason}` },
                    })
                );
                return { reviewId: review.id, limited: true };
            }

            const token = await step.run("get-token", async () => {
                const account = await prisma.account.findFirst({
                    where: { userId, providerId: "github" },
                });
                if (!account?.accessToken) {
                    throw new Error("GitHub access token missing for account");
                }
                return account.accessToken;
            });

            const files = await step.run("fetch-diff", () =>
                getPullRequestFiles(token, owner, repo, prNumber)
            );

            const reviewable = files.filter((f) => f.patch && isReviewable(f.filename)).slice(0, 30);

            if (reviewable.length === 0) {
                await step.run("mark-skipped", () =>
                    prisma.review.update({
                        where: { id: review.id },
                        data: { review: "No reviewable code changes in this pull request.", status: "completed" },
                    })
                );
                return { reviewId: review.id, skipped: true };
            }

            const diff = buildDiff(reviewable);

            const reviewText = await step.run("generate-review", async () => {
                const context = await reteriveContext(
                    `${reviewable.map((f) => f.filename).join("\n")}\n\n${diff.slice(0, 4000)}`,
                    `${owner}/${repo}`,
                    5
                );
                return generateReview({ prTitle, diff, context });
            });

            await step.run("save-review", () =>
                prisma.review.update({
                    where: { id: review.id },
                    data: { review: reviewText, status: "completed" },
                })
            );

            await step.run("post-comment", () =>
                postPullRequestReview(token, owner, repo, prNumber, reviewText)
            );

            await step.run("increment-usage", () => incrementReviewCount(userId, repositoryId));

            return { reviewId: review.id, filesReviewed: reviewable.length };
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            await step.run("mark-failed", () =>
                prisma.review.update({
                    where: { id: review.id },
                    data: { status: "failed", review: `Review failed: ${message}` },
                })
            );
            throw error;
        }
    },
);