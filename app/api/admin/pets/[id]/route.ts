import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { PET_SELECT } from '@/lib/admin-booking'
import { isCoatType, isPetSize, isSpecies, isTemperament } from '@/lib/pets'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

function optionalText(value: unknown, max: number): string | null | undefined | false {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string' || value.trim().length > max) return false
  return value.trim() || null
}

// Edits a pet's details from the admin. Only the fields sent are changed.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  let payload: Record<string, unknown>
  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const name = optionalText(payload.name, 40)
  const breed = optionalText(payload.breed, 60)
  const healthNotes = optionalText(payload.healthNotes, 500)
  if (name === false || name === null || breed === false || healthNotes === false) {
    return Response.json({ error: 'Μη έγκυρα στοιχεία κατοικιδίου.' }, { status: 400 })
  }
  if (
    (payload.species !== undefined && !isSpecies(payload.species)) ||
    (payload.size !== undefined && !isPetSize(payload.size)) ||
    (payload.coat != null && !isCoatType(payload.coat)) ||
    (payload.temperament != null && !isTemperament(payload.temperament)) ||
    (payload.vaccinated !== undefined && typeof payload.vaccinated !== 'boolean')
  ) {
    return Response.json({ error: 'Μη έγκυρα στοιχεία κατοικιδίου.' }, { status: 400 })
  }

  try {
    const { id } = await params
    const pet = await prisma.pet.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(breed !== undefined ? { breed } : {}),
        ...(healthNotes !== undefined ? { healthNotes } : {}),
        ...(payload.species !== undefined ? { species: payload.species as string } : {}),
        ...(payload.size !== undefined ? { size: payload.size as string } : {}),
        ...(payload.coat !== undefined ? { coat: (payload.coat as string | null) ?? null } : {}),
        ...(payload.temperament !== undefined
          ? { temperament: (payload.temperament as string | null) ?? null }
          : {}),
        ...(payload.vaccinated !== undefined ? { vaccinated: payload.vaccinated as boolean } : {}),
      },
      select: PET_SELECT,
    })
    return Response.json(pet)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return Response.json({ error: 'Το κατοικίδιο δεν βρέθηκε.' }, { status: 404 })
    }
    console.error('Failed to update pet:', error)
    return Response.json({ error: 'Η αποθήκευση απέτυχε.' }, { status: 500 })
  }
}
