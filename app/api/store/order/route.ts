/**
 * POST /api/store/order (playbook S091, pack api-commerce-public.md §2.1).
 *
 * Public or authenticated: a guest can order merch, and a signed-in caller's
 * order joins their record — user_id comes from the SESSION when one exists,
 * never from the body. The client's price is display only: id + price are
 * validated against the code catalogue (lib/constants/merch.ts), and the
 * snapshot written is the CATALOGUE's, so a tampered payload cannot buy a
 * TTD $1,250 photo session for TTD $1.
 *
 * The write uses the admin client: store_orders has no client-role INSERT
 * (harden_grants: anon never writes), and this route IS the server. Cash on
 * delivery is refused above the TTD $500 line server-side — the modal hides
 * the option, the API enforces it.
 *
 * TODO(S135/S136): customer receipt + admin alert emails go through the
 * notify dispatcher when it lands; until then the order row is the record
 * and the admin queue reads it directly. Logged loudly so ops can follow up.
 */
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, identifierFrom } from '@/lib/rate-limit'
import { err } from '@/lib/api/errors'
import { logger } from '@/lib/utils/logger'
import { productById, CASH_ON_DELIVERY_LIMIT_TTD } from '@/lib/constants/merch'

const bodySchema = z.object({
  product_id: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
  full_name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(40).optional(),
  size: z.string().trim().max(20).optional(),
  color_preference: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(1000).optional(),
  payment_method: z.enum(['bank_transfer', 'wipay_link', 'cash_on_delivery']).optional(),
})

export async function POST(request: Request) {
  const limit = await checkRateLimit('store_order', identifierFrom(request))
  if (!limit.ok) return limit.response

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return err('INVALID_INPUT', { fieldErrors: {}, formErrors: ['Send a JSON body.'] })
  }
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    const flat = parsed.error.flatten()
    return err('INVALID_INPUT', { fieldErrors: flat.fieldErrors, formErrors: flat.formErrors })
  }
  const body = parsed.data

  // The catalogue is the truth; an unknown id is indistinguishable from a
  // retired product.
  const product = productById(body.product_id)
  if (!product) {
    return err('NOT_FOUND', { resource: 'product' })
  }

  const total = product.price * body.quantity
  if (body.payment_method === 'cash_on_delivery' && total >= CASH_ON_DELIVERY_LIMIT_TTD) {
    return err('INVALID_INPUT', {
      fieldErrors: {
        payment_method: [
          `Cash on delivery is available for orders under TTD $${CASH_ON_DELIVERY_LIMIT_TTD}.`,
        ],
      },
      formErrors: [],
    })
  }

  // Session attribution — optional by design (guest orders are first-class).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: created, error } = await createAdminClient()
    .from('store_orders')
    .insert({
      user_id: user?.id ?? null,
      email: body.email,
      full_name: body.full_name,
      phone: body.phone ?? null,
      product_id: product.id,
      product_name: product.name,
      product_price_ttd: product.price,
      quantity: body.quantity,
      total_ttd: total,
      branding: product.branding,
      size: body.size ?? null,
      color_preference: body.color_preference ?? null,
      notes: body.notes ?? null,
      payment_method: body.payment_method ?? null,
    })
    .select('id')
    .single()

  if (error || !created) {
    logger.error('store:order_failed', { productId: product.id, code: error?.code })
    return err('INTERNAL')
  }

  // TODO(S135/S136): receipt + admin alert through the dispatcher. Loud log so
  // a pre-dispatcher order is never silently unnoticed.
  logger.info('store:order_created', {
    orderId: created.id,
    productId: product.id,
    totalTtd: total,
    attributed: Boolean(user),
  })

  return Response.json({ success: true, orderId: created.id }, { status: 201 })
}
