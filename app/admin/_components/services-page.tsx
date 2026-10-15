'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { groupByCategory } from '@/lib/catalog'
import {
  PET_SIZE_LABELS,
  PET_SIZES,
  type PetSize,
  SPECIES,
  SPECIES_LABELS,
  isSpecies,
  parseSizePricing,
} from '@/lib/pets'
import { type Service, adminFetch, errorMessage, formatPrice } from '../_lib/admin-data'
import {
  Button,
  Card,
  ConfirmButton,
  EmptyState,
  ErrorNotice,
  Field,
  FormError,
  IconButton,
  Modal,
  PageHeader,
  PencilIcon,
  PlusIcon,
  SelectInput,
  Skeleton,
  TextArea,
  TextInput,
} from './ui'

type Editing = { service: Service | null; isAddon: boolean }

function sortServices(list: Service[]) {
  return [...list].sort((a, b) => a.price - b.price)
}

// "25€ έως 60€" and "45′ έως 120′" over the base and every size row.
function priceRange(service: Service) {
  const rows = [{ price: service.price, duration: service.duration }, ...Object.values(parseSizePricing(service.sizePricing))]
  const prices = rows.map((row) => row.price)
  const durations = rows.map((row) => row.duration)
  const span = (values: number[], format: (value: number) => string) => {
    const min = Math.min(...values)
    const max = Math.max(...values)
    return min === max ? format(min) : `${format(min)} έως ${format(max)}`
  }
  return {
    price: span(prices, formatPrice),
    duration: span(durations, (value) => `${value}′`),
  }
}

export function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setServices(await adminFetch<Service[]>('/api/services'))
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [])

  async function handleDelete(service: Service) {
    setDeletingId(service.id)
    setError(null)
    try {
      await adminFetch(`/api/services?id=${encodeURIComponent(service.id)}`, { method: 'DELETE' })
      setServices((current) => current.filter((item) => item.id !== service.id))
    } catch (deleteError) {
      setError(errorMessage(deleteError))
    } finally {
      setDeletingId(null)
    }
  }

  function renderList(list: Service[], emptyTitle: string) {
    if (loading) {
      return (
        <div className="space-y-3 p-5">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-12" />
          ))}
        </div>
      )
    }
    if (list.length === 0) {
      return (
        <div className="p-5">
          <EmptyState title={emptyTitle} />
        </div>
      )
    }
    return groupByCategory(list).map(([category, items]) => (
      <div key={category || 'none'}>
        {(category || list.some((item) => item.category)) && (
          <p className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-5 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
            {category || 'Χωρίς κατηγορία'}
          </p>
        )}
        <ul className="divide-y divide-[var(--admin-border)]">
          {items.map((service) => {
            const range = priceRange(service)
            return (
              <li key={service.id} className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {service.name}
                    {isSpecies(service.species) && (
                      <span className="ml-2 rounded-full bg-[var(--admin-accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--admin-accent)]">
                        Μόνο {SPECIES_LABELS[service.species].toLowerCase()}
                      </span>
                    )}
                  </p>
                  <p className="text-[13px] text-[var(--admin-muted)]">{range.duration}</p>
                  {service.description && (
                    <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-[13px] text-[var(--admin-muted)]">
                      {service.description}
                    </p>
                  )}
                </div>
                <p className="text-right text-base font-semibold tabular-nums">{range.price}</p>
                <div className="flex items-center gap-1">
                  <IconButton
                    label={`Επεξεργασία ${service.name}`}
                    onClick={() => setEditing({ service, isAddon: service.isAddon })}
                  >
                    <PencilIcon className="h-4 w-4" />
                  </IconButton>
                  <ConfirmButton
                    label="Διαγραφή"
                    confirmLabel="Σίγουρα;"
                    busy={deletingId === service.id}
                    onConfirm={() => void handleDelete(service)}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    ))
  }

  const mainServices = services.filter((item) => !item.isAddon)
  const addons = services.filter((item) => item.isAddon)

  return (
    <>
      <PageHeader
        title="Υπηρεσίες"
        description="Ο τιμοκατάλογος που βλέπουν οι πελάτες στην κράτηση, με τιμή ανά μέγεθος κατοικιδίου."
        actions={
          <Button variant="primary" onClick={() => setEditing({ service: null, isAddon: false })}>
            <PlusIcon className="h-4 w-4" />
            Νέα υπηρεσία
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorNotice message={error} />
        </div>
      )}

      <Card>{renderList(mainServices, 'Δεν υπάρχουν υπηρεσίες ακόμα.')}</Card>

      <div className="mb-3 mt-8 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Έξτρα (add-ons)</h2>
          <p className="text-[13px] text-[var(--admin-muted)]">
            Προστίθενται πάνω σε μια υπηρεσία, π.χ. κόψιμο νυχιών, καθαρισμός αυτιών.
          </p>
        </div>
        <Button onClick={() => setEditing({ service: null, isAddon: true })}>
          <PlusIcon className="h-4 w-4" />
          Νέο έξτρα
        </Button>
      </div>
      <Card>{renderList(addons, 'Δεν υπάρχουν έξτρα ακόμα.')}</Card>

      <p className="mt-3 text-xs text-[var(--admin-muted)]">
        Μια υπηρεσία με ραντεβού δεν διαγράφεται, για να μείνει σωστό το ιστορικό. Οι αλλαγές σε
        διάρκεια και τιμή ισχύουν για τις νέες κρατήσεις.
      </p>

      {editing && (
        <ServiceModal
          service={editing.service}
          isAddon={editing.isAddon}
          categories={Array.from(
            new Set(
              services
                .filter((item) => item.isAddon === editing.isAddon)
                .flatMap((item) => (item.category ? [item.category] : [])),
            ),
          )}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setServices((current) =>
              sortServices(
                editing.service
                  ? current.map((item) => (item.id === saved.id ? saved : item))
                  : [...current, saved],
              ),
            )
            setEditing(null)
          }}
        />
      )}
    </>
  )
}

