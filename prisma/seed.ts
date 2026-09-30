/* Seed: default location, shipping zones, categories, DEMO products/stock, and (optionally) demo customers, orders and reviews.
   Uses raw SQL only, so it goes through the same pal_* functions as the app (stock changes are ledgered).
   Run: npm run db:seed        Skip demo orders: SEED_DEMO=false npm run db:seed */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const prisma = new PrismaClient();
const id = () => crypto.randomUUID();
const DEMO = process.env.SEED_DEMO !== 'false';
let seed = 20260930;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const ZONES: Record<string, string[]> = {
  'Metro Manila': ['Metro Manila'],
  Luzon: ['Abra', 'Albay', 'Apayao', 'Aurora', 'Bataan', 'Batanes', 'Batangas', 'Benguet', 'Bulacan', 'Cagayan', 'Camarines Norte', 'Camarines Sur', 'Catanduanes', 'Cavite', 'Ifugao', 'Ilocos Norte', 'Ilocos Sur', 'Isabela', 'Kalinga', 'La Union', 'Laguna', 'Marinduque', 'Masbate', 'Mountain Province', 'Nueva Ecija', 'Nueva Vizcaya', 'Occidental Mindoro', 'Oriental Mindoro', 'Palawan', 'Pampanga', 'Pangasinan', 'Quezon', 'Quirino', 'Rizal', 'Romblon', 'Sorsogon', 'Tarlac', 'Zambales'],
  Visayas: ['Aklan', 'Antique', 'Biliran', 'Bohol', 'Capiz', 'Cebu', 'Eastern Samar', 'Guimaras', 'Iloilo', 'Leyte', 'Negros Occidental', 'Negros Oriental', 'Northern Samar', 'Samar', 'Siquijor', 'Southern Leyte'],
  Mindanao: ['Agusan del Norte', 'Agusan del Sur', 'Basilan', 'Bukidnon', 'Camiguin', 'Cotabato', 'Davao de Oro', 'Davao del Norte', 'Davao del Sur', 'Davao Occidental', 'Davao Oriental', 'Dinagat Islands', 'Lanao del Norte', 'Lanao del Sur', 'Maguindanao del Norte', 'Maguindanao del Sur', 'Misamis Occidental', 'Misamis Oriental', 'Sarangani', 'South Cotabato', 'Sultan Kudarat', 'Sulu', 'Surigao del Norte', 'Surigao del Sur', 'Tawi-Tawi', 'Zamboanga del Norte', 'Zamboanga del Sur', 'Zamboanga Sibugay'],
};
const RATES: Record<string, [number, number | null, string]> = { 'Metro Manila': [12000, 300000, 'LBC'], Luzon: [18000, null, 'LBC'], Visayas: [25000, null, 'J&T Express'], Mindanao: [28000, null, 'J&T Express'] };

