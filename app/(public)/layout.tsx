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

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      {/* Bottom padding on mobile so the fixed nav bar never covers content. */}
      <main className="flex flex-1 flex-col pb-16 md:pb-0">{children}</main>
      <Footer />
      <MobileNavBar />
    </div>
  )
}
