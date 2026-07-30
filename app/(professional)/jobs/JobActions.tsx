'use client'

/**
 * Job add + row transition controls (playbook S110). Add a job in a modal;
 * advance a job with one tap (Start / Mark complete / Reopen). Every action
 * router.refresh()es so the pipeline reflects the server truth immediately.
 */
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'

export function AddJobButton() {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()
  const [name, setName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [value, setValue] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const create = async () => {
    if (!name.trim() || !description.trim()) {
      setError('Add a customer name and what the job is.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customer_name: name.trim(),
          customer_phone: phone.trim() || undefined,
          service_description: description.trim(),
          job_value_ttd: value ? Math.max(0, Math.round(Number(value))) : undefined,
        }),
      })
      if (res.ok) {
        setOpen(false)
        setName('')
        setPhone('')
        setDescription('')
        setValue('')
        router.refresh()
      } else {
        setError('Couldn’t add the job. Try again.')
      }
    } catch {
      setError('Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} iconLeft={<Plus className="size-4" />}>
        Log a job
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Log a job"
        footer={
          <Button onClick={create} isLoading={busy} loadingLabel="Adding…">
            Add job
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Customer name"
            placeholder="Dev Maharaj"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Customer phone (optional)"
            placeholder="868 000 0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Textarea
            label="What's the job?"
            placeholder="Full bathroom refit — supply and install."
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Input
            label="Value (optional, TTD)"
            type="number"
            min={0}
            placeholder="2500"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="font-mono tabular-nums"
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
      </Modal>
    </>
  )
}

export function JobRowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)

  const act = async (action: 'start' | 'complete' | 'reopen') => {
    setBusy(true)
    try {
      const res = await fetch(`/api/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) router.refresh()
    } finally {
      setBusy(false)
    }
  }

  if (status === 'accepted') {
    return (
      <Button size="sm" variant="secondary" onClick={() => act('start')} isLoading={busy}>
        Start
      </Button>
    )
  }
  if (status === 'in_progress') {
    return (
      <Button size="sm" onClick={() => act('complete')} isLoading={busy}>
        Mark complete
      </Button>
    )
  }
  if (status === 'completed') {
    return (
      <Button size="sm" variant="ghost" onClick={() => act('reopen')} isLoading={busy}>
        Reopen
      </Button>
    )
  }
  return null
}
