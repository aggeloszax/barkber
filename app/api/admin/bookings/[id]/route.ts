import { prisma } from '@/lib/prisma'
import { ADMIN_BOOKING_SELECT, toAdminBooking } from '@/lib/admin-booking'
import { isPetSize, parseBookingAddons } from '@/lib/pets'
import { quoteBooking } from '@/lib/quote'
import { requireAdmin } from '@/lib/admin-auth'
import { sendBookingRescheduledEmail } from '@/lib/notifications'
import { normalizeGreekMobilePhone } from '@/lib/phone'
import { createBookingDateTime, parseDateKey } from '@/lib/schedule'
import { Prisma, type BookingStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

type UpdateBookingPayload = {
  status?: unknown
  noShow?: unknown
  notes?: unknown
  // Moves the booking. The admin may place it outside working hours, but
  // never on top of another active booking of the same barber.
  reschedule?: {
    barberId?: unknown
    serviceId?: unknown
    date?: unknown
    slotTime?: unknown
    notifyCustomer?: unknown
  }
}

const STATUSES = new Set<BookingStatus>(['PENDING', 'COMPLETED', 'CANCELLED'])

const BOOKING_SELECT = ADMIN_BOOKING_SELECT

class ConflictError extends Error {}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  let payload: UpdateBookingPayload
  try {
    payload = (await request.json()) as UpdateBookingPayload
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const hasStatus = payload.status !== undefined
  const hasNoShow = payload.noShow !== undefined
  const hasNotes = payload.notes !== undefined
  const reschedule = payload.reschedule

  if (!hasStatus && !hasNoShow && !hasNotes && !reschedule) {
    return Response.json({ error: 'No booking updates provided' }, { status: 400 })
  }
  if (
    hasStatus &&
    (typeof payload.status !== 'string' || !STATUSES.has(payload.status as BookingStatus))
  ) {
    return Response.json({ error: 'Invalid booking status' }, { status: 400 })
  }
  if (hasNoShow && typeof payload.noShow !== 'boolean') {
    return Response.json({ error: 'Invalid no-show value' }, { status: 400 })
  }
  if (
    hasNotes &&
    payload.notes !== null &&
    (typeof payload.notes !== 'string' || payload.notes.length > 500)
  ) {
    return Response.json({ error: 'Το σχόλιο είναι πολύ μεγάλο.' }, { status: 400 })
  }
  const notes = typeof payload.notes === 'string' && payload.notes.trim() ? payload.notes.trim() : null

  let move: { barberId: string; serviceId: string; date: string; slotTime: string } | null = null
  if (reschedule) {
    const { barberId, serviceId, date, slotTime } = reschedule
    if (
      typeof barberId !== 'string' ||
      typeof serviceId !== 'string' ||
      typeof date !== 'string' ||
      typeof slotTime !== 'string' ||
      !parseDateKey(date) ||
      !/^\d{2}:\d{2}$/.test(slotTime)
    ) {
      return Response.json({ error: 'Μη έγκυρα στοιχεία μετακίνησης.' }, { status: 400 })
    }
    move = { barberId, serviceId, date, slotTime }
  }

  try {
    const { id } = await params
    const existing = await prisma.booking.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        barberId: true,
        serviceId: true,
        startTime: true,
        endTime: true,
        price: true,
        addons: true,
        pet: { select: { size: true } },
      },
    })
    if (!existing) {
      return Response.json({ error: 'Booking not found' }, { status: 404 })
    }

    let barberId = existing.barberId
    let serviceId = existing.serviceId
    let startTime = existing.startTime
    let endTime = existing.endTime
    let price = existing.price

    if (move) {
      const barber = await prisma.barber.findUnique({ where: { id: move.barberId }, select: { id: true } })
      const newStart = createBookingDateTime(move.date, move.slotTime)
      // Same service: the booking keeps its length and price. A new service
      // is priced again for the pet's size, with the same add-ons.
      let duration = Math.round((existing.endTime.getTime() - existing.startTime.getTime()) / 60_000)
      if (move.serviceId !== existing.serviceId) {
        const size = existing.pet && isPetSize(existing.pet.size) ? existing.pet.size : null
        const addonIds = parseBookingAddons(existing.addons).map((addon) => addon.id)
        const quote = await quoteBooking(move.serviceId, size, addonIds)
          ?? await quoteBooking(move.serviceId, size)
        if (!quote) {
          return Response.json({ error: 'Η υπηρεσία δεν βρέθηκε.' }, { status: 404 })
        }
        duration = quote.duration
        price = quote.price
      }
      if (!barber || !newStart) {
        return Response.json({ error: 'Ο groomer δεν βρέθηκε.' }, { status: 404 })
      }
      barberId = move.barberId
      serviceId = move.serviceId
      startTime = newStart
      endTime = new Date(newStart.getTime() + duration * 60_000)
    }

    const nextStatus = hasStatus ? (payload.status as BookingStatus) : existing.status
    // Moving a booking or bringing a cancelled one back must not double-book.
    const needsOverlapCheck =
      nextStatus !== 'CANCELLED' && (move !== null || existing.status === 'CANCELLED')

    const booking = await prisma.$transaction(
      async (tx) => {
        if (needsOverlapCheck) {
          await tx.$queryRaw`
            WITH lock AS MATERIALIZED (
              SELECT pg_advisory_xact_lock(hashtext(${barberId}))
            )
            SELECT 1 AS locked FROM lock
          `
          const overlapping = await tx.booking.findFirst({
            where: {
              id: { not: existing.id },
              barberId,
              status: { not: 'CANCELLED' },
              startTime: { lt: endTime },
              endTime: { gt: startTime },
            },
            select: { id: true },
          })
          if (overlapping) throw new ConflictError()
        }

        return tx.booking.update({
          where: { id: existing.id },
          data: {
            ...(hasStatus ? { status: nextStatus } : {}),
            ...(hasNoShow ? { noShow: payload.noShow as boolean } : {}),
            ...(hasNotes ? { notes } : {}),
            // A moved booking gets a fresh reminder for its new day.
            ...(move ? { barberId, serviceId, startTime, endTime, price, reminderSentAt: null } : {}),
          },
          select: BOOKING_SELECT,
        })
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )

    let customerNotification: 'sent' | 'failed' | 'skipped' = 'skipped'
    if (move && reschedule?.notifyCustomer === true) {
      const { cancelToken } = await prisma.booking.findUniqueOrThrow({
        where: { id: booking.id },
        select: { cancelToken: true },
      })
      customerNotification = await sendBookingRescheduledEmail({ ...booking, cancelToken })
    }

    const phoneKey = normalizeGreekMobilePhone(booking.customerPhone)
    const noShowCount = phoneKey
      ? await prisma.booking.count({ where: { noShow: true, customerPhone: phoneKey } })
      : 0

    const customer = await prisma.customer.findUnique({
      where: { phone: booking.customerPhone },
      select: { phone: true, notes: true, blocked: true, blockedReason: true },
    })

    return Response.json({ ...toAdminBooking(booking), noShowCount, customer, customerNotification })
  } catch (error) {
    if (error instanceof ConflictError) {
      return Response.json(
        { error: 'Ο groomer έχει ήδη ραντεβού σε αυτή την ώρα.' },
        { status: 409 },
      )
    }
    console.error('Failed to update booking:', error)
    return Response.json({ error: 'Η ενημέρωση του ραντεβού απέτυχε.' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  try {
    const { id } = await params
    await prisma.booking.deleteMany({ where: { id } })
    return Response.json({ success: true })
  } catch (error) {
    console.error('Failed to delete booking:', error)
    return Response.json({ error: 'Booking not found' }, { status: 404 })
  }
}