const CATS = [['Paddles', 'paddles'], ['Pickleballs', 'pickleballs'], ['Grips', 'grips'], ['Care', 'care'], ['Accessories', 'accessories'], ['Nets', 'nets']];
interface V { name: string; sku: string; price: number; compare?: number; cost: number; stock: number; low?: number; img?: string; barcode?: string }
interface P { name: string; slug: string; cat: string; short: string; desc: string; specs: Record<string, string>; tags: string[]; featured?: boolean; limited?: boolean; weight: number; images: string[]; variants: V[]; shipping?: string }
const SHIP = 'Ships from Metro Manila in 1 to 2 business days. Tracking number is emailed when your order ships.';
const PRODUCTS: P[] = [
  { name: 'Palladium KORU Limited Edition', slug: 'palladium-koru-limited-edition', cat: 'paddles', featured: true, limited: true, weight: 480,
    short: 'Gen4 16mm paddle with the koru spiral. Numbered limited run.', desc: 'The KORU takes its name from the Maori koru, an unfurling fern frond that stands for growth. The face carries the spiral in tone-on-tone black over a matte Gen4 surface, with red grip collar and white perforated grip. Designed in New Zealand.',
    specs: { Series: 'Gen4', Thickness: '16mm', Shape: 'Elongated', 'Grip circumference': '4.25 in', Weight: 'approx. 8.2 oz', Finish: 'Matte black, red trim', 'Designed in': 'New Zealand' }, tags: ['paddle', 'koru', 'limited', 'gen4'], images: ['/products/koru.webp'],
    variants: [{ name: 'Standard', sku: 'PAL-KORU-STD', price: 450000, cost: 210000, stock: 60, barcode: '4712345000011' }, { name: 'Limited Edition', sku: 'PAL-KORU-LTD', price: 490000, compare: 550000, cost: 240000, stock: 50, low: 8, barcode: '4712345000028' }] },
  { name: 'Palladium Gen4 Pro X 16', slug: 'palladium-gen4-pro-x-16', cat: 'paddles', featured: true, weight: 470,
    short: 'The X2 in matte black with a blue X. Choose a blue or white grip.', desc: 'Advanced performance engineering in a clean black paddle. The Pro X 16 pairs a 16mm Gen4 core with a textured face for spin, and a perforated grip in blue or white.',
    specs: { Series: 'Gen4 Pro X', Thickness: '16mm', Shape: 'Elongated', Weight: 'approx. 8.1 oz', Finish: 'Matte black, blue accents', 'Designed in': 'New Zealand' }, tags: ['paddle', 'x2', 'gen4', 'pro'], images: ['/products/x2-blue.webp', '/products/x2-white.webp'],
    variants: [{ name: 'Blue grip', sku: 'PAL-PROX16-BLU', price: 420000, cost: 190000, stock: 45, img: '/products/x2-blue.webp', barcode: '4712345000035' }, { name: 'White grip', sku: 'PAL-PROX16-WHT', price: 420000, cost: 190000, stock: 45, img: '/products/x2-white.webp', barcode: '4712345000042' }] },
  { name: 'Palladium Tournament Pickleballs', slug: 'palladium-tournament-pickleballs', cat: 'pickleballs', featured: true, weight: 90,
    short: 'Neon yellow outdoor balls, tube of 3.', desc: 'Consistent bounce, bright neon yellow and durable walls for outdoor courts. Sold in a clear tube with the PalladiumX label.',
    specs: { Pack: 'Tube of 3', Colour: 'Neon yellow', Use: 'Outdoor', Holes: '40' }, tags: ['balls', 'outdoor', 'tournament'], images: ['/products/balls.webp'],
    variants: [{ name: 'Tube of 3', sku: 'PAL-BALL-3', price: 65000, cost: 26000, stock: 100, barcode: '4712345000059' }, { name: 'Box of 12', sku: 'PAL-BALL-12', price: 240000, compare: 260000, cost: 100000, stock: 40, barcode: '4712345000066' }] },
  { name: 'Palladium Grip Tape', slug: 'palladium-grip-tape', cat: 'grips', weight: 60,
    short: 'Perforated overgrip, pack of 4.', desc: 'A tacky, perforated overgrip that keeps its feel through long sessions. Each pouch holds four grips with the Palladium label.',
    specs: { Pack: '4 overgrips', Texture: 'Perforated', Length: '110 cm' }, tags: ['grip', 'overgrip'], images: ['/products/grip-0.webp', '/products/grip-1.webp', '/products/grip-2.webp', '/products/grip-3.webp', '/products/grip-4.webp'],
    variants: [['Pink', 'PNK', 8], ['Black', 'BLK', 60], ['Grey', 'GRY', 60], ['Teal', 'TEA', 60], ['Mint', 'MNT', 60]].map(([n, c, s], i) => ({ name: n as string, sku: `PAL-GRIP-${c}`, price: 30000, cost: 8000, stock: s as number, img: `/products/grip-${i}.webp`, barcode: `47123450001${i}0` })) },
  { name: 'Palladium Paddle Cleaner', slug: 'palladium-paddle-cleaner', cat: 'care', weight: 250, short: 'Premium performance care for your paddle face.', desc: 'A gentle cleaner that lifts dirt and rubber marks from textured paddle faces without leaving residue. Flat, flip-top bottle.',
    specs: { Volume: '250 ml', Type: 'Flip-top bottle' }, tags: ['care', 'cleaner'], images: ['/products/bottle.webp'], variants: [{ name: '250 ml', sku: 'PAL-CARE-250', price: 45000, cost: 14000, stock: 80, barcode: '4712345000202' }] },
  { name: 'Palladium Paddle Case', slug: 'palladium-paddle-case', cat: 'accessories', weight: 300, short: 'Black case with red lining and zip.', desc: 'A protective zip case with a red lining and the white Palladium wordmark. Fits standard elongated paddles.',
    specs: { Colour: 'Black with red lining', Closure: 'Zip', Fits: 'Standard and elongated paddles' }, tags: ['case', 'accessory'], images: ['/products/case.webp'], variants: [{ name: 'Standard', sku: 'PAL-CASE-STD', price: 120000, cost: 40000, stock: 35, barcode: '4712345000301' }] },
  { name: 'Palladium Edge Guard', slug: 'palladium-edge-guard', cat: 'accessories', weight: 40, short: 'Impact edge tape that protects the paddle rim.', desc: 'Self-adhesive edge guard to protect your paddle rim from court scrapes. Demo listing: replace the placeholder photo.',
    specs: { Length: '120 cm', Colour: 'Black' }, tags: ['edge guard', 'accessory'], images: ['/products/xmark.webp'], variants: [{ name: 'Black', sku: 'PAL-EDGE-BLK', price: 35000, cost: 9000, stock: 4, low: 5, barcode: '4712345000400' }] },
  { name: 'Palladium Pickleball Net', slug: 'palladium-pickleball-net', cat: 'nets', weight: 6500, short: 'Portable regulation net with carry bag.', desc: 'A portable net with steel frame and carry bag. Demo listing: replace the placeholder photo.',
    specs: { Width: '22 ft', Height: '34 in centre', Frame: 'Powder-coated steel' }, tags: ['net', 'court'], images: ['/products/xmark.webp'], variants: [{ name: 'Portable 22 ft', sku: 'PAL-NET-22', price: 650000, cost: 300000, stock: 12, low: 3, barcode: '4712345000509' }] },
];

