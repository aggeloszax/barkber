'use client'

import { useState } from 'react'
import {
  COAT_LABELS,
  COAT_TYPES,
  PET_SIZE_LABELS,
  PET_SIZES,
  SPECIES,
  SPECIES_LABELS,
  TEMPERAMENT_LABELS,
  TEMPERAMENTS,
  isCoatType,
  isPetSize,
  isSpecies,
  isTemperament,
} from '@/lib/pets'
import { type Pet, adminFetch, errorMessage } from '../_lib/admin-data'
import { AlertIcon, Button, Field, FormError, SelectInput, TextArea, TextInput } from './ui'

function label<T extends string>(labels: Record<T, string>, isValid: (v: unknown) => v is T, value: string | null) {
  if (!value) return null
  return isValid(value) ? labels[value] : value
}

// A pet's details with in-place editing, shown in the booking drawer and on
// the customer page.
export function PetCard({ pet, onSaved }: { pet: Pet; onSaved: (pet: Pet) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(pet)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const species = label(SPECIES_LABELS, isSpecies, pet.species)
  const size = isPetSize(pet.size) ? `${PET_SIZE_LABELS[pet.size].label} (${PET_SIZE_LABELS[pet.size].hint})` : pet.size
  const coat = label(COAT_LABELS, isCoatType, pet.coat)
  const temperament = label(TEMPERAMENT_LABELS, isTemperament, pet.temperament)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const saved = await adminFetch<Pet>(`/api/admin/pets/${pet.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: draft.name,
          species: draft.species,
          size: draft.size,
          breed: draft.breed,
          coat: draft.coat,
          temperament: draft.temperament,
          healthNotes: draft.healthNotes,
          vaccinated: draft.vaccinated,
        }),
      })
      onSaved(saved)
      setEditing(false)
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="space-y-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-2)] p-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Όνομα">
            <TextInput value={draft.name} maxLength={40} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label="Ράτσα">
            <TextInput
              value={draft.breed ?? ''}
              maxLength={60}
              onChange={(e) => setDraft({ ...draft, breed: e.target.value || null })}
            />
          </Field>
          <Field label="Είδος">
            <SelectInput value={draft.species} onChange={(e) => setDraft({ ...draft, species: e.target.value })}>
              {SPECIES.map((value) => (
                <option key={value} value={value}>
                  {SPECIES_LABELS[value]}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Μέγεθος">
            <SelectInput value={draft.size} onChange={(e) => setDraft({ ...draft, size: e.target.value })}>
              {PET_SIZES.map((value) => (
                <option key={value} value={value}>
                  {PET_SIZE_LABELS[value].label} · {PET_SIZE_LABELS[value].hint}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Τρίχωμα">
            <SelectInput value={draft.coat ?? ''} onChange={(e) => setDraft({ ...draft, coat: e.target.value || null })}>
              <option value="">Δεν δηλώθηκε</option>
              {COAT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {COAT_LABELS[value]}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Συμπεριφορά">
            <SelectInput
              value={draft.temperament ?? ''}
              onChange={(e) => setDraft({ ...draft, temperament: e.target.value || null })}
            >
              <option value="">Δεν δηλώθηκε</option>
              {TEMPERAMENTS.map((value) => (
                <option key={value} value={value}>
                  {TEMPERAMENT_LABELS[value]}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <Field label="Υγεία / αλλεργίες">
          <TextArea
            rows={2}
            maxLength={500}
            value={draft.healthNotes ?? ''}
            onChange={(e) => setDraft({ ...draft, healthNotes: e.target.value || null })}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.vaccinated}
            onChange={(e) => setDraft({ ...draft, vaccinated: e.target.checked })}
            className="h-4 w-4 accent-[var(--admin-accent)]"
          />
          Εμβόλια σε ισχύ
        </label>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" disabled={saving} onClick={() => setEditing(false)}>
            Άκυρο
          </Button>
          <Button size="sm" variant="primary" disabled={saving || !draft.name.trim()} onClick={() => void save()}>
            {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-2)] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">
            <span aria-hidden>{pet.species === 'CAT' ? '🐈' : '🐕'}</span> {pet.name}
          </p>
          <p className="mt-0.5 text-[13px] text-[var(--admin-muted)]">
            {[species, pet.breed, size].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setDraft(pet)
            setEditing(true)
          }}
          className="shrink-0 text-[13px] font-medium text-[var(--admin-accent)] hover:underline"
        >
          Αλλαγή
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
        {coat && <span className="rounded-full bg-white px-2 py-0.5 ring-1 ring-[var(--admin-border)]">Τρίχωμα: {coat}</span>}
        {temperament && (
          <span
            className={`rounded-full px-2 py-0.5 ring-1 ${
              pet.temperament === 'REACTIVE'
                ? 'bg-red-50 text-red-800 ring-red-200'
                : pet.temperament === 'NERVOUS'
                  ? 'bg-amber-50 text-amber-900 ring-amber-200'
                  : 'bg-white ring-[var(--admin-border)]'
            }`}
          >
            {temperament}
          </span>
        )}
        <span
          className={`rounded-full px-2 py-0.5 ring-1 ${
            pet.vaccinated ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-amber-50 text-amber-900 ring-amber-200'
          }`}
        >
          {pet.vaccinated ? 'Εμβόλια σε ισχύ' : 'Εμβόλια: δεν δηλώθηκαν'}
        </span>
      </div>
      {pet.healthNotes && (
        <p className="mt-2 flex gap-2 text-sm">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <span className="whitespace-pre-line">{pet.healthNotes}</span>
        </p>
      )}
    </div>
  )
}
