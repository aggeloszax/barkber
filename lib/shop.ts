import type { CSSProperties } from 'react'

// Single source of truth for the shop's identity. The app serves only
// this one business, so branding and contact details live in code, not the database.
export const SHOP = {
  name: 'Pet Salon Bubble & Grooming',
  logoUrl: '/logo.webp',
  primaryColor: '#16612f',
  bookingSubtitle: 'Πες μας λίγα λόγια για το κατοικίδιό σου, για να δεις σωστή τιμή και διάρκεια.',
  // Words for the staff on customer and admin pages, so a copy for another
  // kind of business changes them here.
  labels: {
    staff: 'Groomer',
    staffPlural: 'Groomers',
    anyStaff: 'Όλοι οι groomers',
  },
  // Shown on the privacy policy and booking terms pages.
  address: 'Πλουτάρχου 2 & Πελασγίας, Περιστέρι 121 37',
  phone: {
    label: '211 001 1734',
    href: 'tel:+302110011734',
  },
  // Social usernames without @, or null to hide the icon (top left of the
  // booking page).
  instagram: null as string | null,
  tiktok: null as string | null,
  adminEmail: 'admin@example.com',
  // Public URL of the deployed app, used for links in emails.
  // NEXT_PUBLIC_APP_URL overrides it (e.g. for local testing).
  appUrl: 'https://barkber-grooming.vercel.app',
  // Sender address for emails. It must be on a domain verified in Resend;
  // onboarding@resend.dev only delivers to the Resend account owner.
  // RESEND_FROM_EMAIL overrides it.
  emailFrom: 'onboarding@resend.dev',
} as const

// Colours of the customer-facing pages (booking, manage, legal): the same
// light beige as the admin, with white cards.
export const SITE_THEME = {
  '--brand': SHOP.primaryColor,
  '--page-bg': '#f6f2ea',
  '--page-border': '#e4dccd',
} as CSSProperties

// CSS custom properties for the admin UI (login and dashboard): a light beige
// workspace with the shop's brand colour as the accent.
export const ADMIN_THEME = {
  '--admin-bg': '#f6f2ea',
  '--admin-surface': '#ffffff',
  '--admin-surface-2': '#fbf8f3',
  '--admin-border': '#e4dccd',
  '--admin-text': '#1f1b16',
  '--admin-muted': '#72695c',
  '--admin-accent': SHOP.primaryColor,
  '--admin-accent-hover': `color-mix(in srgb, ${SHOP.primaryColor} 82%, black)`,
  '--admin-accent-soft': `color-mix(in srgb, ${SHOP.primaryColor} 9%, white)`,
} as CSSProperties
