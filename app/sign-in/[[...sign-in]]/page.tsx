import { SignIn } from "@clerk/nextjs"
import Link from "next/link"

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-6 bg-white shadow-md rounded-lg">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Sign in to Lumino Admin</h2>
          <p className="mt-2 text-sm text-gray-600">
            Access the admin dashboard and invitation manager
          </p>
        </div>

        <SignIn
          appearance={{
            elements: {
              formButtonPrimary:
                "bg-blue-600 hover:bg-blue-700 text-white text-sm normal-case rounded-md px-4 py-2",
            },
          }}
          routing="path"
          afterSignIn="/invite"
        />

        <div className="text-center mt-4">
          <p className="text-sm text-gray-600">
            Don&apos;t have an account?{" "}
            <Link
              href="/sign-up"
              className="font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              Create one here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
