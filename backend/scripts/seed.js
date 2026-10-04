const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Category = require('../models/Category');
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Cart = require('../models/Cart');
const Wishlist = require('../models/Wishlist');
const { lineTotal, computeSubtotal, computeShipping } = require('../services/pricing');

const img = (id, w = 800) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const CATEGORIES = [
  { name: 'Electronics', image: img('photo-1496181133206-80ce9b88a853'), description: 'Phones, laptops, audio, cameras and smart devices.' },
  { name: 'Fashion', image: img('photo-1542272604-787c3835535d'), description: 'Clothing, footwear and everyday style essentials.' },
  { name: 'Accessories', image: img('photo-1572635196237-14b3f281503f'), description: 'Bags, wallets, watches, eyewear and jewellery.' },
  { name: 'Home and Living', image: img('photo-1506439773649-6e0eb8cfb237'), description: 'Furniture, lighting and comfort for your space.' },
  { name: 'Beauty and Personal Care', image: img('photo-1541643600914-78b084683601'), description: 'Skincare, makeup, fragrance and grooming.' },
];

const PRODUCTS = [
  { name: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones', price: 34990, discountPrice: 29990, category: 'Electronics', brand: 'Sony', stock: 24, rating: 4.8, reviewCount: 3, featured: true, soldCount: 186, images: [img('photo-1505740420928-5e560c06d30e')], description: 'Industry-leading noise cancellation with two processors controlling eight microphones. Enjoy crystal-clear hands-free calling, up to 30 hours of battery life and ultra-comfortable lightweight design for all-day listening.' },
  { name: 'Apple MacBook Air 13-inch M2', price: 114900, discountPrice: 104900, category: 'Electronics', brand: 'Apple', stock: 12, rating: 4.7, reviewCount: 2, featured: true, soldCount: 74, images: [img('photo-1496181133206-80ce9b88a853')], description: 'Supercharged by the M2 chip, the MacBook Air delivers blazing performance in a stunningly thin enclosure. 13.6-inch Liquid Retina display, 18-hour battery life and a silent, fanless design.' },
  { name: 'Samsung Galaxy S24 5G (8GB, 256GB)', price: 74999, discountPrice: 69999, category: 'Electronics', brand: 'Samsung', stock: 30, rating: 4.5, reviewCount: 2, featured: true, soldCount: 142, images: [img('photo-1511707171634-5f897ff02aa9')], description: 'A brilliant 120Hz AMOLED display, pro-grade camera with Galaxy AI and all-day battery. Built with Gorilla Armor glass and a refined aluminium frame for a premium feel.' },
  { name: 'Canon EOS R50 Mirrorless Camera with 18-45mm Lens', price: 75999, discountPrice: null, category: 'Electronics', brand: 'Canon', stock: 8, rating: 4.6, reviewCount: 1, featured: false, soldCount: 41, images: [img('photo-1516035069371-29a1b244cc32')], description: 'A compact, lightweight mirrorless camera with 24.2MP APS-C sensor, Dual Pixel autofocus and 4K video. Perfect for creators stepping up from a smartphone.' },
  { name: 'JBL Charge 5 Portable Bluetooth Speaker', price: 12999, discountPrice: 10999, category: 'Electronics', brand: 'JBL', stock: 45, rating: 4.5, reviewCount: 2, featured: false, soldCount: 210, images: [img('photo-1608043152269-423dbba4e7e1')], description: 'Bold JBL Original Pro Sound with a built-in power bank, IP67 waterproof and dustproof body and 20 hours of playtime. Pair two speakers for stereo sound.' },
  { name: 'Logitech MX Keys Wireless Keyboard', price: 7995, discountPrice: 6995, category: 'Electronics', brand: 'Logitech', stock: 33, rating: 4.4, reviewCount: 1, featured: false, soldCount: 96, images: [img('photo-1541140532154-b024d705b90a')], description: 'Fluid typing with perfectly spherically dished keys, smart illumination and multi-device seamless switching. The wireless keyboard designed for creative pros.' },
  { name: 'Apple iPad (10th Generation) 64GB Wi-Fi', price: 44900, discountPrice: 41900, category: 'Electronics', brand: 'Apple', stock: 18, rating: 4.6, reviewCount: 1, featured: false, soldCount: 65, images: [img('photo-1544244015-0df4b3ffc6b0')], description: '10.9-inch all-screen design with A14 Bionic chip, 12MP wide camera and support for Apple Pencil. Built for work, study and play wherever you go.' },
  { name: 'Sony Bravia 55-inch 4K Ultra HD Smart TV', price: 64990, discountPrice: 57990, category: 'Electronics', brand: 'Sony', stock: 6, rating: 4.7, reviewCount: 1, featured: true, soldCount: 52, images: [img('photo-1593359677879-a4bb92f829d1')], description: 'Stunning 4K HDR picture with Triluminos Pro colour and Dolby Audio. Google TV built in with voice search and all your favourite streaming apps.' },
  { name: 'HP Pavilion Wireless Gaming Mouse', price: 1499, discountPrice: 1199, category: 'Electronics', brand: 'HP', stock: 60, rating: 4.2, reviewCount: 1, featured: false, soldCount: 320, images: [img('photo-1527864550417-7fd91fc51a46')], description: 'Lightweight ergonomic mouse with 16000 DPI optical sensor, customizable RGB lighting and up to 60 hours of battery life.' },
  { name: 'boAt Airdopes 141 True Wireless Earbuds', price: 1299, discountPrice: 999, category: 'Electronics', brand: 'boAt', stock: 120, rating: 4.3, reviewCount: 2, featured: false, soldCount: 890, images: [img('photo-1590658268037-6bf12165a8df')], description: '42 hours of total playback, ENx noise cancelling mics, low-latency BEAST mode for gaming and IPX4 water resistance at an unbeatable price.' },

  { name: "Levi's 511 Slim Fit Jeans", price: 3299, discountPrice: 2499, category: 'Fashion', brand: "Levi's", stock: 40, rating: 4.4, reviewCount: 2, featured: false, soldCount: 245, images: [img('photo-1542272604-787c3835535d')], description: 'The modern slim fit that sits below the waist with a tapered leg. Crafted from durable stretch denim that keeps its shape wash after wash.' },
  { name: 'Nike Air Zoom Pegasus 40 Running Shoes', price: 9995, discountPrice: 8495, category: 'Fashion', brand: 'Nike', stock: 28, rating: 4.7, reviewCount: 2, featured: true, soldCount: 178, images: [img('photo-1542291026-7eec264c27ff')], description: 'Responsive Zoom Air cushioning and a engineered mesh upper deliver a smooth, breathable ride for daily training runs and long distances.' },
  { name: 'H&M Classic Cotton Crew-Neck T-Shirt', price: 799, discountPrice: null, category: 'Fashion', brand: 'H&M', stock: 150, rating: 4.1, reviewCount: 1, featured: false, soldCount: 640, images: [img('photo-1521572163474-6864f9cf17ab')], description: 'A wardrobe staple in soft, breathable organic cotton with a regular fit and ribbed neckline. Available in everyday essential colours.' },
  { name: 'Zara Floral Midi Dress', price: 3990, discountPrice: 3290, category: 'Fashion', brand: 'Zara', stock: 22, rating: 4.5, reviewCount: 1, featured: true, soldCount: 87, images: [img('photo-1595777457583-95e059d581b8')], description: 'A flowing midi dress with a subtle floral print, V-neckline and side slit. Effortless day-to-evening style in lightweight woven fabric.' },
  { name: 'Adidas Own The Run Track Jacket', price: 7999, discountPrice: 6499, category: 'Fashion', brand: 'Adidas', stock: 35, rating: 4.4, reviewCount: 1, featured: false, soldCount: 130, images: [img('photo-1551028719-00167b16eac5')], description: 'A lightweight, wind-resistant running jacket with zip pockets and reflective details. Made with recycled materials as part of our commitment to sustainability.' },
  { name: 'Fossil Grant Chronograph Watch', price: 8995, discountPrice: 7495, category: 'Fashion', brand: 'Fossil', stock: 16, rating: 4.6, reviewCount: 1, featured: false, soldCount: 74, images: [img('photo-1523275335684-37898b6baf30')], description: 'Classic chronograph styling with a stainless steel case, mineral crystal and water resistance. A timeless gift that works with every outfit.' },

  { name: 'Wildcraft 45L Rucksack Backpack', price: 2199, discountPrice: 1799, category: 'Accessories', brand: 'Wildcraft', stock: 52, rating: 4.3, reviewCount: 2, featured: false, soldCount: 310, images: [img('photo-1553062407-98eeb64c6a62')], description: 'A rugged 45-litre rucksack with padded shoulder straps, rain cover and multiple compartments. Ideal for college, trekking and weekend getaways.' },
  { name: 'Ray-Ban Aviator Classic Sunglasses', price: 7800, discountPrice: 6999, category: 'Accessories', brand: 'Ray-Ban', stock: 20, rating: 4.8, reviewCount: 2, featured: true, soldCount: 154, images: [img('photo-1572635196237-14b3f281503f')], description: 'The iconic aviator silhouette with crystal-clear G-15 lenses and a lightweight metal frame. 100% UV protection and a hard case included.' },
  { name: 'Giordano Leather Bifold Wallet', price: 1299, discountPrice: 999, category: 'Accessories', brand: 'Giordano', stock: 70, rating: 4.2, reviewCount: 1, featured: false, soldCount: 420, images: [img('photo-1627123424574-724758594e93')], description: 'Genuine leather bifold wallet with RFID-blocking lining, six card slots and a note compartment. Slim profile that fits comfortably in any pocket.' },
  { name: 'Caratlane Graceful Silver Charm Bracelet', price: 2499, discountPrice: 2199, category: 'Accessories', brand: 'CaratLane', stock: 26, rating: 4.5, reviewCount: 1, featured: false, soldCount: 98, images: [img('photo-1611591437281-460bfbe1220a')], description: 'Sterling silver bracelet with a delicate charm detail and secure clasp. Hypoallergenic, tarnish-resistant and beautifully gift boxed.' },
  { name: 'Mia Solitaire CZ Ring (Sterling Silver)', price: 5499, discountPrice: 4899, category: 'Accessories', brand: 'Mia', stock: 14, rating: 4.6, reviewCount: 1, featured: false, soldCount: 63, images: [img('photo-1605100804763-247f67b3557e')], description: 'A sparkling solitaire cubic zirconia ring set in 925 silver with a polished band. Elegant enough for everyday wear and special occasions.' },

  { name: 'Urban Ladder Nordic Wooden Lounge Chair', price: 12999, discountPrice: 10999, category: 'Home and Living', brand: 'Urban Ladder', stock: 9, rating: 4.5, reviewCount: 2, featured: true, soldCount: 58, images: [img('photo-1506439773649-6e0eb8cfb237')], description: 'A mid-century inspired lounge chair with a solid wood frame and plush cushioning. Ergonomically angled for reading, relaxing and long conversations.' },
  { name: 'Matte Black Adjustable Table Lamp', price: 1899, discountPrice: 1599, category: 'Home and Living', brand: 'IKEA', stock: 44, rating: 4.2, reviewCount: 1, featured: false, soldCount: 187, images: [img('photo-1507473885765-e6ed057f782c')], description: 'A minimalist table lamp with a matte black finish and adjustable shade. Warm, focused light for bedside tables and work desks.' },
  { name: 'Ceramic Coffee Mug Set of 4 (350ml)', price: 999, discountPrice: 799, category: 'Home and Living', brand: 'Cupixel', stock: 90, rating: 4.4, reviewCount: 1, featured: false, soldCount: 365, images: [img('photo-1514228742587-6b1558fcca3d')], description: 'Four stoneware mugs with a speckled glaze, comfortable handles and a generous 350ml capacity. Dishwasher and microwave safe.' },
  { name: 'Sleepyhead Woven Cotton Throw Blanket', price: 1499, discountPrice: 1299, category: 'Home and Living', brand: 'Sleepyhead', stock: 38, rating: 4.3, reviewCount: 1, featured: false, soldCount: 142, images: [img('photo-1522771739844-6a9f6d5f14af')], description: 'A soft, breathable woven cotton throw with hand-finished tassels. Lightweight warmth for sofa evenings and airy summer nights.' },
  { name: 'Philips Air Purifier for Small Rooms', price: 16995, discountPrice: 14995, category: 'Home and Living', brand: 'Philips', stock: 7, rating: 4.6, reviewCount: 1, featured: false, soldCount: 46, images: [img('photo-1558618666-fcd25c85cd64')], description: 'Removes 99.97% of airborne particles as small as 0.003 microns with NanoProtect HEPA filtration. Quiet night mode and real-time air quality display.' },

  { name: 'Chanel Coco Mademoiselle Eau de Parfum 100ml', price: 12500, discountPrice: 11250, category: 'Beauty and Personal Care', brand: 'Chanel', stock: 15, rating: 4.8, reviewCount: 2, featured: true, soldCount: 112, images: [img('photo-1541643600914-78b084683601')], description: 'A sparkling oriental fragrance with notes of orange, jasmine and vetiver. Timeless, modern and unforgettable — a signature scent for every occasion.' },
  { name: 'Swiss Beauty Matte Liquid Lipstick Set (Pack of 4)', price: 899, discountPrice: 699, category: 'Beauty and Personal Care', brand: 'Swiss Beauty', stock: 85, rating: 4.1, reviewCount: 1, featured: false, soldCount: 540, images: [img('photo-1586495777744-4413f21062fa')], description: 'Four long-lasting liquid lipsticks with a velvety matte finish. Highly pigmented, transfer-resistant and enriched with vitamin E.' },
  { name: 'Mamaearth Vitamin C Face Serum 30ml', price: 599, discountPrice: 499, category: 'Beauty and Personal Care', brand: 'Mamaearth', stock: 110, rating: 4.2, reviewCount: 1, featured: false, soldCount: 680, images: [img('photo-1556228720-195a672e8a03')], description: 'Brightening serum with vitamin C, turmeric and soybean that reduces pigmentation and evens skin tone. Toxin-free and dermatologically tested.' },
  { name: 'Vega Professional Makeup Brush Set (12 Pieces)', price: 1199, discountPrice: 999, category: 'Beauty and Personal Care', brand: 'Vega', stock: 48, rating: 4.3, reviewCount: 1, featured: false, soldCount: 260, images: [img('photo-1596462502278-27bfdc403348')], description: 'A complete set of 12 synthetic brushes with soft bristles and wooden handles, plus a roll-up pouch. Cruelty-free and easy to clean.' },
];

const SAMPLE_REVIEWS = [
  { product: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones', email: 'customer@shopx.com', rating: 5, comment: 'Absolutely worth it. The noise cancellation on my daily commute is unreal and the battery easily lasts a week.' },
  { product: 'boAt Airdopes 141 True Wireless Earbuds', email: 'riya@example.com', rating: 4, comment: 'Great value for money. Pairing was instant and gaming mode latency is noticeably low.' },
  { product: 'Nike Air Zoom Pegasus 40 Running Shoes', email: 'customer@shopx.com', rating: 5, comment: 'Very comfortable for morning runs. Cushioning feels responsive even after 10km.' },
  { product: 'Urban Ladder Nordic Wooden Lounge Chair', email: 'arjun@example.com', rating: 4, comment: 'Sturdy build and the finish looks premium. Assembly took about 20 minutes.' },
  { product: 'Wildcraft 45L Rucksack Backpack', email: 'riya@example.com', rating: 5, comment: 'Carried this on a 3-day trek. Padded straps made a big difference.' },
  { product: 'Chanel Coco Mademoiselle Eau de Parfum 100ml', email: 'customer@shopx.com', rating: 5, comment: 'Long-lasting and elegant. Received many compliments.' },
  { product: 'Sony Bravia 55-inch 4K Ultra HD Smart TV', email: 'arjun@example.com', rating: 5, comment: 'Picture quality is stunning and the Google TV interface is smooth.' },
  { product: 'H&M Classic Cotton Crew-Neck T-Shirt', email: 'riya@example.com', rating: 4, comment: 'Soft cotton, holds shape after washing. Slightly snug around the shoulders.' },
];

const SAMPLE_USERS = [
  { name: 'Demo Customer', email: 'customer@shopx.com', phone: '9876543210', role: 'customer', password: 'Customer@123' },
  { name: 'Riya Sharma', email: 'riya@example.com', phone: '9812345670', role: 'customer', password: 'Customer@123' },
  { name: 'Arjun Mehta', email: 'arjun@example.com', phone: '9898989898', role: 'customer', password: 'Customer@123' },
];

const ADMIN = {
  name: 'ShopX Administrator',
  email: process.env.ADMIN_EMAIL || 'admin@shopx.com',
  password: process.env.ADMIN_PASSWORD || 'Admin@123',
  role: 'admin',
};

const slugify = (text) =>
  String(text).toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const buildSampleOrder = async (user, productNames, overrides) => {
  const items = [];
  for (const entry of productNames) {
    const product = await Product.findOne({ name: entry.name });
    if (!product) continue;
    const unitPrice = product.discountPrice != null ? product.discountPrice : product.price;
    items.push({
      product: product._id,
      name: product.name,
      slug: product.slug,
      image: product.images[0] || '',
      price: product.price,
      discountPrice: product.discountPrice,
      unitPrice,
      quantity: entry.quantity,
      lineTotal: Number(lineTotal(product, entry.quantity).toFixed(2)),
    });
  }
  const subtotal = computeSubtotal(items.map((i) => ({ lineTotal: i.lineTotal })));
  const shippingFee = computeShipping(subtotal);
  const order = await Order.create({
    orderNumber: `SHX-SEED-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    user: user._id,
    items,
    shippingAddress: {
      fullName: user.name,
      phone: user.phone || '9876543210',
      email: user.email,
      line1: '221B Sample Residency, MG Road',
      line2: 'Near City Mall',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      notes: 'Please ring the doorbell twice.',
    },
    subtotal,
    shippingFee,
    discount: 0,
    total: Number((subtotal + shippingFee).toFixed(2)),
    isSample: true,
    ...overrides,
  });
  return order;
};

const seed = async () => {
  await connectDB();

  await Promise.all([
    Product.deleteMany({}),
    Category.deleteMany({}),
    Review.deleteMany({}),
    Order.deleteMany({}),
    Cart.deleteMany({}),
    Wishlist.deleteMany({}),
    User.deleteMany({ role: 'customer' }),
  ]);
  console.log('Cleared existing sample data.');

  const categories = await Category.insertMany(
    CATEGORIES.map((c) => ({ ...c, slug: slugify(c.name), isActive: true }))
  );
  console.log(`Seeded ${categories.length} categories.`);

  const products = [];
  for (const p of PRODUCTS) {
    const product = new Product({
      name: p.name,
      description: p.description,
      price: p.price,
      discountPrice: p.discountPrice,
      category: slugify(p.category),
      brand: p.brand,
      stock: p.stock,
      rating: p.rating,
      reviewCount: p.reviewCount,
      featured: p.featured,
      images: p.images,
      soldCount: p.soldCount,
      isSample: true,
    });
    product.slug = slugify(p.name);
    await product.save();
    products.push(product);
  }
  console.log(`Seeded ${products.length} products.`);

  const adminEmail = ADMIN.email.toLowerCase();
  let admin = await User.findOne({ email: adminEmail, role: 'admin' });
  if (!admin) {
    admin = await User.create({
      name: ADMIN.name,
      email: adminEmail,
      passwordHash: await bcrypt.hash(ADMIN.password, 10),
      role: 'admin',
      phone: '9000000000',
    });
    console.log(`Created admin account: ${adminEmail}`);
  } else {
    console.log(`Admin account already exists: ${adminEmail}`);
  }

  const demoUsers = [];
  for (const u of SAMPLE_USERS) {
    const user = await User.create({
      name: u.name,
      email: u.email,
      phone: u.phone,
      passwordHash: await bcrypt.hash(u.password, 10),
      role: u.role,
      addresses: [
        {
          label: 'Home',
          fullName: u.name,
          phone: u.phone,
          line1: '42 Palm Grove Apartments, Indiranagar',
          line2: '100 Feet Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560038',
          isDefault: true,
        },
      ],
    });
    demoUsers.push(user);
  }
  console.log(`Seeded ${demoUsers.length} demo customers.`);

  const [riya, arjun, customer] = [demoUsers[1], demoUsers[2], demoUsers[0]];

  const order1 = await buildSampleOrder(customer, [{ name: PRODUCTS[0].name, quantity: 1 }, { name: PRODUCTS[9].name, quantity: 2 }], {
    paymentMethod: 'test',
    paymentStatus: 'paid',
    isSandboxPayment: true,
    orderStatus: 'Delivered',
    statusHistory: [
      { status: 'Confirmed', at: new Date(Date.now() - 12 * 864e5), by: 'system', note: 'Sample order' },
      { status: 'Delivered', at: new Date(Date.now() - 8 * 864e5), by: 'admin', note: 'Sample delivery' },
    ],
  });
  const order2 = await buildSampleOrder(customer, [{ name: PRODUCTS[11].name, quantity: 1 }], {
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    orderStatus: 'Processing',
    statusHistory: [
      { status: 'Confirmed', at: new Date(Date.now() - 3 * 864e5), by: 'system', note: 'Sample order' },
      { status: 'Processing', at: new Date(Date.now() - 2 * 864e5), by: 'admin', note: 'Packed' },
    ],
  });
  const order3 = await buildSampleOrder(riya, [{ name: PRODUCTS[16].name, quantity: 1 }, { name: PRODUCTS[12].name, quantity: 3 }], {
    paymentMethod: 'test',
    paymentStatus: 'paid',
    isSandboxPayment: true,
    orderStatus: 'Shipped',
    statusHistory: [
      { status: 'Confirmed', at: new Date(Date.now() - 5 * 864e5), by: 'system', note: 'Sample order' },
      { status: 'Shipped', at: new Date(Date.now() - 2 * 864e5), by: 'admin', note: 'Handed to courier' },
    ],
  });
  const order4 = await buildSampleOrder(arjun, [{ name: PRODUCTS[7].name, quantity: 1 }], {
    paymentMethod: 'test',
    paymentStatus: 'paid',
    isSandboxPayment: true,
    orderStatus: 'Delivered',
    statusHistory: [
      { status: 'Confirmed', at: new Date(Date.now() - 20 * 864e5), by: 'system', note: 'Sample order' },
      { status: 'Delivered', at: new Date(Date.now() - 15 * 864e5), by: 'admin', note: 'Sample delivery' },
    ],
  });
  const order5 = await buildSampleOrder(arjun, [{ name: PRODUCTS[3].name, quantity: 1 }], {
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    orderStatus: 'Cancelled',
    statusHistory: [
      { status: 'Confirmed', at: new Date(Date.now() - 6 * 864e5), by: 'system', note: 'Sample order' },
      { status: 'Cancelled', at: new Date(Date.now() - 5 * 864e5), by: 'admin', note: 'Customer request (sample)' },
    ],
  });
  console.log(`Seeded 5 sample orders (${order1.orderNumber} ... ${order5.orderNumber}).`);

  const userMap = Object.fromEntries(demoUsers.map((u) => [u.email, u]));
  for (const r of SAMPLE_REVIEWS) {
    const product = await Product.findOne({ name: r.product });
    const user = userMap[r.email];
    if (!product || !user) continue;
    await Review.create({ product: product._id, user: user._id, rating: r.rating, comment: r.comment });
  }
  console.log(`Seeded ${SAMPLE_REVIEWS.length} sample reviews.`);

  console.log('\nSeed complete.');
  console.log('---------------------------------------------');
  console.log(`Admin login     : ${adminEmail} / ${ADMIN.password}`);
  console.log('Customer login  : customer@shopx.com / Customer@123');
  console.log('Sample products : clearly marked with isSample=true');
  console.log('---------------------------------------------');
  await sleep(300);
  await mongoose.connection.close();
  process.exit(0);
};

seed().catch(async (err) => {
  console.error('Seed failed:', err);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
