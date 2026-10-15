'use client'

import { type FormEvent, useMemo, useState } from 'react'
import { normalizeGreekMobilePhone, toNationalPhoneInput } from '@/lib/phone'
import {
  PET_SIZE_LABELS,
  PET_SIZES,
  type PetSize,
  SPECIES,
  SPECIES_LABELS,
  type Species,
  isPetSize,
  isSpecies,
  quoteService,
  servesSpecies,
} from '@/lib/pets'
import {
  type Barber,
  type Booking,
  type Service,
  ApiError,
  adminFetch,
  errorMessage,
  formatPrice,
} from '../../_lib/admin-data'
import { AlertIcon, Field, FormError, Modal, SelectInput, TextArea, TextInput } from '../ui'
import { ADMIN_TIME_OPTIONS, takenTimes } from './time-options'

export type NewBookingPrefill = {
  barberId?: string
  date: string
  time?: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string | null
}

export function NewBookingModal({
  prefill,
  barbers,
  services,
  knownBookings,
  onClose,
  onCreated,
}: {
  prefill: NewBookingPrefill
  barbers: Barber[]
  services: Service[]
  // Bookings already loaded in the calendar, used to flag taken times and to
  // fill in returning customers' details.
  knownBookings: Booking[]
  onClose: () => void
  onCreated: (booking: Booking) => void
}) {
  const [customerName, setCustomerName] = useState(prefill.customerName ?? '')
  const [customerPhone, setCustomerPhone] = useState(
    prefill.customerPhone ? toNationalPhoneInput(prefill.customerPhone) : '',
  )
  const [customerEmail, setCustomerEmail] = useState(prefill.customerEmail ?? '')
  const [notes, setNotes] = useState('')
  const [petName, setPetName] = useState('')
  const [petSpecies, setPetSpecies] = useState<Species>('DOG')
  const [petSize, setPetSize] = useState<PetSize>('SMALL')
  const [petBreed, setPetBreed] = useState('')
  const mainServices = services.filter((item) => !item.isAddon && servesSpecies(item, petSpecies))
  const [serviceId, setServiceId] = useState(mainServices[0]?.id ?? '')
  const [barberId, setBarberId] = useState(prefill.barberId ?? barbers[0]?.id ?? '')
  const [date, setDate] = useState(prefill.date)
  const [time, setTime] = useState(prefill.time ?? '10:00')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const service = mainServices.find((item) => item.id === serviceId)
  const quote = service ? quoteService(service, petSize) : null
  const duration = quote?.duration ?? 30

  const taken = useMemo(
    () => takenTimes(knownBookings, barberId, date, duration),
    [knownBookings, barberId, date, duration],
  )

  const knownCustomer = knownBookings.find(
    (b) => b.customerPhone === normalizeGreekMobilePhone(customerPhone),
  )?.customer

  // Fill a returning customer's name and email from their phone number.
  function handlePhoneChange(value: string) {
    const national = toNationalPhoneInput(value)
    setCustomerPhone(national)
    const normalized = normalizeGreekMobilePhone(national)
    if (!normalized) return
    const previous = knownBookings.find(
      (b) => normalizeGreekMobilePhone(b.customerPhone) === normalized,
    )
    if (!previous) return
    if (!customerName.trim()) setCustomerName(previous.customerName)
    if (!customerEmail.trim() && previous.customerEmail) setCustomerEmail(previous.customerEmail)
    if (!petName.trim() && previous.pet) choosePet(previous.pet)
  }

  // Pets this customer brought before, newest first.
  const normalizedPhone = normalizeGreekMobilePhone(customerPhone)
  const knownPets = normalizedPhone
    ? Array.from(
        new Map(
          knownBookings
            .filter((b) => b.pet && b.customerPhone === normalizedPhone)
            .map((b) => [b.pet!.id, b.pet!]),
        ).values(),
      )
    : []

  function choosePet(pet: NonNullable<Booking['pet']>) {
    setPetName(pet.name)
    setPetBreed(pet.breed ?? '')
    if (isSpecies(pet.species)) setPetSpecies(pet.species)
    if (isPetSize(pet.size)) setPetSize(pet.size)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const phone = normalizeGreekMobilePhone(customerPhone)

    if (!customerName.trim()) return setError('Συμπλήρωσε το όνομα του πελάτη.')
    if (!phone) return setError('Συμπλήρωσε έγκυρο κινητό (69xxxxxxxx).')
    if (!petName.trim()) return setError('Συμπλήρωσε το όνομα του κατοικιδίου.')
    if (!serviceId || !barberId) return setError('Επίλεξε υπηρεσία και groomer.')

    setSubmitting(true)
    setError(null)
    try {
      const created = await adminFetch<Omit<Booking, 'noShow' | 'noShowCount' | 'customer' | 'reminderSentAt'>>(
        '/api/bookings',
        {
          method: 'POST',
          body: JSON.stringify({
            serviceId,
            barberId,
            date,
            slotTime: time,
            customerName: customerName.trim(),
            customerPhone: phone,
            customerEmail: customerEmail.trim() || null,
            notes: notes.trim() || null,
            pet: {
              name: petName.trim(),
              species: petSpecies,
              size: petSize,
              breed: petBreed.trim() || null,
            },
            adminManual: true,
          }),
        },
      )
      const previous = knownBookings.find((b) => b.customerPhone === phone)
      onCreated({
        ...created,
        // The booking API does not send the length; derive it like the admin API.
        duration: Math.round(
          (new Date(created.endTime).getTime() - new Date(created.startTime).getTime()) / 60_000,
        ),
        noShow: false,
        reminderSentAt: null,
        noShowCount: previous?.noShowCount ?? 0,
        customer: previous?.customer ?? null,
      })
      onClose()
    } catch (submitError) {
      setError(
        submitError instanceof ApiError && submitError.status === 409
          ? 'Ο groomer έχει ήδη ραντεβού σε αυτή την ώρα.'
          : errorMessage(submitError),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="Νέο ραντεβού"
      description="Για πελάτη που ήρθε από κοντά ή κάλεσε στο τηλέφωνο."
      onClose={onClose}
      onSubmit={(event) => void handleSubmit(event)}
      submitLabel="Καταχώρηση"
      submitting={submitting}
      submitDisabled={mainServices.length === 0 || barbers.length === 0 || taken.has(time)}
      wide
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Κινητό">
          <TextInput
            type="tel"
            inputMode="numeric"
            value={customerPhone}
            onChange={(event) => handlePhoneChange(event.target.value)}
            placeholder="69xxxxxxxx"
            autoComplete="off"
            autoFocus
          />
        </Field>
        <Field label="Ονοματεπώνυμο">
          <TextInput
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="π.χ. Γιώργος Παπαδόπουλος"
            autoComplete="off"
          />
        </Field>
        <Field label="Email" hint="Προαιρετικό. Αν το συμπληρώσεις, ο πελάτης παίρνει επιβεβαίωση." className="sm:col-span-2">
          <TextInput
            type="email"
            value={customerEmail}
            onChange={(event) => setCustomerEmail(event.target.value)}
            placeholder="pelatis@example.com"
            autoComplete="off"
          />
        </Field>
        {knownPets.length > 0 && (
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            {knownPets.map((pet) => (
              <button
                key={pet.id}
                type="button"
                onClick={() => choosePet(pet)}
                className={`rounded-full border px-3 py-1 text-[13px] ${
                  pet.name === petName
                    ? 'border-[var(--admin-accent)] bg-[var(--admin-accent-soft)]'
                    : 'border-[var(--admin-border)] bg-white'
                }`}
              >
                {pet.name}
              </button>
            ))}
          </div>
        )}
        <Field label="Όνομα κατοικιδίου">
          <TextInput value={petName} maxLength={40} onChange={(event) => setPetName(event.target.value)} placeholder="π.χ. Μπέλα" autoComplete="off" />
        </Field>
        <Field label="Ράτσα">
          <TextInput value={petBreed} maxLength={60} onChange={(event) => setPetBreed(event.target.value)} placeholder="Προαιρετικό" autoComplete="off" />
        </Field>
        <Field label="Είδος">
          <SelectInput
            value={petSpecies}
            onChange={(event) => {
              const species = event.target.value as Species
              setPetSpecies(species)
              if (service && !servesSpecies(service, species)) {
                setServiceId(services.find((item) => !item.isAddon && servesSpecies(item, species))?.id ?? '')
              }
            }}
          >
            {SPECIES.map((value) => (
              <option key={value} value={value}>
                {SPECIES_LABELS[value]}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Μέγεθος">
          <SelectInput value={petSize} onChange={(event) => setPetSize(event.target.value as PetSize)}>
            {PET_SIZES.map((value) => (
              <option key={value} value={value}>
                {PET_SIZE_LABELS[value].label} · {PET_SIZE_LABELS[value].hint}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Υπηρεσία" className="sm:col-span-2">
          <SelectInput value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
            {mainServices.map((item) => {
              const itemQuote = quoteService(item, petSize)
              return (
                <option key={item.id} value={item.id}>
                  {item.name} · {itemQuote.duration}′ · {formatPrice(itemQuote.price)}
                </option>
              )
            })}
          </SelectInput>
        </Field>
        <Field label="Groomer">
          <SelectInput value={barberId} onChange={(event) => setBarberId(event.target.value)}>
            {barbers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ημερομηνία">
            <TextInput type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Ώρα">
            <SelectInput value={time} onChange={(event) => setTime(event.target.value)}>
              {ADMIN_TIME_OPTIONS.map((option) => (
                <option key={option} value={option} disabled={taken.has(option)}>
                  {option}
                  {taken.has(option) ? ' · κλεισμένη' : ''}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
      </div>
      <Field label="Σχόλιο ραντεβού" hint="Προαιρετικό, φαίνεται μόνο στο πρόγραμμα.">
        <TextArea
          rows={2}
          maxLength={500}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </Field>
      {knownCustomer?.blocked && (
        <p className="flex gap-2 text-sm text-red-700">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          Ο πελάτης είναι μπλοκαρισμένος για online κρατήσεις
          {knownCustomer.blockedReason ? ` (${knownCustomer.blockedReason})` : ''}.
        </p>
      )}
      {knownCustomer?.notes && (
        <p className="rounded-xl bg-[var(--admin-surface-2)] px-3 py-2 text-sm">
          <span className="font-medium">Σημειώσεις πελάτη:</span> {knownCustomer.notes}
        </p>
      )}
      {taken.has(time) && (
        <p className="text-sm text-amber-800">
          Η ώρα αυτή συμπίπτει με άλλο ραντεβού του groomer. Διάλεξε άλλη ώρα.
        </p>
      )}
      <FormError message={error} />
    </Modal>
  )
}
