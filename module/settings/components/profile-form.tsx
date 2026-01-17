"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { getUserProfile, updateUserProfile } from "@/module/settings/actions";

export function ProfileForm() {
    const queryClient = useQueryClient();
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")

    const { data: profile, isLoading } = useQuery({
        queryKey: ["user-profile"],
        queryFn: async () => await getUserProfile(),
        staleTime: 1000 * 60 * 5,  // 5 minutes
        refetchOnWindowFocus: false
    })

    useEffect(() => {
        if (profile) {
            setName(profile.name || "")
            setEmail(profile.email || "")
        }
    },[profile])

    const updateMutation = useMutation({
        mutationFn: async (data: { name?: string, email?: string }) => await updateUserProfile(data.name, data.email),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["user-profile"] })
            toast.success("Profile updated")
        },
        onError: (error) => {
            toast.error("Error updating profile")
            console.log("Error updating profile", error)
        }
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        updateMutation.mutate({ name, email })
    }

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Profile Settings</CardTitle>
                    <CardDescription>Update your profile information</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="animate-pulse space-y-4">
                        <div className="h-10 bg-muted rounded"></div>
                        <div className="h-10 bg-muted rounded"></div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Profile Settings</CardTitle>
                <CardDescription>Update your profile information</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="name"
                            placeholder="John Doe"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={updateMutation.isPending}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="email"
                            placeholder="johndoe@example.com"
                            value={email}
                            onChange={(e) => setName(e.target.value)}
                            disabled={updateMutation.isPending}
                        />
                    </div>
                    <Button
                        type="submit"
                        disabled={updateMutation.isPending}
                        >
                        {updateMutation.isPending ? "Updating..." : "Update"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}