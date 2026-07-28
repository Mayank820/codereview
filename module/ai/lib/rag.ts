import { pineconeIndex } from "@/lib/pinecone";
import { embed } from "ai";
import { google } from "@ai-sdk/google";

export async function generateEmbedding(text: string) {
    const model = google.embeddingModel("text-embedding-004")

    const result = await embed({
        model,
        value: text
    })

    return result.embedding
}

export async function indexCodebase(repoId: string, files: { path: string, content: string }[]) {
    const vectors = []

    for (const file of files) {
        const content = `File ${file.path}\n\n${file.content}`
        const truncatedContent = content.slice(0, 10000)

        try {
            const embedding = await generateEmbedding(truncatedContent)
            vectors.push({
                id: `${repoId}-${file.path.replace(/\//g, '_')}`,
                values: embedding,
                metadata: {
                    path: file.path,
                    repoId,
                    content: truncatedContent
                }
            })
        } catch (error) {
            console.error("Error generating embedding for file", file.path, error)
        }
    }

    if (vectors.length > 0) {
        const batchSize = 100
        for (let i = 0; i < vectors.length; i += batchSize) {
            const batch = vectors.slice(i, i + batchSize)
            await pineconeIndex.upsert(batch)
        }
    }

    console.log("Indexing completed")

}

export async function reteriveContext(query: string, repoId: string, topK: number = 5) {
    const embedding = await generateEmbedding(query)
    const results = await pineconeIndex.query({
        vector: embedding,
        topK,
        filter: {
            repoId
        },
        includeMetadata: true
    })

    return results.matches.map(match => match.metadata?.content as string).filter(Boolean)
}
