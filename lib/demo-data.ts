// Demo groomers and price list, used by POST /api/seed and
// scripts/seed-demo.mjs. Kept free of imports so plain Node can load it.

export const barbers = [
  { name: 'Μαρία', bio: 'Ειδική σε μικρόσωμες ράτσες και γάτες' },
  { name: 'Νίκος', bio: 'Hand stripping και μεγαλόσωμοι σκύλοι' },
]

// Demo price list: [small, medium, large, extra large] as [price €, minutes].
type Sizes = [[number, number], [number, number], [number, number], [number, number]]
function bySize(sizes: Sizes) {
  const [SMALL, MEDIUM, LARGE, XLARGE] = sizes.map(([price, duration]) => ({ price, duration }))
  return { SMALL, MEDIUM, LARGE, XLARGE }
}

export const services = [
  {
    name: 'Μπάνιο & στέγνωμα',
    category: 'Μπάνιο',
    species: 'DOG',
    price: 20,
    duration: 45,
    sizePricing: bySize([[20, 45], [28, 60], [35, 75], [45, 90]]),
    description: 'Μπάνιο με σαμπουάν για τον τύπο τριχώματος, στέγνωμα και βούρτσισμα.',
  },
  {
    name: 'Πλήρες grooming',
    category: 'Κούρεμα',
    species: 'DOG',
    price: 30,
    duration: 75,
    sizePricing: bySize([[30, 75], [40, 105], [55, 135], [70, 165]]),
    description: 'Μπάνιο, στέγνωμα, κούρεμα στο στυλ που θέλεις, νύχια και καθαρισμός αυτιών.',
  },
  {
    name: 'Κούρεμα κουταβιού',
    category: 'Κούρεμα',
    species: 'DOG',
    price: 22,
    duration: 45,
    sizePricing: bySize([[22, 45], [26, 60], [30, 60], [30, 60]]),
    description: 'Πρώτη γνωριμία με το grooming, για κουτάβια έως 6 μηνών. Ήπιο μπάνιο και ελαφρύ φρεσκάρισμα.',
  },
  {
    name: 'Ξεβούλιασμα (deshedding)',
    category: 'Μπάνιο',
    species: 'DOG',
    price: 30,
    duration: 60,
    sizePricing: bySize([[30, 60], [40, 75], [50, 90], [65, 120]]),
    description: 'Για σκύλους με διπλό τρίχωμα: απομάκρυνση νεκρής τρίχας, μπάνιο και στέγνωμα.',
  },
  {
    name: 'Grooming γάτας',
    category: 'Γάτες',
    species: 'CAT',
    price: 40,
    duration: 60,
    sizePricing: bySize([[40, 60], [45, 75], [50, 90], [50, 90]]),
    description: 'Ήρεμο περιβάλλον, μπάνιο ή στεγνό καθάρισμα, ξεμπέρδεμα και νύχια.',
  },
  {
    name: 'Lion cut γάτας',
    category: 'Γάτες',
    species: 'CAT',
    price: 50,
    duration: 75,
    sizePricing: {},
    description: 'Κοντό κούρεμα σώματος για μακρύτριχες γάτες με κόμπους.',
  },
  { name: 'Κόψιμο νυχιών', isAddon: true, price: 8, duration: 10, sizePricing: {}, description: null },
  {
    name: 'Καθαρισμός αυτιών',
    isAddon: true,
    price: 6,
    duration: 10,
    sizePricing: {},
    description: null,
  },
  {
    name: 'Βούρτσισμα δοντιών',
    isAddon: true,
    price: 8,
    duration: 10,
    sizePricing: {},
    description: 'Με ειδική οδοντόκρεμα για κατοικίδια.',
  },
  {
    name: 'Ξεμπέρδεμα κόμπων',
    isAddon: true,
    price: 10,
    duration: 20,
    sizePricing: bySize([[10, 20], [15, 25], [20, 30], [25, 40]]),
    description: 'Για τρίχωμα με κόμπους, χρέωση ανά μέγεθος.',
  },
  {
    name: 'Αντιπαρασιτικό μπάνιο',
    isAddon: true,
    species: 'DOG',
    price: 8,
    duration: 10,
    sizePricing: bySize([[8, 10], [10, 10], [12, 15], [15, 15]]),
    description: 'Σαμπουάν κατά ψύλλων και τσιμπουριών.',
  },
]

