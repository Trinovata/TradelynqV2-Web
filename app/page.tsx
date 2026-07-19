/**
 * Placeholder home page.
 *
 * The real landing page is playbook S077, built against v2/03 §3.2 with strings from
 * details/copy-public.md. This exists only so the route tree is valid and the build has
 * something to render. It uses no colour utilities on purpose: the semantic token layer
 * does not exist until S058, and inventing literal colours here would violate DESIGN.md
 * and have to be torn out again.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <h1 className="text-3xl font-medium tracking-tight text-balance">TradeLynq V2</h1>
      <p className="text-pretty">
        Ground-up rebuild in progress. The landing page is built at playbook step S077.
      </p>
    </main>
  )
}
