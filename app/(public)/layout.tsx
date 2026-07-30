/**
 * Public marketplace layout (playbook S076).
 *
 * Wraps every unauthenticated page with the site chrome — Navbar, Footer, and
 * the mobile bottom bar. Pages under `(public)/` render only their own content;
 * the shell lives here so it can never drift page to page. The route group
 * `(public)` is not part of the URL, so this layout applies to `/`, `/search`,
 * `/pricing`, and the rest without changing any path.
 */
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { MobileNavBar } from '@/components/layout/MobileNavBar'
import { Toaster } from '@/components/ui/Toast'
import { ChatbotWidget } from '@/components/chatbot/chatbot-widget'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      {/* Bottom padding on mobile so the fixed nav bar never covers content. */}
      <main className="flex flex-1 flex-col pb-16 md:pb-0">{children}</main>
      <Footer />
      <MobileNavBar />
      {/* One Toaster per shell (Toast.tsx). The storefront gate gauntlet (S083)
          gave the public surfaces their first toasts — the reveal success and
          the legal modal's retry error (copy-public.md §5.12). */}
      <Toaster />
      {/* Lynq (S094). Public surfaces only — dashboards exclude it by placement:
          this layout is the only mount point, so no pathname blocklist exists. */}
      <ChatbotWidget />
    </div>
  )
}
