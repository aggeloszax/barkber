'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Fragment, useEffect, useState } from 'react'
import {
  ANY_BARBER,
  BOOKING_WINDOW_DAYS,
  getBarberPeriodsForDate,
  isDayBookable,
  isScheduleExceptionType,
  type NormalizedScheduleException,
  type TimeOffRange,
  type WorkingPeriod,
  toDateKey,
} from '@/lib/schedule'
import { normalizeGreekMobilePhone, toNationalPhoneInput } from '@/lib/phone'
import { groupByCategory } from '@/lib/catalog'
import { SHOP, SITE_THEME } from '@/lib/shop'
import {
  COAT_LABELS,
  COAT_TYPES,
  type CoatType,
  PET_SIZE_LABELS,
  PET_SIZES,
  type PetSize,
  SPECIES,
  SPECIES_LABELS,
  type Species,
  TEMPERAMENT_LABELS,
  TEMPERAMENTS,
  type Temperament,
  quoteService,
  servesSpecies,
  startingPrice,
} from '@/lib/pets'
import { ShopInfo } from './shop-info'
import { SocialLinks } from './social-links'

type Service = {
  id: string
  name: string
  price: number
  duration: number
  description: string | null
  category: string | null
  species: string | null
  isAddon: boolean
  sizePricing: unknown
}

type PetDraft = {
  name: string
  species: Species | null
  size: PetSize | null
  breed: string
  coat: CoatType | null
  temperament: Temperament | null
  healthNotes: string
  vaccinated: boolean
}

const EMPTY_PET: PetDraft = {
  name: '',
  species: null,
  size: null,
  breed: '',
  coat: null,
  temperament: null,
  healthNotes: '',
  vaccinated: false,
}

// Remembered on this device only, so a returning customer does not type
// their details and pets again. Never sent anywhere except with a booking.
const PROFILE_STORAGE_KEY = 'barkber:profile'
type SavedProfile = { name: string; phone: string; email: string; pets: PetDraft[] }

function loadSavedProfile(): SavedProfile | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<SavedProfile>
    return {
      name: typeof data.name === 'string' ? data.name : '',
      phone: typeof data.phone === 'string' ? data.phone : '',
      email: typeof data.email === 'string' ? data.email : '',
      pets: Array.isArray(data.pets)
        ? data.pets.filter((pet) => pet && typeof pet.name === 'string').map((pet) => ({ ...EMPTY_PET, ...pet }))
        : [],
    }
  } catch {
    return null
  }
}

function saveProfile(profile: SavedProfile) {
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
  } catch {
    // Private mode or storage disabled: booking still works without it.
  }
}

// A few common breeds to speed up typing; any text is accepted.
const COMMON_BREEDS = [
  'Μαλτέζ',
  'Yorkshire Terrier',
  'Shih Tzu',
  'Poodle',
  'Chihuahua',
  'Pomeranian',
  'Bichon Frisé',
  'Cocker Spaniel',
  'Golden Retriever',
  'Labrador',
  'Husky',
  'Γερμανικός Ποιμενικός',
  'Schnauzer',
  'Ημίαιμο',
  'Περσική γάτα',
  'Ευρωπαϊκή κοντότριχη',
]

type Barber = {
  id: string
  name: string
  image: string | null
  bio: string | null
  // null: the barber follows the default weekly hours.
  schedule: WorkingPeriod[] | null
}

type Slot = {
  time: string
  available: boolean
}

type BookingStep = 1 | 2 | 3 | 4 | 5
type EmailDeliveryStatus = 'sent' | 'failed' | 'skipped'

type BookingCreationResponse = {
  barber?: { id: string; name: string }
  calendar?: { google: string; ics: string }
  notificationDelivery?: {
    customerEmail: EmailDeliveryStatus
  }
}

// "No preference": the server assigns whichever barber is free.
const ANY_BARBER_CHOICE: Barber = {
  id: ANY_BARBER,
  name: 'Οποιοσδήποτε',
  image: null,
  bio: null,
  schedule: null,
}

const GR_DAYS = ['Κυρ', 'Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ']
const GR_WEEKDAYS_MON_FIRST = ['Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ', 'Κυρ']
const GR_MONTHS = [
  'Ιαν',
  'Φεβ',
  'Μαρ',
  'Απρ',
  'Μαϊ',
  'Ιουν',
  'Ιουλ',
  'Αυγ',
  'Σεπ',
  'Οκτ',
  'Νοε',
  'Δεκ',
]

const STEP_LABELS = ['Κατοικίδιο', 'Υπηρεσία', SHOP.labels.staff, 'Ημ/νία & Ώρα', 'Στοιχεία']
// Light-mode input: white field, charcoal text, burgundy focus ring.
const inputClass =
  'w-full rounded-2xl border border-[var(--page-border)] bg-white py-3.5 pl-12 pr-4 text-base text-neutral-900 outline-none transition-all duration-300 ease-in-out focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]'
// Reusable eyebrow for step/section headers: small, uppercase, sharp gray.
const stepHeaderClass =
  'text-xs font-bold uppercase tracking-wider text-neutral-500'

// Selectable chip used for species, size, coat and temperament.
function chipClass(selected: boolean) {
  return `rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-all duration-200 ease-in-out ${
    selected
      ? 'border-[var(--brand)] bg-[var(--brand)]/[0.08] text-neutral-900 ring-1 ring-[var(--brand)]'
      : 'border-[var(--page-border)] bg-white text-neutral-700 hover:border-[var(--brand)]'
  }`
}

