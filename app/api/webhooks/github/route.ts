import { NextResponse, NextRequest } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()  // this will come from github
        const event = request.headers.get('X-GitHub-Event')

        if (event == "ping") {
            return NextResponse.json({ message: "pong" }, { status: 200 })
        }

        return NextResponse.json({ message: "Event Processes" }, { status: 200 })
    } catch (error) {
        console.error("Error processing GitHub webhook:", error);
        return NextResponse.json({ message: "Error processing GitHub webhook" }, { status: 500 })
    }
}