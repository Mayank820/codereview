"use server";

import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function getReviews() {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user) {
            throw new Error("User not authenticated");
        }

        const reviews = await prisma.review.findMany({
            where: {
                repository: {
                    userId: session.user.id,
                },
            },
            include: {
                repository: {
                    select: { fullName: true },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return reviews;
    } catch (error) {
        console.error("Error fetching reviews:", error);
        return [];
    }
}