type SizeDraft = Record<PetSize, { price: string; duration: string }>

function ServiceModal({
  service,
  isAddon,
  categories,
  onClose,
  onSaved,
}: {
  service: Service | null
  isAddon: boolean
  categories: string[]
  onClose: () => void
  onSaved: (service: Service) => void
}) {
  const [name, setName] = useState(service?.name ?? '')
  const [duration, setDuration] = useState(String(service?.duration ?? (isAddon ? 15 : 60)))
  const [price, setPrice] = useState(String(service?.price ?? (isAddon ? 5 : 25)))
  const [species, setSpecies] = useState(service?.species ?? '')
  const [category, setCategory] = useState(service?.category ?? '')
  const [description, setDescription] = useState(service?.description ?? '')
  const [sizes, setSizes] = useState<SizeDraft>(() => {
    const saved = parseSizePricing(service?.sizePricing)
    return Object.fromEntries(
      PET_SIZES.map((size) => [
        size,
        { price: saved[size] ? String(saved[size].price) : '', duration: saved[size] ? String(saved[size].duration) : '' },
      ]),
    ) as SizeDraft
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setSize(size: PetSize, field: 'price' | 'duration', value: string) {
    setSizes((current) => ({ ...current, [size]: { ...current[size], [field]: value } }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // A size row counts when either field is filled; the empty one falls back
    // to the base value.
    const sizePricing = Object.fromEntries(
      PET_SIZES.flatMap((size) => {
        const row = sizes[size]
        if (!row.price.trim() && !row.duration.trim()) return []
        return [
          [
            size,
            {
              price: Number((row.price.trim() || price).replace(',', '.')),
              duration: Number(row.duration.trim() || duration),
            },
          ],
        ]
      }),
    )
    setSubmitting(true)
    setError(null)
    try {
      const saved = await adminFetch<Service>('/api/services', {
        method: service ? 'PATCH' : 'POST',
        body: JSON.stringify({
          id: service?.id,
          name: name.trim(),
          duration: Number(duration),
          price: Number(price.replace(',', '.')),
          species: species || null,
          isAddon,
          sizePricing,
          category: category.trim() || null,
          description: description.trim() || null,
        }),
      })
      onSaved(saved)
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setSubmitting(false)
    }
  }

  const noun = isAddon ? 'έξτρα' : 'υπηρεσία'

  return (
    <Modal
      title={service ? `Επεξεργασία: ${service.name}` : isAddon ? 'Νέο έξτρα' : 'Νέα υπηρεσία'}
      onClose={onClose}
      onSubmit={(event) => void handleSubmit(event)}
      submitLabel={service ? 'Αποθήκευση' : 'Προσθήκη'}
      submitting={submitting}
      wide
    >
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <Field label="Όνομα">
          <TextInput
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={isAddon ? 'π.χ. Κόψιμο νυχιών' : 'π.χ. Μπάνιο & κούρεμα'}
            autoFocus
          />
        </Field>
        <Field label="Για">
          <SelectInput value={species} onChange={(event) => setSpecies(event.target.value)}>
            <option value="">Σκύλους και γάτες</option>
            {SPECIES.map((value) => (
              <option key={value} value={value}>
                Μόνο {SPECIES_LABELS[value].toLowerCase()}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      <div>
        <p className="text-[13px] font-medium">Τιμή και διάρκεια ανά μέγεθος</p>
        <p className="mt-0.5 text-xs text-[var(--admin-muted)]">
          Η βασική γραμμή ισχύει για όσα μεγέθη αφήσεις κενά.
        </p>
        <div className="mt-2 overflow-hidden rounded-xl border border-[var(--admin-border)]">
          <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2 bg-[var(--admin-surface-2)] px-3 py-2 text-xs font-medium text-[var(--admin-muted)]">
            <span>Μέγεθος</span>
            <span>Τιμή (€)</span>
            <span>Λεπτά</span>
          </div>
          <div className="grid grid-cols-[1.4fr_1fr_1fr] items-center gap-2 border-t border-[var(--admin-border)] px-3 py-2">
            <span className="text-sm font-medium">Βασική</span>
            <TextInput inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} className="!mt-0" />
            <TextInput type="number" min={5} step={5} value={duration} onChange={(event) => setDuration(event.target.value)} className="!mt-0" />
          </div>
          {PET_SIZES.map((size) => (
            <div
              key={size}
              className="grid grid-cols-[1.4fr_1fr_1fr] items-center gap-2 border-t border-[var(--admin-border)] px-3 py-2"
            >
              <span className="text-sm">
                {PET_SIZE_LABELS[size].label}
                <span className="block text-[11px] text-[var(--admin-muted)]">{PET_SIZE_LABELS[size].hint}</span>
              </span>
              <TextInput
                inputMode="decimal"
                placeholder={price}
                value={sizes[size].price}
                onChange={(event) => setSize(size, 'price', event.target.value)}
                className="!mt-0"
              />
              <TextInput
                type="number"
                min={5}
                step={5}
                placeholder={duration}
                value={sizes[size].duration}
                onChange={(event) => setSize(size, 'duration', event.target.value)}
                className="!mt-0"
              />
            </div>
          ))}
        </div>
      </div>

      <Field label="Κατηγορία" hint={`Προαιρετικό. Κάθε ${noun} με ίδια κατηγορία εμφανίζεται μαζί, π.χ. «Μπάνιο», «Κούρεμα».`}>
        <TextInput
          list="service-categories"
          maxLength={40}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        />
        <datalist id="service-categories">
          {categories.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </Field>
      <Field label="Περιγραφή" hint="Προαιρετικό. Τι περιλαμβάνει, όπως το βλέπει ο πελάτης.">
        <TextArea rows={3} maxLength={600} value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <FormError message={error} />
    </Modal>
  )
}
