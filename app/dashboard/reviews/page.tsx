"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Spinner } from "@/components/ui/spinner";
import { ExternalLink, GitPullRequest, MessageSquare } from "lucide-react";
import { useReviews } from "@/module/review/hooks/use-reviews";
import { formatDistanceToNow } from "date-fns";

const statusVariant = (status: string): "secondary" | "outline" | "destructive" => {
    switch (status) {
        case "completed":
            return "secondary";
        case "failed":
            return "destructive";
        default:
            return "outline";
    }
};

const ReviewsPage = () => {
    const { data: reviews, isLoading, isError } = useReviews();

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Spinner />
            </div>
        );
    }

    if (isError) {
        return <h3 className="text-2xl font-bold tracking-tight">Failed to load reviews</h3>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">AI Reviews</h1>
                <p className="text-muted-foreground">Automated reviews generated on your pull requests</p>
            </div>

            {!reviews || reviews.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                        <MessageSquare className="h-10 w-10 text-muted-foreground" />
                        <CardTitle className="text-lg">No reviews yet</CardTitle>
                        <CardDescription>
                            Connect a repository and open a pull request — reviews will appear here automatically.
                        </CardDescription>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {reviews.map((review) => (
                        <Card key={review.id}>
                            <CardHeader className="flex flex-row items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <GitPullRequest className="h-4 w-4 text-muted-foreground" />
                                        <CardTitle className="text-lg">{review.prTitle}</CardTitle>
                                        <Badge variant={statusVariant(review.status)}>{review.status}</Badge>
                                    </div>
                                    <CardDescription>
                                        {review.repository.fullName} · #{review.prNumber} ·{" "}
                                        {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                                    </CardDescription>
                                </div>
                                <Button asChild variant="secondary" size="sm">
                                    <a href={review.prUrl} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="h-4 w-4" />
                                    </a>
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <Accordion type="single" collapsible>
                                    <AccordionItem value="review" className="border-none">
                                        <AccordionTrigger className="text-sm font-medium">View review</AccordionTrigger>
                                        <AccordionContent>
                                            <div className="whitespace-pre-wrap rounded-md bg-muted/50 p-4 text-sm leading-relaxed">
                                                {review.review || "No content."}
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ReviewsPage;