// 90 -> "1 ώρα 30′", 45 -> "45 λεπτά"
function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} λεπτά`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `${hours} ${hours === 1 ? 'ώρα' : 'ώρες'}${rest ? ` ${rest}′` : ''}`
}

const formatPrice = (price: number) =>
  `${Number.isInteger(price) ? price : price.toFixed(2)}€`

function formatDateLong(key: string) {
  const d = new Date(`${key}T00:00:00`)
  return `${GR_DAYS[d.getDay()]} ${d.getDate()} ${GR_MONTHS[d.getMonth()]}`
}

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function buildCalendarGrid(monthDate: Date) {
  const firstOfMonth = startOfMonth(monthDate)
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7
  const gridStart = new Date(firstOfMonth)
  gridStart.setDate(firstOfMonth.getDate() - mondayOffset)

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return d
  })
}

function formatMonthTitle(date: Date) {
  return new Intl.DateTimeFormat('el-GR', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function getMaxBookingDate(today: Date) {
  const maxDate = startOfDay(today)
  maxDate.setDate(maxDate.getDate() + BOOKING_WINDOW_DAYS)
  return maxDate
}

function withImageVersion(src: string, version: string) {
  if (src.startsWith('data:')) return src
  const separator = src.includes('?') ? '&' : '?'
  return `${src}${separator}v=${version}`
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
    </svg>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 7v5l3.5 2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M5 12h14m-6-7 7 7-7 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16.5" cy="9" r="2.8" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M2.5 19.5c.7-3.6 3-5.5 6.5-5.5s5.8 1.9 6.5 5.5M15 14.2c.5-.1 1-.2 1.5-.2 2.8 0 4.6 1.6 5 4.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  )
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4.5 20c.8-4 3.3-6 7.5-6s6.7 2 7.5 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M7.2 3.5 10 7.8 7.8 10c1.2 2.6 3.3 4.7 5.9 5.9l2.2-2.2 4.4 2.8-.7 3.4c-.2.8-.9 1.3-1.7 1.3C9.6 20.7 3.3 14.4 2.8 6.1c0-.8.5-1.5 1.3-1.7l3.1-.9Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function EmailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m5 8 7 5 7-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function isValidCustomerEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function Stepper({
  step,
  done,
  canReach,
  onGo,
}: {
  step: number
  done: Record<number, boolean>
  canReach: (n: number) => boolean
  onGo: (n: number) => void
}) {
  return (
    <nav
      aria-label="Booking progress"
      className="pb-1"
    >
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] items-start gap-x-0.5 sm:gap-x-2">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1
          const isActive = step === n
          const isDone = done[n]
          const reachable = canReach(n)

          return (
            <Fragment key={n}>
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onGo(n)}
                className="group flex min-w-0 flex-col items-center gap-2 rounded-2xl transition-all duration-300 ease-in-out disabled:cursor-not-allowed"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-all duration-300 ease-in-out sm:h-9 sm:w-9 ${
                    isDone
                      ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
                      : isActive
                        ? 'border-[var(--brand)] bg-[var(--brand)]/10 text-neutral-900 shadow-[0_0_0_4px_color-mix(in_srgb,var(--brand)_12%,transparent)]'
                        : 'border-[var(--page-border)] bg-white text-neutral-400'
                  }`}
                >
                  {isDone ? <CheckIcon className="h-4 w-4" /> : n}
                </span>
                <span
                  className={`w-full text-center text-[10px] font-semibold leading-tight transition-colors duration-300 sm:text-xs ${
                    isActive
                      ? 'text-neutral-900'
                      : isDone
                        ? 'text-neutral-700'
                        : 'text-neutral-400'
                  }`}
                >
                  <span className="block break-words">{label}</span>
                </span>
              </button>
              {n < STEP_LABELS.length && (
                <span
                  className={`mt-4 h-0.5 w-2.5 shrink-0 rounded-full transition-colors duration-300 sm:mt-[18px] sm:w-8 ${
                    done[n] ? 'bg-[var(--brand)]' : 'bg-neutral-200'
                  }`}
                />
              )}
            </Fragment>
          )
        })}
      </div>
    </nav>
  )
}

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-[var(--page-border)] bg-white p-5">
      <div className="h-4 w-2/3 rounded bg-neutral-200" />
      <div className="mt-4 h-3 w-1/3 rounded bg-neutral-200" />
    </div>
  )
}

function AvatarSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-[var(--page-border)] bg-white p-3">
      <div className="aspect-square rounded-2xl bg-neutral-200" />
      <div className="mx-auto mt-4 h-3 w-2/3 rounded bg-neutral-200" />
    </div>
  )
}

function SlotSkeleton() {
  return <div className="h-12 animate-pulse rounded-xl bg-neutral-100" />
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-[var(--brand)] bg-[var(--brand)]/5 p-6 text-center">
      <p className="text-sm text-[var(--brand)]">
        Κάτι πήγε στραβά κατά τη φόρτωση.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-md border border-[var(--brand)] px-5 py-2 text-sm font-semibold text-[var(--brand)] transition-all duration-300 ease-in-out hover:bg-[var(--brand)] hover:text-white"
      >
        Δοκίμασε ξανά
      </button>
    </div>
  )
}