async function main() {
  console.log('Seeding Palladium...');
  await prisma.$executeRaw`INSERT INTO locations(id,name,code,type,"isDefault") VALUES (${id()},'Main warehouse','MAIN','WAREHOUSE',true) ON CONFLICT (code) DO NOTHING`;
  const [{ id: loc }] = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM locations WHERE code='MAIN'`;

  // Super admin
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@palladium.ph').toLowerCase();
  const pw = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!2026';
  await prisma.$executeRaw`INSERT INTO users(id,email,"passwordHash",name,role,"updatedAt") VALUES (${id()},${email},${await bcrypt.hash(pw, 12)},'Palladium Admin','SUPER_ADMIN',now()) ON CONFLICT DO NOTHING`;

  // Shipping zones and rates
  if (!(await prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM shipping_zones`)[0].n) {
    for (const [name, provinces] of Object.entries(ZONES)) {
      const zid = id(); const [fee, free, courier] = RATES[name];
      await prisma.$executeRaw`INSERT INTO shipping_zones(id,name,provinces) VALUES (${zid},${name},${provinces})`;
      await prisma.$executeRaw`INSERT INTO shipping_rates(id,"zoneId",name,"minWeightGrams","maxWeightGrams","rateCentavos","freeOverCentavos",courier) VALUES (${id()},${zid},'Standard up to 2 kg',0,2000,${fee},${free},${courier})`;
      await prisma.$executeRaw`INSERT INTO shipping_rates(id,"zoneId",name,"minWeightGrams","maxWeightGrams","rateCentavos","freeOverCentavos",courier) VALUES (${id()},${zid},'Heavy over 2 kg',2001,NULL,${fee + 20000},${free},${courier})`;
    }
  }
  for (const [i, [name, slug]] of CATS.entries()) await prisma.$executeRaw`INSERT INTO categories(id,name,slug,"sortOrder") VALUES (${id()},${name},${slug},${i}) ON CONFLICT (slug) DO NOTHING`;

  // Products (demo data, clearly flagged)
  const existing = (await prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM products`)[0].n;
  if (!existing) {
    for (const p of PRODUCTS) {
      const pid = id();
      const [{ id: cid }] = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM categories WHERE slug=${p.cat}`;
      await prisma.$executeRaw`INSERT INTO products(id,name,slug,"categoryId","shortDescription",description,specs,tags,status,"isFeatured","isLimited","isDemo","weightGrams","shippingInfo","seoTitle","seoDescription","ogImageUrl","publishedAt","updatedAt")
        VALUES (${pid},${p.name},${p.slug},${cid},${p.short},${p.desc},${JSON.stringify(p.specs)}::jsonb,${p.tags},'ACTIVE',${!!p.featured},${!!p.limited},true,${p.weight},${SHIP},${p.name + ' | Palladium Pickleball Philippines'},${p.short},${p.images[0]},now(),now())`;
      for (const [i, url] of p.images.entries()) await prisma.$executeRaw`INSERT INTO product_images(id,"productId",url,alt,position) VALUES (${id()},${pid},${url},${p.name},${i})`;
      for (const [i, v] of p.variants.entries()) {
        const vid = id();
        await prisma.$executeRaw`INSERT INTO product_variants(id,"productId",name,sku,barcode,"priceCentavos","compareAtCentavos","costCentavos","lowStockThreshold","imageUrl",position,"updatedAt")
          VALUES (${vid},${pid},${v.name},${v.sku},${v.barcode ?? null},${v.price},${v.compare ?? null},${v.cost},${v.low ?? 5},${v.img ?? null},${i},now())`;
        if (v.stock > 0) await prisma.$executeRaw`SELECT pal_adjust_inventory(${vid}::text,${loc}::text,'INITIAL'::"InventoryAction",${v.stock}::int,'Demo opening stock'::text,NULL::text)`;
      }
    }
  }

  await prisma.$executeRaw`INSERT INTO discounts(id,code,type,value,"minOrderCentavos","perCustomerLimit") VALUES (${id()},'WELCOME10','PERCENTAGE',10,0,1) ON CONFLICT DO NOTHING`;
  await prisma.$executeRaw`INSERT INTO discounts(id,code,type,value,"minOrderCentavos") VALUES (${id()},'PALLADIUM500','FIXED',50000,250000) ON CONFLICT DO NOTHING`;

  if (DEMO && !existing) await demo(loc);
  console.log('Done. Admin login:', email);
}

