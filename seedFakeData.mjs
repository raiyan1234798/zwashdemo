/**
 * Zwash Demo - Fake Data Seeder
 * Run: node seedFakeData.mjs
 * Seeds realistic demo data into Firestore for bookings, customers, employees, and expenses.
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCCmkNhkx9FbUtV4m2IQM-LzvM0AdV4IVo",
  authDomain: "zwashdemo.firebaseapp.com",
  projectId: "zwashdemo",
  storageBucket: "zwashdemo.firebasestorage.app",
  messagingSenderId: "233891684120",
  appId: "1:233891684120:web:266e0ffcc84a164da0886d",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ── Helper ──
const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rndInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pastDate = (daysAgo) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return Timestamp.fromDate(d);
};

// ── Fake Data ──
const FIRST_NAMES = ['Arjun', 'Priya', 'Rahul', 'Sneha', 'Vikram', 'Ananya', 'Karthik', 'Meera', 'Aditya', 'Divya', 'Rohan', 'Kavitha', 'Sanjay', 'Nisha', 'Amit', 'Pooja', 'Deepak', 'Lakshmi', 'Rajesh', 'Sunita', 'Mohammed', 'Fatima', 'Hans', 'Sophia', 'Marco', 'Isabella'];
const LAST_NAMES = ['Sharma', 'Patel', 'Kumar', 'Singh', 'Gupta', 'Nair', 'Reddy', 'Verma', 'Joshi', 'Rao', 'Iyer', 'Menon', 'Das', 'Bhat', 'Chopra', 'Müller', 'Rossi', 'Ferrari'];
const CARS = [
  { make: 'BMW', model: '3 Series', plate: 'KA 01 AB 1234', type: 'sedan' },
  { make: 'Mercedes', model: 'C-Class', plate: 'MH 02 CD 5678', type: 'sedan' },
  { make: 'Audi', model: 'Q5', plate: 'DL 03 EF 9012', type: 'suv' },
  { make: 'Toyota', model: 'Fortuner', plate: 'TN 04 GH 3456', type: 'suv' },
  { make: 'Hyundai', model: 'Creta', plate: 'KA 05 IJ 7890', type: 'suv' },
  { make: 'Maruti', model: 'Swift', plate: 'MH 06 KL 2345', type: 'hatchback' },
  { make: 'Honda', model: 'City', plate: 'DL 07 MN 6789', type: 'sedan' },
  { make: 'Tata', model: 'Nexon', plate: 'KA 08 OP 1234', type: 'suv' },
  { make: 'Kia', model: 'Seltos', plate: 'TN 09 QR 5678', type: 'suv' },
  { make: 'Range Rover', model: 'Evoque', plate: 'MH 10 ST 9012', type: 'luxury_suv' },
  { make: 'Porsche', model: 'Macan', plate: 'DL 11 UV 3456', type: 'luxury_suv' },
  { make: 'Royal Enfield', model: 'Classic 350', plate: 'KA 12 WX 7890', type: 'bike' },
  { make: 'Honda', model: 'Activa', plate: 'MH 13 YZ 2345', type: 'scooter' },
];
const STATUSES = ['completed', 'completed', 'completed', 'completed', 'in-progress', 'pending', 'confirmed'];
const EMP_ROLES = ['Washer', 'Detailer', 'Polisher', 'Ceramic Specialist', 'Supervisor'];
const EXPENSE_CATS = ['Chemical Supplies', 'Equipment Maintenance', 'Water Bill', 'Electricity', 'Rent', 'Staff Refreshments', 'Polishing Pads', 'Microfiber Towels', 'Safety Gear'];

async function clearCollection(name) {
  const snap = await getDocs(collection(db, name));
  const deletes = snap.docs.map(d => deleteDoc(doc(db, name, d.id)));
  await Promise.all(deletes);
  console.log(`  ✓ Cleared ${snap.size} docs from '${name}'`);
}

async function seed() {
  console.log('\n🚀 Zwash Demo Data Seeder\n');

  // 1. Clear old fake data (keep services)
  console.log('🗑  Clearing old data...');
  for (const col of ['customers', 'bookings', 'employees', 'expenses', 'attendance']) {
    await clearCollection(col);
  }

  // 2. Seed Customers
  console.log('\n👥 Seeding customers...');
  const customerIds = [];
  for (let i = 0; i < 30; i++) {
    const first = rnd(FIRST_NAMES);
    const last = rnd(LAST_NAMES);
    const car = rnd(CARS);
    const ref = await addDoc(collection(db, 'customers'), {
      name: `${first} ${last}`,
      phone: `+91 ${rndInt(70000, 99999)} ${rndInt(10000, 99999)}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@gmail.com`,
      vehicleMake: car.make,
      vehicleModel: car.model,
      vehiclePlate: car.plate,
      vehicleType: car.type,
      vehicleColor: rnd(['White', 'Black', 'Silver', 'Blue', 'Red', 'Grey', 'Green']),
      totalVisits: rndInt(1, 12),
      totalSpent: rndInt(2000, 85000),
      notes: '',
      createdAt: pastDate(rndInt(5, 120)),
    });
    customerIds.push(ref.id);
  }
  console.log(`  ✓ Created ${customerIds.length} customers`);

  // 3. Load services for booking references
  const servSnap = await getDocs(collection(db, 'services'));
  const services = servSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`  📋 Found ${services.length} services to reference`);

  // 4. Seed Bookings
  console.log('\n📅 Seeding bookings...');
  for (let i = 0; i < 50; i++) {
    const svc = rnd(services);
    const car = rnd(CARS);
    const status = rnd(STATUSES);
    const daysAgo = rndInt(0, 30);
    const price = svc.prices ? (svc.prices[car.type] || svc.prices.sedan || 999) : (svc.price || 999);
    const first = rnd(FIRST_NAMES);
    const last = rnd(LAST_NAMES);
    await addDoc(collection(db, 'bookings'), {
      customerName: `${first} ${last}`,
      phone: `+91 ${rndInt(70000, 99999)} ${rndInt(10000, 99999)}`,
      vehicleMake: car.make,
      vehicleModel: car.model,
      vehiclePlate: car.plate,
      vehicleType: car.type,
      serviceId: svc.id,
      serviceName: svc.name,
      price: price,
      status: status,
      date: new Date(Date.now() - daysAgo * 86400000).toISOString().split('T')[0],
      time: rnd(['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00']),
      notes: rnd(['', '', '', 'Please handle with care', 'Scratch on left door', 'Customer is VIP', 'Second visit this month']),
      paymentStatus: status === 'completed' ? 'paid' : 'pending',
      paymentMethod: rnd(['cash', 'upi', 'card', 'online']),
      source: rnd(['walk-in', 'phone', 'booking-website', 'whatsapp']),
      createdAt: pastDate(daysAgo),
    });
  }
  console.log('  ✓ Created 50 bookings');

  // 5. Seed Employees
  console.log('\n👷 Seeding employees...');
  const empNames = ['Suresh M.', 'Ramesh K.', 'Ganesh P.', 'Vijay R.', 'Anand S.', 'Manoj T.', 'Ravi D.', 'Prakash N.'];
  for (const name of empNames) {
    await addDoc(collection(db, 'employees'), {
      name: name,
      phone: `+91 ${rndInt(70000, 99999)} ${rndInt(10000, 99999)}`,
      role: rnd(EMP_ROLES),
      salary: rndInt(12000, 28000),
      joinDate: pastDate(rndInt(30, 365)).toDate().toISOString().split('T')[0],
      status: 'active',
      email: `${name.split(' ')[0].toLowerCase()}@zwash.in`,
      address: `${rndInt(1, 200)}, ${rnd(['MG Road', 'Brigade Road', 'Indiranagar', 'Koramangala', 'HSR Layout'])}, Bangalore`,
      createdAt: pastDate(rndInt(30, 365)),
    });
  }
  console.log(`  ✓ Created ${empNames.length} employees`);

  // 6. Seed Expenses
  console.log('\n💰 Seeding expenses...');
  for (let i = 0; i < 25; i++) {
    const cat = rnd(EXPENSE_CATS);
    await addDoc(collection(db, 'expenses'), {
      description: `${cat} - ${rnd(['Monthly', 'Weekly', 'Quarterly', 'One-time'])} purchase`,
      category: cat,
      amount: rndInt(500, 15000),
      date: new Date(Date.now() - rndInt(0, 60) * 86400000).toISOString().split('T')[0],
      paymentMethod: rnd(['cash', 'upi', 'bank_transfer']),
      vendor: rnd(['QuickSupply Co.', 'AutoChem India', 'CleanPro', 'BrightShine', 'Local Market', 'Amazon Business']),
      createdAt: pastDate(rndInt(0, 60)),
    });
  }
  console.log('  ✓ Created 25 expenses');

  console.log('\n✅ All demo data seeded successfully!\n');
  process.exit(0);
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
