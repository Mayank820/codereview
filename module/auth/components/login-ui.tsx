"use client"
import { useState } from 'react'
import { signIn } from "@/lib/auth-client";
import { Github } from 'lucide-react';


const LoginUI = () => {

  const [isLoading, setIsLoading] = useState(false)

  const handleGithubLogin = async () => {
    try {
      await signIn.social({
        provider: "github"
      })
    } catch (error) {
      console.log("Login error", error);
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-black via-black to-zinc-900 text-white flex">
      {/* LEFT SECTION */}
      <div className="flex-1 flex flex-col justify-center px-12 py-16">
        <div className="max-w-lg">
          {/* Logo */}
          <div className="mb-16 flex items-center gap-3">
            <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center font-bold">
              C
            </div>
            <span className="text-2xl font-bold">Code Review</span>
          </div>

          {/* Hero Content */}
          <h1 className="text-5xl font-bold mb-6 leading-tight">
            Cut Code Review Time & Bugs in Half
            <span className="block">Instantly</span>
          </h1>

          <p className="text-lg text-gray-400 leading-relaxed">
            Supercharge your team to ship faster with the most advanced AI code review tool.
          </p>
        </div>
      </div>

      {/* RIGHT SECTION */}
      <div className="flex-1 flex flex-col justify-center items-center px-12 py-16">
        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold mb-2">Welcome Back</h2>
            <p className="text-gray-400">
              Login using one of the following options
            </p>
          </div>

          {/* GitHub Login */}
          <button
            onClick={handleGithubLogin}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-white text-black rounded-lg font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-3 mb-8"
          >
            <Github size={20} />
            {isLoading ? "Loading..." : "Login with GitHub"}
          </button>

          {/* Links */}
          <div className="space-y-4 text-center text-sm text-gray-400">
            <div>
              New to CodeRabbit?{" "}
              <a
                href="#"
                className="text-white font-semibold"
              >
                Sign Up
              </a>
            </div>

            <div>
              <a
                href="#"
                className="text-gray-500 hover:text-white transition-colors font-semibold"
              >
                Self-Hosted Services
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM FOOTER */}
      <footer className="absolute bottom-0 w-full py-4 text-center text-sm text-gray-500">
        <div className="flex justify-center gap-6">
          <a
            href="#"
            className="hover:text-white transition-colors"
          >
            Terms of Use
          </a>
          <a
            href="#"
            className="hover:text-white transition-colors"
          >
            Privacy Policy
          </a>
        </div>
      </footer>
    </div>
  );

}

export default LoginUI