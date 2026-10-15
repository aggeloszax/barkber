// Server-side price and duration of a booking: the main service for the
// pet's size plus the chosen add-ons.

import { prisma } from '@/lib/prisma'
import { type BookingAddon, type PetSize, quoteService } from '@/lib/pets'

const SERVICE_SELECT = {
  id: true,
  name: true,
  price: true,
  duration: true,
  sizePricing: true,
  species: true,
  isAddon: true,
} as const

export type BookingQuote = {
  service: { id: string; name: string }
  addons: BookingAddon[]
  price: number
  duration: number
}

// null when the service or an add-on does not exist, or the ids are mixed up
// (a main service passed as an add-on or the other way round).
export async function quoteBooking(
  serviceId: string,
  size: PetSize | null,
  addonIds: string[] = [],
): Promise<BookingQuote | null> {
  const uniqueAddonIds = Array.from(new Set(addonIds))
  const [service, addonRows] = await Promise.all([
    prisma.service.findUnique({ where: { id: serviceId }, select: SERVICE_SELECT }),
    uniqueAddonIds.length
      ? prisma.service.findMany({ where: { id: { in: uniqueAddonIds } }, select: SERVICE_SELECT })
      : Promise.resolve([]),
  ])
  if (!service || service.isAddon) return null
  if (addonRows.length !== uniqueAddonIds.length || addonRows.some((row) => !row.isAddon)) {
    return null
  }

  const main = quoteService(service, size)
  const addons = addonRows.map((row) => ({ id: row.id, name: row.name, ...quoteService(row, size) }))

  return {
    service: { id: service.id, name: service.name },
    addons,
    price: main.price + addons.reduce((sum, addon) => sum + addon.price, 0),
    duration: main.duration + addons.reduce((sum, addon) => sum + addon.duration, 0),
  }
}

// Comma separated ids from a query string or a JSON array from a body.
export function parseAddonIds(value: unknown): string[] | null {
  if (value === undefined || value === null || value === '') return []
  const list = typeof value === 'string' ? value.split(',') : value
  if (!Array.isArray(list) || list.length > 10) return null
  if (!list.every((id) => typeof id === 'string' && id.length > 0 && id.length < 64)) return null
  return list as string[]
}
