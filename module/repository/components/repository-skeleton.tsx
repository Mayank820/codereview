import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function RepositorySkeleton() {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-8 w-48 rounded-full" />
                        <Skeleton className="h-8 w-48 rounded-full" />
                    </div>
                    <Skeleton className="h-8 w-8 max-w-md rounded-full" />

                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-9 w-9" />
                    <Skeleton className="h-9 w-24" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-16" />
                </div>
            </CardContent>
        </Card>
    )
}

export function RepositoryListSkeleton() {
    return (
        <div className="grid gap-4">
            {
                Array.from({ length: 5 }).map((_, index) => (
                    <RepositorySkeleton key={index} />
                ))
            }
        </div>
    )
}