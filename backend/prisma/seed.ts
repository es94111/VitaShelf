import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { addMonths, subMonths, addDays } from 'date-fns'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱  Seeding database...')

  // ── 1. Demo user ────────────────────────────────────────────────────────────
  const password = await bcrypt.hash('password123', 12)
  const user = await prisma.user.upsert({
    where: { email: 'demo@vitashelf.dev' },
    update: {},
    create: {
      email: 'demo@vitashelf.dev',
      password,
      displayName: '示範帳號',
      role: 'ADMIN',
    },
  })
  console.log(`  ✅  User: ${user.email}`)

  // ── 2. Tags ──────────────────────────────────────────────────────────────────
  const tagData = [
    { name: '日常',   color: '#2563EB' },
    { name: '旅行',   color: '#10B981' },
    { name: '敏感肌', color: '#F59E0B' },
    { name: '保濕',   color: '#6366F1' },
    { name: '抗老',   color: '#EC4899' },
    { name: '補充品', color: '#F97316' },
  ]
  const tags: Record<string, { id: string }> = {}
  for (const t of tagData) {
    const tag = await prisma.tag.upsert({
      where: { name_userId: { name: t.name, userId: user.id } },
      update: {},
      create: { ...t, userId: user.id },
    })
    tags[t.name] = tag
  }
  console.log(`  ✅  Tags: ${Object.keys(tags).join(', ')}`)

  // ── 3. Skincare products ──────────────────────────────────────────────────────
  const skincareData = [
    {
      name: 'LANEIGE 水庫保濕精華',
      brand: 'LANEIGE',
      subCategory: '精華液',
      spec: '50ml',
      tagNames: ['日常', '保濕'],
      expiryMonthsFromNow: 18,
      qty: 2,
      unitPrice: 1200,
    },
    {
      name: 'SK-II 神仙水',
      brand: 'SK-II',
      subCategory: '化妝水',
      spec: '230ml',
      tagNames: ['日常', '敏感肌'],
      expiryMonthsFromNow: 24,
      qty: 1,
      unitPrice: 3600,
    },
    {
      name: 'Shiseido 資生堂防曬 SPF50+',
      brand: 'Shiseido',
      subCategory: '防曬',
      spec: '50ml',
      tagNames: ['日常', '旅行'],
      expiryMonthsFromNow: 3,  // soon-to-expire: warn level
      qty: 1,
      unitPrice: 980,
    },
    {
      name: 'La Mer 海藍之謎面霜',
      brand: 'La Mer',
      subCategory: '乳霜',
      spec: '30ml',
      tagNames: ['抗老', '保濕'],
      expiryMonthsFromNow: 30,
      qty: 1,
      unitPrice: 7800,
    },
    {
      name: 'Kiehl\'s 屏障霜',
      brand: 'Kiehl\'s',
      subCategory: '乳霜',
      spec: '50ml',
      tagNames: ['日常', '敏感肌'],
      expiryMonthsFromNow: -1,  // already expired
      qty: 1,
      unitPrice: 1500,
    },
    {
      name: 'Dr. Jart 虎皮面膜',
      brand: 'Dr. Jart+',
      subCategory: '面膜',
      spec: '5片/盒',
      tagNames: ['日常', '保濕'],
      expiryMonthsFromNow: 12,
      qty: 3,
      unitPrice: 480,
    },
  ]

  for (const p of skincareData) {
    const product = await prisma.product.create({
      data: {
        name: p.name,
        brand: p.brand,
        category: 'SKINCARE',
        subCategory: p.subCategory,
        spec: p.spec,
        userId: user.id,
        tags: {
          create: p.tagNames
            .filter((n) => tags[n])
            .map((n) => ({ tag: { connect: { id: tags[n].id } } })),
        },
      },
    })

    const expiryDate = addMonths(new Date(), p.expiryMonthsFromNow)
    const purchaseDate = subMonths(new Date(), 1)

    await prisma.purchaseRecord.create({
      data: {
        productId: product.id,
        purchaseDate,
        quantity: p.qty,
        unitPrice: p.unitPrice,
        totalPrice: p.unitPrice * p.qty,
        channel: 'iHerb',
        expiryDate,
        manufactureDate: subMonths(expiryDate, 36),
      },
    })

    await prisma.stockLog.create({
      data: { productId: product.id, type: 'IN', quantity: p.qty, reason: '初始入庫（種子資料）' },
    })
  }
  console.log(`  ✅  Skincare products: ${skincareData.length}`)

  // ── 4. Supplement products ────────────────────────────────────────────────────
  const supplementData = [
    {
      name: 'NOW Foods 維他命 D3 5000IU',
      brand: 'NOW Foods',
      subCategory: '維他命',
      spec: '120粒',
      tagNames: ['日常', '補充品'],
      expiryMonthsFromNow: 20,
      qty: 2,
      unitPrice: 450,
    },
    {
      name: 'Jarrow 益生菌 10 Billion',
      brand: 'Jarrow',
      subCategory: '益生菌',
      spec: '30粒',
      tagNames: ['日常', '補充品'],
      expiryMonthsFromNow: 6,   // warn level
      qty: 1,
      unitPrice: 680,
    },
    {
      name: 'Life Extension 魚油 Omega-3',
      brand: 'Life Extension',
      subCategory: '魚油',
      spec: '120粒',
      tagNames: ['補充品', '抗老'],
      expiryMonthsFromNow: 15,
      qty: 1,
      unitPrice: 880,
    },
    {
      name: 'Neocell 膠原蛋白粉',
      brand: 'Neocell',
      subCategory: '膠原蛋白',
      spec: '300g',
      tagNames: ['抗老', '補充品'],
      expiryMonthsFromNow: 8,
      qty: 2,
      unitPrice: 750,
    },
    {
      name: 'Solaray 葉黃素 20mg',
      brand: 'Solaray',
      subCategory: '葉黃素',
      spec: '60粒',
      tagNames: ['日常', '補充品'],
      expiryMonthsFromNow: 24,
      qty: 1,
      unitPrice: 520,
    },
  ]

  for (const p of supplementData) {
    const product = await prisma.product.create({
      data: {
        name: p.name,
        brand: p.brand,
        category: 'SUPPLEMENT',
        subCategory: p.subCategory,
        spec: p.spec,
        userId: user.id,
        tags: {
          create: p.tagNames
            .filter((n) => tags[n])
            .map((n) => ({ tag: { connect: { id: tags[n].id } } })),
        },
      },
    })

    const expiryDate = addMonths(new Date(), p.expiryMonthsFromNow)
    const purchaseDate = subMonths(new Date(), 2)

    await prisma.purchaseRecord.create({
      data: {
        productId: product.id,
        purchaseDate,
        quantity: p.qty,
        unitPrice: p.unitPrice,
        totalPrice: p.unitPrice * p.qty,
        channel: 'iHerb',
        expiryDate,
        manufactureDate: subMonths(expiryDate, 24),
      },
    })

    await prisma.stockLog.create({
      data: { productId: product.id, type: 'IN', quantity: p.qty, reason: '初始入庫（種子資料）' },
    })
  }
  console.log(`  ✅  Supplement products: ${supplementData.length}`)

  console.log('\n🎉  Seed complete!')
  console.log(`    Demo login: demo@vitashelf.dev  /  password123`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