const NAMES = ['Juan Dela Cruz', 'Maria Santos', 'Pedro Cruz', 'Ana Reyes', 'Miguel Garcia', 'Sofia Mendoza', 'Carlo Bautista', 'Isabel Ramos', 'Luis Aquino', 'Bea Villanueva', 'Rico Fernandez', 'Trisha Navarro'];
const PLACES = [['Makati', 'Metro Manila', '1200', 'Poblacion'], ['Quezon City', 'Metro Manila', '1100', 'Diliman'], ['Taguig', 'Metro Manila', '1630', 'Bonifacio'], ['Cebu City', 'Cebu', '6000', 'Lahug'], ['Davao City', 'Davao del Sur', '8000', 'Buhangin'], ['Antipolo', 'Rizal', '1870', 'San Roque'], ['Bacoor', 'Cavite', '4102', 'Molino'], ['Iloilo City', 'Iloilo', '5000', 'Jaro']];
async function demo(loc: string) {
  console.log('Creating demo customers, orders and reviews...');
  const custIds: string[] = [];
  for (const [i, name] of NAMES.entries()) {
    const cid = id(); custIds.push(cid);
    const em = i === 0 ? 'customer@example.com' : `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`;
    let uid: string | null = null;
    if (i === 0) { uid = id(); await prisma.$executeRaw`INSERT INTO users(id,email,"passwordHash",name,role,"updatedAt") VALUES (${uid},${em},${await bcrypt.hash('Customer!2026', 12)},${name},'CUSTOMER',now()) ON CONFLICT DO NOTHING`; }
    await prisma.$executeRaw`INSERT INTO customers(id,"userId",email,name,phone,source,"updatedAt") VALUES (${cid},${uid},${em},${name},${'0917' + String(1000000 + i * 137).slice(0, 7)},${pick(['instagram', 'facebook', 'direct', 'google', 'friend'])},now())`;
    const pl = PLACES[i % PLACES.length];
    await prisma.$executeRaw`INSERT INTO addresses(id,"customerId",recipient,phone,line1,barangay,city,province,"postalCode","isDefault") VALUES (${id()},${cid},${name},${'0917' + String(1000000 + i * 137).slice(0, 7)},${`${10 + i} Sample Street`},${pl[3]},${pl[0]},${pl[1]},${pl[2]},true)`;
  }
  const variants = await prisma.$queryRaw<{ id: string; sku: string; price: number }[]>`SELECT id, sku, "priceCentavos" AS price FROM product_variants`;
  const weights: Record<string, number> = { 'PAL-KORU-STD': 3, 'PAL-KORU-LTD': 4, 'PAL-PROX16-BLU': 3, 'PAL-PROX16-WHT': 2, 'PAL-BALL-3': 8, 'PAL-BALL-12': 2, 'PAL-GRIP-BLK': 5, 'PAL-GRIP-GRY': 3, 'PAL-GRIP-TEA': 3, 'PAL-GRIP-MNT': 2, 'PAL-CARE-250': 4, 'PAL-CASE-STD': 3 };
  const pool = variants.filter((v) => weights[v.sku]).flatMap((v) => Array(weights[v.sku]).fill(v));
  const methods = ['GCASH', 'GCASH', 'MAYA', 'COD', 'COD', 'BANK_TRANSFER', 'CARD'];
  const N = 46;
  for (let n = 0; n < N; n++) {
    const daysAgo = n < 8 ? 0 : Math.floor(rnd() * 34); // a busy "today" plus a month of history
    const ci = Math.floor(rnd() * custIds.length), cid = custIds[ci];
    const [c] = await prisma.$queryRaw<{ email: string; name: string; phone: string }[]>`SELECT email,name,phone FROM customers WHERE id=${cid}`;
    const pl = PLACES[ci % PLACES.length];
    const nItems = 1 + Math.floor(rnd() * 3);
    const items = new Map<string, number>();
    for (let k = 0; k < nItems; k++) { const v = pick(pool); items.set(v.id, (items.get(v.id) ?? 0) + 1 + (rnd() < 0.25 ? 1 : 0)); }
    const method = pick(methods);
    const ship = pl[1] === 'Metro Manila' ? 12000 : ['Cebu', 'Iloilo'].includes(pl[1]) ? 25000 : pl[1] === 'Davao del Sur' ? 28000 : 18000;
    const payload = { customerId: cid, email: c.email, phone: c.phone, method, shippingCentavos: ship, shippingZone: pl[1] === 'Metro Manila' ? 'Metro Manila' : 'Luzon', idempotencyKey: `demo-${n}`,
      ship: { name: c.name, phone: c.phone, line1: `${10 + ci} Sample Street`, barangay: pl[3], city: pl[0], province: pl[1], postalCode: pl[2] }, items: [...items].map(([variantId, qty]) => ({ variantId, qty })) };
    let res: { orderId: string };
    try { [{ r: res }] = await prisma.$queryRaw<{ r: { orderId: string } }[]>`SELECT pal_place_order(${JSON.stringify(payload)}::jsonb) AS r`; } catch (e) { continue; }
    const oid = res.orderId;
    // outcome mix
    const roll = rnd();
    const old = daysAgo >= 2;
    const status = roll < 0.06 ? 'cancel' : roll < 0.16 && daysAgo <= 1 ? 'pending' : old ? (roll < 0.78 ? 'delivered' : roll < 0.9 ? 'shipped' : 'processing') : (roll < 0.35 ? 'paid' : roll < 0.6 ? 'processing' : roll < 0.75 ? 'packed' : 'shipped');
    if (status === 'pending') { /* stays PENDING / PAYMENT_PENDING with reserved stock */ }
    else if (status === 'cancel') await prisma.$executeRaw`SELECT pal_cancel_order(${oid}::text,'Demo: customer cancelled'::text,NULL::text)`;
    else {
      await prisma.$executeRaw`SELECT pal_confirm_order(${oid}::text,NULL::text,${method !== 'COD'}::boolean,NULL::text)`;
      const st = status === 'paid' ? (method === 'COD' ? 'PROCESSING' : 'PAID') : status.toUpperCase();
      if (['PACKED', 'SHIPPED', 'DELIVERED', 'PROCESSING'].includes(st)) await prisma.$executeRaw`UPDATE orders SET status=${st}::"OrderStatus" WHERE id=${oid}`;
      if (['SHIPPED', 'DELIVERED'].includes(st)) {
        await prisma.$executeRaw`INSERT INTO shipments(id,"orderId",courier,"trackingNumber",status,"feeCentavos","shippedAt") VALUES (${id()},${oid},'LBC',${'LBC' + (7000000 + n * 137)},${st}::"ShipmentStatus",${ship},now())`;
        if (st === 'DELIVERED' && method === 'COD') await prisma.$executeRaw`SELECT pal_confirm_order(${oid}::text,NULL::text,true::boolean,'COD collected'::text)`;
      }
    }
    const when = new Date(Date.now() - daysAgo * 86400000 - Math.floor(rnd() * 12) * 3600000);
    if (daysAgo === 0) when.setTime(Date.now() - Math.floor(rnd() * 8) * 3600000);
    await prisma.$executeRaw`UPDATE orders SET "placedAt"=${when}, "createdAt"=${when}, "paidAt"=CASE WHEN "paidAt" IS NULL THEN NULL ELSE ${when} END WHERE id=${oid}`;
    await prisma.$executeRaw`UPDATE order_events SET "createdAt"=${when} WHERE "orderId"=${oid}`;
    await prisma.$executeRaw`UPDATE payments SET "createdAt"=${when} WHERE "orderId"=${oid}`;
  }
  // one partial refund with return to stock, for the reports
  const [ref] = await prisma.$queryRaw<{ id: string; total: number }[]>`SELECT id, "totalCentavos" AS total FROM orders WHERE status='DELIVERED' AND "paymentStatus"='PAID' ORDER BY "placedAt" DESC LIMIT 1`;
  if (ref) await prisma.$executeRaw`SELECT pal_refund_order(${ref.id}::text,${Math.min(30000, ref.total)}::int,false::boolean,NULL::jsonb,'Demo: goodwill refund'::text,NULL::text)`;
  // customers "since" their first order
  await prisma.$executeRaw`UPDATE customers c SET "createdAt"=COALESCE((SELECT min(o."placedAt") - interval '1 hour' FROM orders o WHERE o."customerId"=c.id), c."createdAt")`;

  const products = await prisma.$queryRaw<{ id: string; name: string }[]>`SELECT id, name FROM products`;
  const R: [string, number, string, string][] = [['Great control and spin', 5, 'The Pro X 16 feels amazing on dinks and resets. Grip is comfortable.', 'Carlo B.'], ['Worth it', 5, 'Beautiful paddle, and the koru design looks even better in person.', 'Bea V.'], ['Solid balls', 4, 'Bounce is consistent and bright yellow, easy to see outdoors.', 'Rico F.'], ['Good grips', 4, 'Stay tacky for many games. Wish there were more colours.', 'Ana R.'], ['Cleaner works', 5, 'Removed the rubber marks without dulling the surface.', 'Luis A.'], ['Nice case', 4, 'Fits my paddle snugly. Zip is smooth.', 'Trisha N.']];
  for (const [i, [title, rating, body, author]] of R.entries()) {
    const p = products[i % products.length];
    await prisma.$executeRaw`INSERT INTO reviews(id,"productId",title,rating,body,"authorName",verified,"isDemo") VALUES (${id()},${p.id},${title},${rating},${body},${author},true,true)`;
  }
  await prisma.$executeRaw`INSERT INTO site_visits(id,"sessionId",path,"createdAt") SELECT gen_random_uuid()::text, 'demo-' || (g % 600), '/', now() - (g % 30) * interval '1 day' FROM generate_series(1, 1500) g`;
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
