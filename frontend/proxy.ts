import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define which routes require authentication
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/settings(.*)',
  '/onboarding(.*)'
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    // If the user is not authenticated and the route is protected, this redirects them to sign-in.
    const authObj = await auth();
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
