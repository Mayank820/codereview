import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import prisma from "@/lib/db";
import { inngest } from "@/inngest/client";

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
    if (!signature) return false;
    const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text(); // must verify against the RAW body
        const event = request.headers.get("x-github-event");
        const deliveryId = request.headers.get("x-github-delivery") ?? "";
        const signature = request.headers.get("x-hub-signature-256");

        if (event === "ping") {
            return NextResponse.json({ message: "pong" }, { status: 200 });
        }

        // We only act on pull_request events for now.
        if (event !== "pull_request") {
            return NextResponse.json({ message: "ignored" }, { status: 200 });
        }

        const payload = JSON.parse(rawBody);

        // Only review meaningful PR actions.
        const action = payload.action as string;
        if (!["opened", "synchronize", "reopened"].includes(action)) {
            return NextResponse.json({ message: "ignored action" }, { status: 200 });
        }

        // Look up the connected repository by its GitHub numeric id.
        const repository = await prisma.repository.findUnique({
            where: { githubID: BigInt(payload.repository.id) },
        });

        if (!repository) {
            return NextResponse.json({ message: "repository not connected" }, { status: 200 });
        }

        // Verify the webhook signature when a secret is configured.
        const secret = process.env.GITHUB_WEBHOOK_SECRET;
        if (secret) {
            if (!verifySignature(rawBody, signature, secret)) {
                return NextResponse.json({ message: "invalid signature" }, { status: 401 });
            }
        } else {
            console.warn("GITHUB_WEBHOOK_SECRET is not set — skipping signature verification (insecure).");
        }

        const pr = payload.pull_request;

        // Fire-and-forget: hand off to the background worker and ack fast.
        await inngest.send({
            name: "pull_request.review_requested",
            data: {
                repositoryId: repository.id,
                userId: repository.userId,
                owner: payload.repository.owner.login,
                repo: payload.repository.name,
                prNumber: pr.number,
                prTitle: pr.title,
                prUrl: pr.html_url,
                headSha: pr.head.sha,
                baseSha: pr.base.sha,
                deliveryId,
            },
        });

        return NextResponse.json({ message: "review queued" }, { status: 202 });
    } catch (error) {
        console.error("Error processing GitHub webhook:", error);
        return NextResponse.json({ message: "Error processing GitHub webhook" }, { status: 500 });
    }
}
