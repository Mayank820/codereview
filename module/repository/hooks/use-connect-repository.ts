"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { connectRepository } from "../actions/index";
import { toast } from "sonner";

export const useConnectRepository = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ owner, repo, githubID }: { owner: string, repo: string, githubID: number }) => await connectRepository(owner, repo, githubID),
        onSuccess: () => {
            toast.success("Repository connected")
            queryClient.invalidateQueries({ queryKey: ["repositories"] })
        },
        onError: (error) => {
            toast.error("Error connecting repository")
            console.log("Error connecting repository", error)
        }
    })
}