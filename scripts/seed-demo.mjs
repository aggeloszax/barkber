// Fills an empty database with the demo groomers and price list.
// Run once after `prisma migrate deploy`: node scripts/seed-demo.mjs
// Refuses to touch a database that already has services or groomers, unless
// --reset is passed and there are no bookings (e.g. after a prospect demo).
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { barbers, services } from '../lib/demo-data.ts'

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })

try {
  if (process.argv.includes('--reset')) {
    if ((await prisma.booking.count()) > 0) throw new Error('Bookings exist, refusing to reset.')
    await prisma.service.deleteMany()
    await prisma.barber.deleteMany()
  }
  const existing = (await prisma.service.count()) + (await prisma.barber.count())
  if (existing > 0) {
    console.log('Database already has data, nothing seeded.')
  } else {
    await prisma.barber.createMany({ data: barbers })
    await prisma.service.createMany({ data: services })
    console.log(`Seeded ${barbers.length} groomers and ${services.length} services.`)
  }
} finally {
  await prisma.$disconnect()
}