export default function BookingForm() {
  const [services, setServices] = useState<Service[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loadingServices, setLoadingServices] = useState(true)
  const [loadingBarbers, setLoadingBarbers] = useState(true)
  const [servicesError, setServicesError] = useState(false)
  const [barbersError, setBarbersError] = useState(false)

  const [step, setStep] = useState<BookingStep>(1)
  const [pet, setPet] = useState<PetDraft>(EMPTY_PET)
  const [savedPets, setSavedPets] = useState<PetDraft[]>([])
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([])
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()))
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [bookingNotes, setBookingNotes] = useState('')
  // Services whose description the visitor has expanded.
  const [openDescriptions, setOpenDescriptions] = useState<Set<string>>(new Set())

  function toggleDescription(id: string) {
    setOpenDescriptions((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const [submittingBooking, setSubmittingBooking] = useState(false)
  const [bookingError, setBookingError] = useState<'failed' | 'blocked' | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [confirmedBooking, setConfirmedBooking] = useState<BookingCreationResponse | null>(null)
  const [customerEmailDelivery, setCustomerEmailDelivery] =
    useState<EmailDeliveryStatus | null>(null)
  const [failedBarberImages, setFailedBarberImages] = useState<
    Record<string, boolean>
  >({})

  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotsError, setSlotsError] = useState(false)

  const [scheduleExceptions, setScheduleExceptions] = useState<
    NormalizedScheduleException[]
  >([])
  const [timeOff, setTimeOff] = useState<TimeOffRange[]>([])

  const today = startOfDay(new Date())
  const maxBookingDate = getMaxBookingDate(today)
  const calendarDays = buildCalendarGrid(calendarMonth)
  const canGoPreviousMonth = calendarMonth > startOfMonth(today)
  const canGoNextMonth = addMonths(calendarMonth, 1) <= startOfMonth(maxBookingDate)
  const brandStyle = SITE_THEME

  async function loadServices() {
    setLoadingServices(true)
    setServicesError(false)
    try {
      const res = await fetch('/api/services')
      if (!res.ok) throw new Error('Request failed')
      setServices(await res.json())
    } catch {
      setServicesError(true)
    } finally {
      setLoadingServices(false)
    }
  }

  async function loadBarbers() {
    setLoadingBarbers(true)
    setBarbersError(false)
    try {
      const res = await fetch('/api/barbers')
      if (!res.ok) throw new Error('Request failed')
      setBarbers(await res.json())
    } catch {
      setBarbersError(true)
    } finally {
      setLoadingBarbers(false)
    }
  }

  async function loadScheduleExceptions() {
    try {
      const res = await fetch('/api/schedule-exceptions')
      if (!res.ok) throw new Error('Request failed')
      const data = (await res.json()) as {
        exceptions: Array<{
          dateKey: string
          barberName: string | null
          type: string
          slotTime: string | null
        }>
        timeOff: TimeOffRange[]
      }
      setTimeOff(data.timeOff)
      setScheduleExceptions(
        data.exceptions.flatMap((item) =>
          isScheduleExceptionType(item.type)
            ? [
                {
                  dateKey: item.dateKey,
                  barberName: item.barberName,
                  type: item.type,
                  slotTime: item.slotTime,
                },
              ]
            : [],
        ),
      )
    } catch {
      // Calendar still works without overrides; default rules apply.
      setScheduleExceptions([])
      setTimeOff([])
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => {
      void loadServices()
      void loadBarbers()
      void loadScheduleExceptions()
      const profile = loadSavedProfile()
      if (profile) {
        setCustomerName(profile.name)
        setCustomerPhone(profile.phone)
        setCustomerEmail(profile.email)
        setSavedPets(profile.pets)
        if (profile.pets.length === 1) setPet(profile.pets[0])
      }
    })
  }, [])

  function updatePet(changes: Partial<PetDraft>) {
    const next = { ...pet, ...changes }
    setPet(next)
    // Services and add-ons for the other species no longer apply.
    if (changes.species && selectedService && !servesSpecies(selectedService, changes.species)) {
      setSelectedService(null)
    }
    if (changes.species) {
      setSelectedAddonIds((current) =>
        current.filter((id) => {
          const addon = services.find((item) => item.id === id)
          return addon ? servesSpecies(addon, changes.species ?? null) : false
        }),
      )
    }
  }

  function chooseSavedPet(saved: PetDraft) {
    updatePet(saved)
  }

  function toggleAddon(id: string) {
    setSelectedAddonIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  const petReady = Boolean(pet.name.trim() && pet.species && pet.size)
  const mainServices = services.filter((item) => !item.isAddon && servesSpecies(item, pet.species))
  const addonServices = services.filter((item) => item.isAddon && servesSpecies(item, pet.species))
  const selectedAddons = addonServices.filter((item) => selectedAddonIds.includes(item.id))
  const serviceQuote = selectedService ? quoteService(selectedService, pet.size) : null
  const addonQuotes = selectedAddons.map((item) => ({ ...item, ...quoteService(item, pet.size) }))
  const totalPrice =
    (serviceQuote?.price ?? 0) + addonQuotes.reduce((sum, item) => sum + item.price, 0)
  const totalDuration =
    (serviceQuote?.duration ?? 0) + addonQuotes.reduce((sum, item) => sum + item.duration, 0)
  const addonKey = selectedAddons.map((item) => item.id).join(',')

  useEffect(() => {
    if (!selectedDate || !selectedBarber || !selectedService) {
      queueMicrotask(() => setSlots([]))
      return
    }
    let active = true
    const controller = new AbortController()
    queueMicrotask(() => {
      if (!active) return
      setLoadingSlots(true)
      setSlotsError(false)
      setSelectedTime(null)
    })

    fetch(
      `/api/available-slots?${new URLSearchParams({
        barberId: selectedBarber.id,
        serviceId: selectedService.id,
        date: selectedDate,
        size: pet.size ?? '',
        addons: addonKey,
      })}`,
      { signal: controller.signal },
    )
      .then((res) => {
        if (!res.ok) throw new Error('Request failed')
        return res.json()
      })
      .then((data: Slot[]) => {
        if (active) setSlots(data)
      })
      .catch((err: unknown) => {
        if (active && (err as Error).name !== 'AbortError') {
          setSlotsError(true)
        }
      })
      .then(() => {
        if (active) setLoadingSlots(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [selectedDate, selectedBarber, selectedService, pet.size, addonKey])

  const stepDone: Record<number, boolean> = {
    1: petReady,
    2: Boolean(selectedService),
    3: Boolean(selectedBarber),
    4: Boolean(selectedDate && selectedTime),
    5: Boolean(
      customerName.trim() &&
        normalizeGreekMobilePhone(customerPhone) &&
        isValidCustomerEmail(customerEmail),
    ),
  }

  const canReach = (n: number) =>
    n === 1 ||
    (n === 2 && petReady) ||
    (n === 3 && petReady && Boolean(selectedService)) ||
    (n === 4 && petReady && Boolean(selectedService && selectedBarber)) ||
    (n === 5 &&
      petReady &&
      Boolean(selectedService && selectedBarber && selectedDate && selectedTime))

  const normalizedCustomerPhone = normalizeGreekMobilePhone(customerPhone)

  const canProceed =
    step === 1
      ? petReady
      : step === 2
        ? Boolean(selectedService)
        : step === 3
          ? Boolean(selectedService && selectedBarber)
          : step === 4
            ? Boolean(selectedDate && selectedTime)
            : Boolean(
              customerName.trim() &&
                normalizedCustomerPhone &&
                isValidCustomerEmail(customerEmail),
            ) &&
            !submittingBooking

  async function handleNext() {
    if (step === 1 && petReady) setStep(2)
    else if (step === 2 && selectedService) setStep(3)
    else if (step === 3 && selectedService && selectedBarber) setStep(4)
    else if (step === 4 && selectedDate && selectedTime) setStep(5)
    else if (
      step === 5 &&
      petReady &&
      pet.species &&
      pet.size &&
      selectedService &&
      selectedBarber &&
      selectedDate &&
      selectedTime &&
      customerName.trim() &&
      normalizedCustomerPhone &&
      isValidCustomerEmail(customerEmail)
    ) {
      setSubmittingBooking(true)
      setBookingError(null)
      try {
        const res = await fetch('/api/bookings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            serviceId: selectedService.id,
            barberId: selectedBarber.id,
            date: selectedDate,
            slotTime: selectedTime,
            customerName: customerName.trim(),
            customerPhone: normalizedCustomerPhone,
            customerEmail: customerEmail.trim(),
            notes: bookingNotes.trim() || null,
            addonIds: selectedAddons.map((item) => item.id),
            pet: {
              name: pet.name.trim(),
              species: pet.species,
              size: pet.size,
              breed: pet.breed.trim() || null,
              coat: pet.coat,
              temperament: pet.temperament,
              healthNotes: pet.healthNotes.trim() || null,
              vaccinated: pet.vaccinated,
            },
          }),
        })

        if (res.status === 403) {
          setBookingError('blocked')
          return
        }
        if (!res.ok) throw new Error('Booking failed')
        const result = (await res.json()) as BookingCreationResponse
        setConfirmedBooking(result)
        setCustomerEmailDelivery(
          result.notificationDelivery?.customerEmail ??
            (customerEmail.trim() ? 'failed' : 'skipped'),
        )
        setConfirmed(true)
        const cleanPet = { ...pet, name: pet.name.trim() }
        const pets = [
          cleanPet,
          ...savedPets.filter((item) => item.name.toLowerCase() !== cleanPet.name.toLowerCase()),
        ].slice(0, 6)
        setSavedPets(pets)
        saveProfile({ name: customerName.trim(), phone: customerPhone, email: customerEmail.trim(), pets })
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } catch {
        setBookingError('failed')
      } finally {
        setSubmittingBooking(false)
      }
    }
  }

  function goToStep(n: number) {
    if (canReach(n)) setStep(n as BookingStep)
  }

  // Starts a fresh booking from the success screen.
  function resetBooking() {
    setConfirmed(false)
    setConfirmedBooking(null)
    setSelectedTime(null)
    setSelectedDate(null)
    setBookingNotes('')
    setSelectedAddonIds([])
    setStep(1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleSelectService(service: Service) {
    setSelectedService(service)
  }

  const successCard = (confirmed &&
    selectedService &&
    selectedBarber &&
    selectedDate &&
    selectedTime &&
    customerName.trim() &&
    normalizedCustomerPhone) ? (
        <div className="animate-fade-in w-full max-w-md rounded-3xl border border-[var(--page-border)] bg-white p-7 text-center shadow-md sm:p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_8px_24px_rgba(16,185,129,0.28)]">
            <CheckIcon className="h-8 w-8" />
          </div>
          <h2 className="mt-6 text-2xl font-bold tracking-tight text-neutral-900">
            Το ραντεβού σας κατοχυρώθηκε με επιτυχία! 🎉
          </h2>
          {customerEmail.trim() ? (
            customerEmailDelivery === 'sent' ? (
              <p className="mt-3 text-sm leading-6 text-neutral-500">
                Το email επιβεβαίωσης στάλθηκε. Αν δεν εμφανίζεται στα εισερχόμενα,
                ελέγξτε και τον φάκελο Ανεπιθύμητα / Spam.
              </p>
            ) : (
              <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-900">
                Η κράτηση ολοκληρώθηκε, αλλά η υπηρεσία email δεν αποδέχτηκε την
                αποστολή. Η κράτηση έχει αποθηκευτεί κανονικά στο σύστημα.
              </p>
            )
          ) : (
            <p className="mt-3 text-sm leading-6 text-neutral-500">
              Δεν δηλώθηκε email. Τα στοιχεία του ραντεβού εμφανίζονται παρακάτω.
            </p>
          )}
          <div className="mt-6 space-y-3 rounded-2xl border border-[var(--page-border)] bg-neutral-50 p-4 text-left text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-500">Κατοικίδιο</span>
              <span className="text-right font-bold text-neutral-900">
                {pet.name.trim()}
                {pet.breed.trim() ? ` · ${pet.breed.trim()}` : ''}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-500">Υπηρεσία</span>
              <span className="text-right font-bold text-neutral-900">
                {selectedService.name}
                {selectedAddons.length > 0 && (
                  <span className="block text-xs font-medium text-neutral-500">
                    + {selectedAddons.map((item) => item.name).join(', ')}
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-500">Σύνολο</span>
              <span className="font-bold text-neutral-900">
                {formatPrice(totalPrice)} · {formatDuration(totalDuration)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-500">{SHOP.labels.staff}</span>
              <span className="font-bold text-neutral-900">
                {confirmedBooking?.barber?.name ?? selectedBarber.name}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-500">Ημερομηνία</span>
              <span className="font-bold text-neutral-900">
                {formatDateLong(selectedDate)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-500">Ώρα</span>
              <span className="font-bold text-neutral-900">{selectedTime}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-500">Πελάτης</span>
              <span className="font-bold text-neutral-900">
                {customerName.trim()}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-500">Κινητό</span>
              <span className="font-bold text-neutral-900">
                {normalizedCustomerPhone}
              </span>
            </div>
          </div>
          {confirmedBooking?.calendar && (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Προσθήκη στο ημερολόγιο
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a
                  href={confirmedBooking.calendar.google}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-[var(--page-border)] px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
                >
                  Google
                </a>
                <a
                  href={confirmedBooking.calendar.ics}
                  className="rounded-full border border-[var(--page-border)] px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
                >
                  iPhone / Outlook
                </a>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={resetBooking}
            className="mt-6 w-full rounded-full bg-[var(--brand)] px-5 py-3 text-sm font-bold text-white transition hover:brightness-110"
          >
            Κλείσε νέο ραντεβού
          </button>
        </div>
  ) : null


  const hasAvailableSlot = slots.some((s) => s.available)

  return (
    <div
      className="min-h-screen bg-[var(--page-bg)] font-sans text-neutral-900"
      style={brandStyle}
    >
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col lg:max-w-6xl px-4 pb-36 pt-5 sm:px-6 sm:pb-40 sm:pt-8">
        <header className="relative text-center">
          <SocialLinks className="absolute left-0 top-0" />
          <div className="mx-auto relative h-16 w-16 overflow-hidden rounded-full border border-[var(--page-border)] bg-white shadow-sm">
            <Image
              src={SHOP.logoUrl}
              alt={`${SHOP.name} logo`}
              fill
              priority
              sizes="64px"
              className="object-cover"
            />
          </div>
          <p
            className="mt-3 text-sm font-bold uppercase tracking-[0.28em]"
            style={{ color: SHOP.primaryColor }}
          >
            {SHOP.name}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
            Κλείσε το ραντεβού σου
          </h1>
        </header>

        {successCard ? (
          <div className="mt-8 flex flex-1 justify-center">{successCard}</div>
        ) : (
        <>
        <div className="mt-7 rounded-3xl border border-[var(--page-border)] bg-white p-3 shadow-sm sm:p-4">
          <Stepper
            step={step}
            done={stepDone}
            canReach={canReach}
            onGo={goToStep}
          />
        </div>

        <section
          key={step}
          className="animate-fade-in mt-8 flex-1 transition-all duration-300 ease-in-out"
        >
          {step === 1 && (
            <div className="mx-auto max-w-2xl space-y-6">
              <div>
                <h2 className={stepHeaderClass}>Το κατοικίδιό σου</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  {SHOP.bookingSubtitle}
                </p>
              </div>

              {savedPets.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    Τα κατοικίδιά σου
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {savedPets.map((saved) => (
                      <button
                        key={saved.name}
                        type="button"
                        onClick={() => chooseSavedPet(saved)}
                        className={`${chipClass(pet.name.trim().toLowerCase() === saved.name.toLowerCase())} py-2`}
                      >
                        <span aria-hidden>{saved.species === 'CAT' ? '🐈' : '🐕'}</span> {saved.name}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPet(EMPTY_PET)}
                      className={`${chipClass(false)} py-2`}
                    >
                      + Νέο κατοικίδιο
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-5 rounded-2xl border border-[var(--page-border)] bg-white p-5 shadow-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Είδος</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {SPECIES.map((species) => (
                      <button
                        key={species}
                        type="button"
                        aria-pressed={pet.species === species}
                        onClick={() => updatePet({ species })}
                        className={`${chipClass(pet.species === species)} flex items-center justify-center gap-2 py-4 text-base`}
                      >
                        <span aria-hidden className="text-2xl">{species === 'DOG' ? '🐕' : '🐈'}</span>
                        {SPECIES_LABELS[species]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                      Όνομα
                    </span>
                    <input
                      type="text"
                      required
                      maxLength={40}
                      value={pet.name}
                      onChange={(event) => updatePet({ name: event.target.value })}
                      placeholder="π.χ. Μπέλα"
                      className={`${inputClass} mt-2 pl-4`}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                      Ράτσα <span className="normal-case tracking-normal text-neutral-400">(προαιρετικό)</span>
                    </span>
                    <input
                      type="text"
                      maxLength={60}
                      list="pet-breeds"
                      value={pet.breed}
                      onChange={(event) => updatePet({ breed: event.target.value })}
                      placeholder="π.χ. Μαλτέζ"
                      className={`${inputClass} mt-2 pl-4`}
                    />
                    <datalist id="pet-breeds">
                      {COMMON_BREEDS.map((breed) => (
                        <option key={breed} value={breed} />
                      ))}
                    </datalist>
                  </label>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Μέγεθος</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {PET_SIZES.map((size) => (
                      <button
                        key={size}
                        type="button"
                        aria-pressed={pet.size === size}
                        onClick={() => updatePet({ size })}
                        className={chipClass(pet.size === size)}
                      >
                        <span className="block">{PET_SIZE_LABELS[size].label}</span>
                        <span className="mt-0.5 block text-xs font-normal text-neutral-500">
                          {PET_SIZE_LABELS[size].hint}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    Τρίχωμα <span className="normal-case tracking-normal text-neutral-400">(προαιρετικό)</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {COAT_TYPES.map((coat) => (
                      <button
                        key={coat}
                        type="button"
                        aria-pressed={pet.coat === coat}
                        onClick={() => updatePet({ coat: pet.coat === coat ? null : coat })}
                        className={`${chipClass(pet.coat === coat)} py-2`}
                      >
                        {COAT_LABELS[coat]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    Συμπεριφορά <span className="normal-case tracking-normal text-neutral-400">(προαιρετικό)</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {TEMPERAMENTS.map((temperament) => (
                      <button
                        key={temperament}
                        type="button"
                        aria-pressed={pet.temperament === temperament}
                        onClick={() =>
                          updatePet({ temperament: pet.temperament === temperament ? null : temperament })
                        }
                        className={`${chipClass(pet.temperament === temperament)} py-2`}
                      >
                        {TEMPERAMENT_LABELS[temperament]}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    Υγεία / αλλεργίες <span className="normal-case tracking-normal text-neutral-400">(προαιρετικό)</span>
                  </span>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={pet.healthNotes}
                    onChange={(event) => updatePet({ healthNotes: event.target.value })}
                    placeholder="π.χ. Ευαίσθητο δέρμα, πρόβλημα στο πίσω πόδι"
                    className="mt-2 w-full resize-none rounded-2xl border border-[var(--page-border)] bg-white px-4 py-3 text-base text-neutral-900 outline-none transition-all duration-300 ease-in-out placeholder:text-neutral-400 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]"
                  />
                </label>

                <label className="flex cursor-pointer items-start gap-3 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={pet.vaccinated}
                    onChange={(event) => updatePet({ vaccinated: event.target.checked })}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)]"
                  />
                  Τα εμβόλια και η αντιπαρασιτική αγωγή είναι σε ισχύ.
                </label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className={stepHeaderClass}>Επίλεξε υπηρεσία</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  Τιμές και διάρκεια για {pet.name.trim() || 'το κατοικίδιό σου'}
                  {pet.size ? ` (${PET_SIZE_LABELS[pet.size].label.toLowerCase()} μέγεθος)` : ''}.
                </p>
              </div>

              <div
                className="space-y-3"
              >
                {loadingServices ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <CardSkeleton key={i} />
                  ))
                ) : servicesError ? (
                  <ErrorState onRetry={loadServices} />
                ) : (
                  groupByCategory(mainServices).map(([category, items]) => (
                  <div key={category || 'none'} className="grid gap-3 lg:grid-cols-2 lg:items-start lg:gap-4">
                    {category && (
                      <h3 className="pt-2 text-sm font-bold text-neutral-900 lg:col-span-2">{category}</h3>
                    )}
                  {items.map((service) => {
                    const isSelected = selectedService?.id === service.id
                    const isOpen = openDescriptions.has(service.id)
                    const quote = quoteService(service, pet.size)
                    return (
                      <div
                        key={service.id}
                        className={`group rounded-2xl border shadow-sm transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-md ${
                          isSelected
                            ? 'border-[var(--brand)] bg-[var(--brand)]/[0.06] ring-1 ring-[var(--brand)]'
                            : 'border-[var(--brand)] bg-white hover:bg-neutral-50'
                        }`}
                      >
                      <button
                        type="button"
                        onClick={() => handleSelectService(service)}
                        aria-pressed={isSelected}
                        className="flex w-full items-center justify-between gap-4 p-5 text-left"
                      >
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-bold text-neutral-900 sm:text-lg">
                            {service.name}
                          </h3>
                          <div className="mt-2 flex items-center gap-2 text-sm text-neutral-500">
                            <ClockIcon className="h-4 w-4 text-[var(--brand)]" />
                            <span>{formatDuration(quote.duration)}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                          <span className="text-lg font-bold tabular-nums text-neutral-900">
                            {pet.size ? formatPrice(quote.price) : `από ${formatPrice(startingPrice(service))}`}
                          </span>
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-full border transition-all duration-300 ease-in-out ${
                              isSelected
                                ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
                                : 'border-neutral-300 text-transparent group-hover:border-[var(--brand)]'
                            }`}
                          >
                            <CheckIcon className="h-4 w-4" />
                          </span>
                        </div>
                      </button>
                      {service.description && (
                        <div className="-mt-3 px-5 pb-4">
                          <button
                            type="button"
                            onClick={() => toggleDescription(service.id)}
                            aria-expanded={isOpen}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--brand)] hover:underline"
                          >
                            Λεπτομέρειες
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              aria-hidden
                              className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                            >
                              <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                          {isOpen && (
                            <p className="animate-fade-in mt-2 whitespace-pre-line text-sm leading-6 text-neutral-500">
                              {service.description}
                            </p>
                          )}
                        </div>
                      )}
                      </div>
                    )
                  })}
                  </div>
                  ))
                )}
              </div>
              {!loadingServices && !servicesError && addonServices.length > 0 && (
                <div className="space-y-3 pt-4">
                  <div>
                    <h2 className={stepHeaderClass}>Έξτρα φροντίδα</h2>
                    <p className="mt-2 text-sm leading-6 text-neutral-500">
                      Πρόσθεσε ό,τι χρειάζεται, προαιρετικά.
                    </p>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {addonServices.map((addon) => {
                      const isOn = selectedAddonIds.includes(addon.id)
                      const quote = quoteService(addon, pet.size)
                      return (
                        <button
                          key={addon.id}
                          type="button"
                          aria-pressed={isOn}
                          onClick={() => toggleAddon(addon.id)}
                          className={`flex items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all duration-200 ${
                            isOn
                              ? 'border-[var(--brand)] bg-[var(--brand)]/[0.06] ring-1 ring-[var(--brand)]'
                              : 'border-[var(--page-border)] bg-white hover:border-[var(--brand)]'
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-bold text-neutral-900">{addon.name}</span>
                            {addon.description && (
                              <span className="mt-0.5 block text-xs leading-5 text-neutral-500">
                                {addon.description}
                              </span>
                            )}
                          </span>
                          <span className="flex shrink-0 items-center gap-3">
                            <span className="text-sm font-bold tabular-nums text-neutral-900">
                              +{formatPrice(quote.price)}
                            </span>
                            <span
                              className={`flex h-6 w-6 items-center justify-center rounded-md border ${
                                isOn
                                  ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
                                  : 'border-neutral-300 text-transparent'
                              }`}
                            >
                              <CheckIcon className="h-3.5 w-3.5" />
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {selectedService && (
                <div className="flex items-center justify-between rounded-2xl border border-[var(--page-border)] bg-white px-5 py-4 text-sm shadow-sm">
                  <span className="text-neutral-500">
                    Σύνολο · {formatDuration(totalDuration)}
                  </span>
                  <span className="text-lg font-bold tabular-nums text-neutral-900">
                    {formatPrice(totalPrice)}
                  </span>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className={stepHeaderClass}>Διάλεξε {SHOP.labels.staff.toLowerCase()}</h2>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {loadingBarbers ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <AvatarSkeleton key={i} />
                  ))
                ) : barbersError ? (
                  <div className="col-span-2 sm:col-span-3">
                    <ErrorState onRetry={loadBarbers} />
                  </div>
                ) : (
                  [...(barbers.length > 1 ? [ANY_BARBER_CHOICE] : []), ...barbers].map((barber) => {
                    const isSelected = selectedBarber?.id === barber.id
                    const isAny = barber.id === ANY_BARBER
                    const showImage =
                      Boolean(barber.image) && !failedBarberImages[barber.id]
                    const barberImageSrc = barber.image
                      ? withImageVersion(barber.image, barber.id)
                      : null
                    return (
                      <button
                        key={barber.id}
                        type="button"
                        onClick={() => setSelectedBarber(barber)}
                        className={`group rounded-2xl border bg-white p-3 text-left transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-md ${
                          isSelected
                            ? 'border-[var(--brand)] bg-[var(--brand)]/[0.06] ring-1 ring-[var(--brand)]'
                            : 'border-[var(--brand)] hover:bg-neutral-50'
                        }`}
                      >
                        <div className="relative mx-auto aspect-[4/5] w-full max-w-52 overflow-hidden rounded-2xl border border-[var(--page-border)] bg-neutral-100 transition-all duration-300 ease-in-out group-hover:border-[var(--brand)]">
                          {isAny ? (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-neutral-50 px-3 text-center text-neutral-500">
                              <UsersIcon className="h-12 w-12 text-[var(--brand)]" />
                              <span className="text-xs leading-5">Πρώτη διαθέσιμη ώρα με όποιον είναι ελεύθερος</span>
                            </div>
                          ) : showImage && barberImageSrc ? (
                            <Image
                              src={barberImageSrc}
                              alt={barber.name}
                              fill
                              unoptimized
                              sizes="(max-width: 640px) 46vw, 208px"
                              onError={() =>
                                setFailedBarberImages((current) => ({
                                  ...current,
                                  [barber.id]: true,
                                }))
                              }
                              className="object-contain object-center transition-transform duration-500 ease-in-out group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-4xl font-semibold text-neutral-400">
                              {barber.name.charAt(0)}
                            </div>
                          )}
                          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/5" />
                          {isSelected && (
                            <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-lg">
                              <CheckIcon className="h-4 w-4" />
                            </span>
                          )}
                        </div>
                        <div className="px-1 pb-1 pt-3">
                          <span className="block truncate text-sm font-bold text-neutral-900 sm:text-base">
                            {barber.name}
                          </span>
                          {barber.bio && (
                            <span className="mt-1 line-clamp-2 block text-xs leading-5 text-neutral-500">
                              {barber.bio}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-7">
              <div>
                <h2 className={stepHeaderClass}>Ημέρα και ώρα</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  Βρες το διαθέσιμο slot που ταιριάζει στο πρόγραμμά σου.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.9fr)] md:items-start">
                <section className="rounded-2xl border border-[var(--page-border)] bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold capitalize text-neutral-900">
                        {formatMonthTitle(calendarMonth)}
                      </h3>
                      <p className="mt-1 text-xs text-neutral-500">
                        Διαθέσιμες ημερομηνίες έως {formatDateLong(toDateKey(maxBookingDate))}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!canGoPreviousMonth}
                        onClick={() => setCalendarMonth((current) => addMonths(current, -1))}
                        aria-label="Προηγούμενος μήνας"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--page-border)] bg-white text-neutral-700 transition-colors hover:border-[var(--brand)] hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        disabled={!canGoNextMonth}
                        onClick={() => setCalendarMonth((current) => addMonths(current, 1))}
                        aria-label="Επόμενος μήνας"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--page-border)] bg-white text-neutral-700 transition-colors hover:border-[var(--brand)] hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        ›
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5">
                    {GR_WEEKDAYS_MON_FIRST.map((day) => (
                      <div
                        key={day}
                        className="pb-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400"
                      >
                        {day}
                      </div>
                    ))}
                    {calendarDays.map((day) => {
                      const key = toDateKey(day)
                      const isCurrentMonth = day.getMonth() === calendarMonth.getMonth()
                      const isPast = day < today
                      const isDisabled =
                        !isCurrentMonth ||
                        isPast ||
                        !selectedBarber ||
                        !(selectedBarber.id === ANY_BARBER ? barbers : [selectedBarber]).some(
                          (barber) =>
                            isDayBookable(
                              day,
                              getBarberPeriodsForDate(barber, key, scheduleExceptions, timeOff),
                              today,
                            ),
                        )
                      const isSelected = selectedDate === key
                      const isToday = key === toDateKey(today)

                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => {
                            setSelectedDate(key)
                            setSelectedTime(null)
                          }}
                          className={`relative flex aspect-square min-h-11 items-center justify-center rounded-xl border text-sm font-semibold transition-all duration-200 ease-in-out sm:min-h-14 ${
                            isSelected
                              ? 'border-[var(--brand)] bg-[var(--brand)] text-white shadow-sm'
                              : isDisabled
                                ? 'cursor-not-allowed border-transparent bg-neutral-50 text-neutral-300'
                                : 'border-[var(--page-border)] bg-white text-neutral-800 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:bg-neutral-50'
                          }`}
                        >
                          <span>{day.getDate()}</span>
                          {isToday && !isSelected && !isDisabled && (
                            <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-[var(--brand)]" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </section>

                <section className="rounded-2xl border border-[var(--page-border)] bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-5">
                    <h3 className="text-base font-bold text-neutral-900">
                      Διαθέσιμες ώρες
                    </h3>
                    <p className="mt-1 text-sm text-neutral-500">
                      {selectedDate ? formatDateLong(selectedDate) : 'Επίλεξε ημερομηνία'}
                    </p>
                  </div>

                  {!selectedDate ? (
                    <div className="rounded-2xl border border-dashed border-[var(--page-border)] bg-neutral-50 p-8 text-center text-sm text-neutral-500">
                      Διάλεξε πρώτα μια ημέρα.
                    </div>
                  ) : loadingSlots ? (
                    <div className="grid grid-cols-3 gap-2.5 md:grid-cols-2 lg:grid-cols-3">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <SlotSkeleton key={i} />
                      ))}
                    </div>
                  ) : slotsError ? (
                    <ErrorState onRetry={() => setSelectedDate(selectedDate)} />
                  ) : !hasAvailableSlot ? (
                    <div className="rounded-2xl border border-dashed border-[var(--page-border)] bg-neutral-50 p-8 text-center text-sm text-neutral-500">
                      Δεν υπάρχουν διαθέσιμες ώρες για αυτή την ημέρα.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2.5 md:grid-cols-2 lg:grid-cols-3">
                      {slots.map((slot) => {
                        const isSelected = selectedTime === slot.time
                        return (
                          <button
                            key={slot.time}
                            type="button"
                            disabled={!slot.available}
                            onClick={() => setSelectedTime(slot.time)}
                            className={`h-12 rounded-xl border text-sm font-semibold tabular-nums transition-all duration-300 ease-in-out ${
                              !slot.available
                                ? 'cursor-not-allowed border-neutral-100 bg-neutral-50 text-neutral-300 line-through'
                                : isSelected
                                  ? 'border-[var(--brand)] bg-[var(--brand)] text-white shadow-sm'
                                  : 'border-[var(--page-border)] bg-white text-neutral-800 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:bg-neutral-50'
                            }`}
                          >
                            {slot.time}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="mx-auto max-w-2xl space-y-5">
              <div>
                <h2 className={stepHeaderClass}>Στοιχεία Πελάτη</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  Συμπλήρωσε τα στοιχεία επικοινωνίας για την τελική
                  επιβεβαίωση.
                </p>
              </div>

              <div className="space-y-4 rounded-2xl border border-[var(--page-border)] bg-white p-5 shadow-sm">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    Όνοματεπώνυμο
                  </span>
                  <span className="relative mt-2 block">
                    <UserIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      autoComplete="name"
                      className={inputClass}
                    />
                  </span>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    Κινητό Τηλέφωνο
                  </span>
                  <span className="relative mt-2 block">
                    <PhoneIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="tel"
                      inputMode="numeric"
                      pattern="69[0-9]{8}"
                      required
                      value={customerPhone}
                      onChange={(event) =>
                        setCustomerPhone(toNationalPhoneInput(event.target.value))
                      }
                      onBlur={(event) =>
                        setCustomerPhone(toNationalPhoneInput(event.target.value))
                      }
                      autoComplete="tel"
                      className={inputClass}
                    />
                  </span>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    Email
                  </span>
                  <span className="relative mt-2 block">
                    <EmailIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="email"
                      required
                      value={customerEmail}
                      onChange={(event) => setCustomerEmail(event.target.value)}
                      autoComplete="email"
                      className={inputClass}
                    />
                  </span>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    Σχόλιο <span className="normal-case tracking-normal text-neutral-400">(προαιρετικό)</span>
                  </span>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={bookingNotes}
                    onChange={(event) => setBookingNotes(event.target.value)}
                    placeholder="π.χ. Θέλω κοντό κούρεμα για το καλοκαίρι"
                    className="mt-2 w-full resize-none rounded-2xl border border-[var(--page-border)] bg-white px-4 py-3 text-base text-neutral-900 outline-none transition-all duration-300 ease-in-out placeholder:text-neutral-400 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]"
                  />
                </label>
              </div>

              <p className="text-xs leading-5 text-neutral-500">
                Με την καταχώριση του ραντεβού αποδέχεσαι τους{' '}
                <Link
                  href="/booking-terms"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[var(--brand)] underline underline-offset-4"
                >
                  Όρους Κράτησης
                </Link>{' '}
                και επιβεβαιώνεις ότι ενημερώθηκες για την{' '}
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[var(--brand)] underline underline-offset-4"
                >
                  Πολιτική Απορρήτου
                </Link>
                .
              </p>

              {bookingError && (
                <div className="rounded-2xl border border-[var(--brand)] bg-[var(--brand)]/5 p-4 text-sm text-[var(--brand)]">
                  {bookingError === 'blocked' ? (
                    <>
                      Δεν είναι δυνατή η online κράτηση για αυτό το κινητό. Κάλεσέ μας στο{' '}
                      <a href={SHOP.phone.href} className="font-semibold underline underline-offset-4">
                        {SHOP.phone.label}
                      </a>{' '}
                      για να κλείσεις ραντεβού.
                    </>
                  ) : (
                    'Δεν μπορέσαμε να καταχωρήσουμε το ραντεβού. Δοκίμασε ξανά.'
                  )}
                </div>
              )}
            </div>
          )}
        </section>
        </>
        )}

        <ShopInfo schedules={barbers.map((barber) => barber.schedule)} />

        <footer className="mt-12 border-t border-[var(--page-border)] pt-6 text-center text-xs leading-5 text-neutral-500">
          <p className="font-semibold text-neutral-700">{SHOP.name}</p>
          <nav
            aria-label="Νομικές πληροφορίες"
            className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2"
          >
            <Link
              href="/booking-terms"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[var(--brand)] underline underline-offset-4"
            >
              Όροι Κράτησης
            </Link>
            <Link
              href="/privacy"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[var(--brand)] underline underline-offset-4"
            >
              Πολιτική Απορρήτου
            </Link>
          </nav>
        </footer>
      </main>

      {!successCard && (
      <div className="fixed inset-x-0 bottom-0 border-t border-[var(--page-border)] bg-[var(--page-bg)]/95 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-4 lg:max-w-6xl pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-4 sm:px-6">
          {step > 1 && (
            <button
              type="button"
              onClick={() =>
                setStep((current) => (current - 1) as BookingStep)
              }
              aria-label="Πίσω"
              className="flex min-h-12 shrink-0 items-center gap-2 rounded-md border border-[var(--page-border)] bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition-all duration-300 ease-in-out hover:border-[var(--brand)] hover:bg-neutral-50 active:scale-95 sm:px-5"
            >
              <ArrowIcon className="h-4 w-4 rotate-180" />
              <span className="hidden sm:inline">Πίσω</span>
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-neutral-900">
              {selectedService
                ? `${selectedService.name}${selectedAddons.length ? ` +${selectedAddons.length}` : ''} • ${formatPrice(totalPrice)}`
                : pet.name.trim()
                  ? `${pet.name.trim()} · επίλεξε υπηρεσία`
                  : 'Πες μας για το κατοικίδιό σου'}
            </p>
            <p className="mt-0.5 truncate text-xs text-neutral-500">
              {step === 5 && customerName.trim()
                ? customerName.trim()
                : selectedBarber
                  ? selectedBarber.name
                  : `Επίλεξε ${SHOP.labels.staff.toLowerCase()}`}
              {selectedDate && selectedTime
                ? ` · ${formatDateLong(selectedDate)} ${selectedTime}`
                : ''}
            </p>
          </div>
          <button
            type="button"
            disabled={!canProceed}
            onClick={handleNext}
            className={`flex min-h-12 shrink-0 items-center gap-2 rounded-md px-5 py-3 text-sm font-bold uppercase tracking-wide transition-all duration-300 ease-in-out sm:px-6 ${
              canProceed
                ? 'bg-[var(--brand)] text-white shadow-sm hover:bg-[var(--brand)] active:scale-95'
                : 'cursor-not-allowed bg-neutral-100 text-neutral-400'
            }`}
          >
            <span className="max-w-[9.5rem] truncate sm:max-w-none">
              {step === 5
                ? submittingBooking
                  ? 'Καταχώρηση...'
                  : 'Επιβεβαίωση Ραντεβού'
                : 'Επόμενο'}
            </span>
            {step === 5 ? (
              <CheckIcon className="h-4 w-4" />
            ) : (
              <ArrowIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
      )}
    </div>
  )
}
