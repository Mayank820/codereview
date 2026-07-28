import prisma from "@/lib/db";
import { PLANS, type Tier } from "./plans";

/**
 * Usage controller. Enforces per-plan limits for repository connections and
 * pull-request reviews against the UserUsage record.
 *
 * Anti-abuse rule: `repositoryCount` counts LIFETIME connections and is never
 * decremented on disconnect — so a user cannot swap repositories to bypass the
 * cap (e.g. connect 5, disconnect 1, then connect a 6th).
 */

function toCounts(value: unknown): Record<string, number> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return value as Record<string, number>;
    }
    return {};
}

export async function getOrCreateUsage(userId: string) {
    const existing = await prisma.userUsage.findUnique({ where: { userId } });
    if (existing) return existing;

    // Backfill the lifetime counter from currently-connected repos on first use.
    const repositoryCount = await prisma.repository.count({ where: { userId } });
    return prisma.userUsage.create({ data: { userId, repositoryCount } });
}

export async function getUserTier(userId: string): Promise<Tier> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionTier: true },
    });
    const tier = (user?.subscriptionTier ?? "FREE") as Tier;
    return tier in PLANS ? tier : "FREE";
}

export async function getUsageSummary(userId: string) {
    const [tier, usageRecord] = await Promise.all([getUserTier(userId), getOrCreateUsage(userId)]);
    const counts = toCounts(usageRecord.reviewCounts);
    const totalReviews = Object.values(counts).reduce((sum, n) => sum + (Number(n) || 0), 0);
    return { tier, repositoryCount: usageRecord.repositoryCount, totalReviews };
}

export async function canConnectRepository(
    userId: string
): Promise<{ allowed: boolean; reason?: string }> {
    const { tier, repositoryCount } = await getUsageSummary(userId);
    const limit = PLANS[tier].repoLimit;
    if (limit === null) return { allowed: true };
    if (repositoryCount >= limit) {
        return {
            allowed: false,
            reason: `You've reached your ${PLANS[tier].name} plan limit of ${limit} repositor${
                limit === 1 ? "y" : "ies"
            } (disconnected repositories still count). Upgrade to connect more.`,
        };
    }
    return { allowed: true };
}

export async function incrementRepositoryCount(userId: string) {
    await getOrCreateUsage(userId);
    await prisma.userUsage.update({
        where: { userId },
        data: { repositoryCount: { increment: 1 } },
    });
}

export async function canGenerateReview(
    userId: string
): Promise<{ allowed: boolean; reason?: string }> {
    const { tier, totalReviews } = await getUsageSummary(userId);
    const limit = PLANS[tier].reviewLimit;
    if (limit === null) return { allowed: true };
    if (totalReviews >= limit) {
        return {
            allowed: false,
            reason: `You've reached your ${PLANS[tier].name} plan limit of ${limit} reviews. Upgrade for unlimited reviews.`,
        };
    }
    return { allowed: true };
}

export async function incrementReviewCount(userId: string, repositoryId: string) {
    const usageRecord = await getOrCreateUsage(userId);
    const counts = toCounts(usageRecord.reviewCounts);
    counts[repositoryId] = (counts[repositoryId] ?? 0) + 1;
    await prisma.userUsage.update({
        where: { userId },
        data: { reviewCounts: counts },
    });
}
