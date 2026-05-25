import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define which routes require authentication
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/settings(.*)',
  '/onboarding(.*)'
]);

const isAuthRoute = createRouteMatcher(['/login(.*)']);

export default clerkMiddleware(async (auth, req) => {
  const authObj = await auth();

  // If the user is already authenticated and visits the login page, push them to the dashboard
  if (authObj.userId && isAuthRoute(req)) {
    return NextResponse.redirect(new URL('/dashboard/reception', req.url));
  }

  if (isProtectedRoute(req)) {
    // If the user is not authenticated and the route is protected, this redirects them to sign-in.
    if (!authObj.userId) {
      return authObj.redirectToSignIn();
    }
  }
});
export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
