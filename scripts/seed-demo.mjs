// Fills an empty database with the demo groomers and price list.
// Run once after `prisma migrate deploy`: node scripts/seed-demo.mjs
// Refuses to touch a database that already has services or groomers.
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { barbers, services } from '../lib/demo-data.ts'

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })

try {
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
