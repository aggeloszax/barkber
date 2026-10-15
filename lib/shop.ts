import type { CSSProperties } from 'react'

// Single source of truth for the shop's identity. The app serves only
// this one business, so branding and contact details live in code, not the database.
export const SHOP = {
  name: "Elli's Pet Grooming",
  logoUrl: '/logo.webp',
  primaryColor: '#b83b6b',
  bookingSubtitle: 'Πες μας λίγα λόγια για το κατοικίδιό σου, για να δεις σωστή τιμή και διάρκεια.',
  // Words for the staff on customer and admin pages, so a copy for another
  // kind of business changes them here.
  labels: {
    staff: 'Groomer',
    staffPlural: 'Groomers',
    anyStaff: 'Όλοι οι groomers',
  },
  // Shown on the privacy policy and booking terms pages.
  address: 'Κηπουπόλεως 3, Περιστέρι 121 37',
  phone: {
    label: '210 571 6048',
    href: 'tel:+302105716048',
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
// light blush as the admin, with white cards.
export const SITE_THEME = {
  '--brand': SHOP.primaryColor,
  '--page-bg': '#f7f3f5',
  '--page-border': '#e8dde2',
} as CSSProperties

// CSS custom properties for the admin UI (login and dashboard): a light beige
// workspace with the shop's brand colour as the accent.
export const ADMIN_THEME = {
  '--admin-bg': '#f7f3f5',
  '--admin-surface': '#ffffff',
  '--admin-surface-2': '#fbf8fa',
  '--admin-border': '#e8dde2',
  '--admin-text': '#1d1719',
  '--admin-muted': '#6f6469',
  '--admin-accent': SHOP.primaryColor,
  '--admin-accent-hover': `color-mix(in srgb, ${SHOP.primaryColor} 82%, black)`,
  '--admin-accent-soft': `color-mix(in srgb, ${SHOP.primaryColor} 9%, white)`,
} as CSSProperties
