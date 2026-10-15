// The booking fields the admin works with, shared by the admin booking APIs.

import type { Prisma } from '@prisma/client'
import { parseBookingAddons } from '@/lib/pets'

export const PET_SELECT = {
  id: true,
  name: true,
  species: true,
  breed: true,
  size: true,
  coat: true,
  temperament: true,
  healthNotes: true,
  vaccinated: true,
} satisfies Prisma.PetSelect

export const ADMIN_BOOKING_SELECT = {
  id: true,
  startTime: true,
  endTime: true,
  status: true,
  customerName: true,
  customerPhone: true,
  customerEmail: true,
  noShow: true,
  notes: true,
  reminderSentAt: true,
  price: true,
  addons: true,
  pet: { select: PET_SELECT },
  barber: { select: { id: true, name: true } },
  service: { select: { id: true, name: true, price: true, duration: true } },
} satisfies Prisma.BookingSelect

type AdminBookingRow = Prisma.BookingGetPayload<{ select: typeof ADMIN_BOOKING_SELECT }>

// Adds the booking's length in minutes, which depends on the pet's size and
// the add-ons rather than on the service alone.
export function toAdminBooking<T extends AdminBookingRow>(booking: T) {
  return {
    ...booking,
    addons: parseBookingAddons(booking.addons),
    duration: Math.round((booking.endTime.getTime() - booking.startTime.getTime()) / 60_000),
  }
}
