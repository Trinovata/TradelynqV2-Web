import { Hammer } from 'lucide-react'

/**
 * A placeholder for a workspace tool not yet built (playbook S105).
 *
 * Every sidebar destination resolves to a real page, so the shell never shows a
 * broken link while the toolset is filled in tool by tool. The stub states the
 * tool's name and purpose (so the navigation still teaches what the workspace
 * will do) and reads as deliberately in-progress rather than empty or errored.
 */
export function ToolStub({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-6">
        <h1 className="text-foreground font-display text-3xl tracking-tight">{title}</h1>
        <p className="text-muted mt-1 text-sm">{description}</p>
      </header>
      <div className="border-border bg-card flex flex-col items-center gap-3 rounded-[--radius-card] border border-dashed p-12 text-center">
        <span className="bg-accent-soft flex size-11 items-center justify-center rounded-[--radius-control]">
          <Hammer className="text-accent-ink size-5" aria-hidden="true" />
        </span>
        <p className="text-foreground font-medium">In development</p>
        <p className="text-muted max-w-sm text-sm text-pretty">
          This tool is being built and will appear here shortly.
        </p>
      </div>
    </div>
  )
}
