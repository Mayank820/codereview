import { generateText } from "ai";
import { google } from "@ai-sdk/google";

// Fast/cheap model for reviews; swap to "gemini-2.5-pro" for higher quality.
export const REVIEW_MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `You are a senior software engineer performing a code review on a GitHub pull request.

You are given the PR title, repository context retrieved from a vector database (existing code that establishes the project's conventions), and a unified diff of the changed files.

Review ONLY the changes in the diff. Follow these rules:
- Be high-signal. Prefer a few important findings over many trivial ones.
- Skip nitpicks a linter or formatter already catches.
- For each finding, name the category (Performance, Security, Architecture, Maintainability, Testing, Readability, Naming, Documentation), a severity (Critical, High, Medium, Low), a concrete reason and failure scenario, and a suggested fix (with a short code example when helpful).
- Ground suggestions in the repository's existing conventions when the context shows them.
- If the change looks good, say so briefly instead of inventing problems.

Respond in clean, well-structured GitHub-flavored Markdown. Start with a one-paragraph summary, then group findings by file. Do not wrap the entire response in a code block.`;

export async function generateReview(input: {
    prTitle: string;
    diff: string;
    context: string[];
}): Promise<string> {
    const { prTitle, diff, context } = input;

    const contextBlock = context.length
        ? context.map((c, i) => `--- context snippet ${i + 1} ---\n${c}`).join("\n\n")
        : "No additional repository context was retrieved.";

    const { text } = await generateText({
        model: google(REVIEW_MODEL),
        system: SYSTEM_PROMPT,
        prompt: `PR title: ${prTitle}

Repository context (for conventions and grounding):
${contextBlock}

Unified diff of changed files:
${diff}`,
    });

    return text;
}
