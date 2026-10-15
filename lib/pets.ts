// Pet vocabulary and size-based pricing, shared by the booking page, the
// admin and the API. Pets are stored with plain string codes; these maps give
// their labels and the list of valid values.

export const SPECIES = ['DOG', 'CAT'] as const
export type Species = (typeof SPECIES)[number]
export const SPECIES_LABELS: Record<Species, string> = {
  DOG: 'Σκύλος',
  CAT: 'Γάτα',
}

export const PET_SIZES = ['SMALL', 'MEDIUM', 'LARGE', 'XLARGE'] as const
export type PetSize = (typeof PET_SIZES)[number]
export const PET_SIZE_LABELS: Record<PetSize, { label: string; hint: string }> = {
  SMALL: { label: 'Μικρό', hint: 'έως 10 κιλά' },
  MEDIUM: { label: 'Μεσαίο', hint: '10 έως 25 κιλά' },
  LARGE: { label: 'Μεγάλο', hint: '25 έως 40 κιλά' },
  XLARGE: { label: 'Πολύ μεγάλο', hint: 'πάνω από 40 κιλά' },
}

export const COAT_TYPES = ['SHORT', 'MEDIUM', 'LONG', 'CURLY', 'DOUBLE'] as const
export type CoatType = (typeof COAT_TYPES)[number]
export const COAT_LABELS: Record<CoatType, string> = {
  SHORT: 'Κοντό',
  MEDIUM: 'Μεσαίο',
  LONG: 'Μακρύ',
  CURLY: 'Σγουρό',
  DOUBLE: 'Διπλό (π.χ. Husky)',
}

export const TEMPERAMENTS = ['CALM', 'NERVOUS', 'REACTIVE'] as const
export type Temperament = (typeof TEMPERAMENTS)[number]
export const TEMPERAMENT_LABELS: Record<Temperament, string> = {
  CALM: 'Ήρεμο',
  NERVOUS: 'Αγχώδες',
  REACTIVE: 'Μπορεί να δαγκώσει',
}

export function isSpecies(value: unknown): value is Species {
  return SPECIES.includes(value as Species)
}
export function isPetSize(value: unknown): value is PetSize {
  return PET_SIZES.includes(value as PetSize)
}
export function isCoatType(value: unknown): value is CoatType {
  return COAT_TYPES.includes(value as CoatType)
}
export function isTemperament(value: unknown): value is Temperament {
  return TEMPERAMENTS.includes(value as Temperament)
}

// Price and duration of a service for each pet size. A size left out uses
// the service's base price and duration.
export type SizePricing = Partial<Record<PetSize, { price: number; duration: number }>>

export function parseSizePricing(value: unknown): SizePricing {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: SizePricing = {}
  for (const size of PET_SIZES) {
    const entry = (value as Record<string, unknown>)[size]
    if (!entry || typeof entry !== 'object') continue
    const { price, duration } = entry as { price?: unknown; duration?: unknown }
    if (
      typeof price === 'number' &&
      Number.isFinite(price) &&
      price >= 0 &&
      typeof duration === 'number' &&
      Number.isInteger(duration) &&
      duration > 0
    ) {
      result[size] = { price, duration }
    }
  }
  return result
}

type PricedService = { price: number; duration: number; sizePricing?: unknown }

export function quoteService(service: PricedService, size: PetSize | null) {
  const own = size ? parseSizePricing(service.sizePricing)[size] : undefined
  return own ?? { price: service.price, duration: service.duration }
}

// Lowest price over all sizes, shown as "από X€" before a size is known.
export function startingPrice(service: PricedService) {
  const prices = Object.values(parseSizePricing(service.sizePricing)).map((entry) => entry.price)
  return Math.min(service.price, ...prices)
}

export function servesSpecies(service: { species: string | null }, species: Species | null) {
  return !service.species || !species || service.species === species
}

// Add-ons as stored on a booking: a snapshot, so later price changes do not
// rewrite history.
export type BookingAddon = { id: string; name: string; price: number; duration: number }

export function parseBookingAddons(value: unknown): BookingAddon[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is BookingAddon =>
      Boolean(item) &&
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      typeof item.price === 'number' &&
      typeof item.duration === 'number',
  )
}

// "Μπέλα · Σκύλος, Μαλτέζ · Μικρό"
export function describePet(pet: { name: string; species: string; breed: string | null; size: string }) {
  const species = isSpecies(pet.species) ? SPECIES_LABELS[pet.species] : pet.species
  const size = isPetSize(pet.size) ? PET_SIZE_LABELS[pet.size].label : pet.size
  return `${pet.name} · ${species}${pet.breed ? `, ${pet.breed}` : ''} · ${size}`
}
