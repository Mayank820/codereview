// Plan configuration — shared by the server (limit enforcement) and the client
// (pricing/feature display). Pure constants only, safe to import anywhere
// (no server-only imports, so it will not leak Prisma into the client bundle).

export type Tier = "FREE" | "PLUS" | "PRO";

export interface Plan {
    id: Tier;
    name: string;
    /** Polar checkout slug; null for the free plan (no checkout). */
    slug: "plus" | "pro" | null;
    priceInr: number;
    priceUsd: number;
    /** null = unlimited. Counts LIFETIME connections (disconnected repos still count). */
    repoLimit: number | null;
    /** null = unlimited. */
    reviewLimit: number | null;
    features: string[];
}

export const PLANS: Record<Tier, Plan> = {
    FREE: {
        id: "FREE",
        name: "Free",
        slug: null,
        priceInr: 0,
        priceUsd: 0,
        repoLimit: 1,
        reviewLimit: 20,
        features: [
            "1 connected repository",
            "20 pull request reviews",
            "AI-powered code review",
            "Repository indexing",
        ],
    },
    PLUS: {
        id: "PLUS",
        name: "Plus",
        slug: "plus",
        priceInr: 2000,
        priceUsd: 20,
        repoLimit: 5,
        reviewLimit: null,
        features: [
            "Up to 5 connected repositories",
            "Unlimited pull request reviews",
            "AI-powered code review",
            "Priority indexing",
        ],
    },
    PRO: {
        id: "PRO",
        name: "Pro",
        slug: "pro",
        priceInr: 5000,
        priceUsd: 50,
        repoLimit: null,
        reviewLimit: null,
        features: [
            "Unlimited repositories",
            "Unlimited pull request reviews",
            "AI-powered code review",
            "Priority support",
        ],
    },
};

export const TIER_ORDER: Tier[] = ["FREE", "PLUS", "PRO"];
