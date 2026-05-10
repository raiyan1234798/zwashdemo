/* ── Zwash Booking – App Logic ── */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, getDocs, addDoc, serverTimestamp, query, where } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import translations from './i18n-data.js';

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

// ── GLOBAL STATE ──
let allServices = [];
let allPartners = [];
let selectedVehicle = 'sedan';
let currentCurrency = localStorage.getItem('currency') || 'USD';
let exchangeRates = {};

// ── LANGUAGE DATA ──
const LANGUAGES = [
  { code: 'en', flag: '🇺🇸', name: 'English' },
  { code: 'es', flag: '🇪🇸', name: 'Español' },
  { code: 'fr', flag: '🇫🇷', name: 'Français' },
  { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
  { code: 'ar', flag: '🇸🇦', name: 'العربية' },
  { code: 'zh', flag: '🇨🇳', name: '中文' },
  { code: 'hi', flag: '🇮🇳', name: 'हिन्दी' },
  { code: 'ja', flag: '🇯🇵', name: '日本語' },
  { code: 'ru', flag: '🇷🇺', name: 'Русский' },
  { code: 'pt', flag: '🇧🇷', name: 'Português' },
  { code: 'tr', flag: '🇹🇷', name: 'Türkçe' },
  { code: 'it', flag: '🇮🇹', name: 'Italiano' },
  { code: 'ko', flag: '🇰🇷', name: '한국어' },
  { code: 'nl', flag: '🇳🇱', name: 'Nederlands' },
  { code: 'pl', flag: '🇵🇱', name: 'Polski' },
  { code: 'vi', flag: '🇻🇳', name: 'Tiếng Việt' },
  { code: 'th', flag: '🇹🇭', name: 'ไทย' },
  { code: 'id', flag: '🇮🇩', name: 'Bahasa Indonesia' },
  { code: 'sv', flag: '🇸🇪', name: 'Svenska' },
  { code: 'bn', flag: '🇧🇩', name: 'বাংলা' },
];

// ── CURRENCY DATA ──
const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti Dinar' },
  { code: 'QAR', symbol: 'ر.ق', name: 'Qatari Riyal' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
];

// ── DROPDOWN BUILDER ──
function buildDropdown(listId, searchId, items, currentCode, onSelect) {
  const list = document.getElementById(listId);
  const search = document.getElementById(searchId);
  if (!list) return;

  const render = (filter = '') => {
    const filtered = items.filter(i =>
      i.name.toLowerCase().includes(filter.toLowerCase()) ||
      i.code.toLowerCase().includes(filter.toLowerCase())
    );
    list.innerHTML = filtered.map(item => `
      <div class="dropdown-item ${item.code === currentCode ? 'active' : ''}"
           data-code="${item.code}">
        ${item.flag ? `<span class="di-flag">${item.flag}</span>` : ''}
        <span class="di-code">${item.code}</span>
        <span class="di-name">${item.name}</span>
      </div>
    `).join('');
    list.querySelectorAll('.dropdown-item').forEach(el => {
      el.addEventListener('click', () => onSelect(el.dataset.code));
    });
  };

  render();
  if (search) search.addEventListener('input', e => render(e.target.value));
}

function initDropdowns() {
  const savedLang = localStorage.getItem('language') || 'en';
  const langObj = LANGUAGES.find(l => l.code === savedLang) || LANGUAGES[0];
  document.getElementById('langFlag').textContent = langObj.flag;
  document.getElementById('langLabel').textContent = langObj.code.toUpperCase();

  const currObj = CURRENCIES.find(c => c.code === currentCurrency) || CURRENCIES[0];
  document.getElementById('currLabel').textContent = currObj.code;

  buildDropdown('langList', 'langSearch', LANGUAGES, savedLang, (code) => {
    const obj = LANGUAGES.find(l => l.code === code);
    document.getElementById('langFlag').textContent = obj.flag;
    document.getElementById('langLabel').textContent = code.toUpperCase();
    i18next.changeLanguage(code);
    localStorage.setItem('language', code);
    document.dir = code === 'ar' ? 'rtl' : 'ltr';
    updateContent();
    closeAllDropdowns();
  });

  buildDropdown('currList', 'currSearch', CURRENCIES, currentCurrency, (code) => {
    currentCurrency = code;
    localStorage.setItem('currency', code);
    document.getElementById('currLabel').textContent = code;
    renderServices(document.querySelector('.cat-tab.active')?.dataset.cat || 'all');
    populateServiceSelect();
    renderPricing();
    closeAllDropdowns();
  });

  // Toggle dropdowns
  document.getElementById('langBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = document.getElementById('langMenu');
    const isOpen = menu.classList.contains('open');
    closeAllDropdowns();
    if (!isOpen) menu.classList.add('open');
  });

  document.getElementById('currBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = document.getElementById('currMenu');
    const isOpen = menu.classList.contains('open');
    closeAllDropdowns();
    if (!isOpen) menu.classList.add('open');
  });

  document.addEventListener('click', closeAllDropdowns);
}

function closeAllDropdowns() {
  document.querySelectorAll('.nav-dropdown-menu').forEach(m => m.classList.remove('open'));
}

// ── CURRENCY ──
async function initCurrency() {
  try {
    const res = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
    exchangeRates = res.data.rates;
  } catch {
    exchangeRates = { USD: 1, EUR: 0.92, GBP: 0.79, INR: 83.3, AED: 3.67, SAR: 3.75, JPY: 149, CNY: 7.2 };
  }
}

function formatPrice(amount, fromCurrency = 'INR') {
  const fromRate = exchangeRates[fromCurrency] || 1;
  const amountInUSD = amount / fromRate;
  const targetRate = exchangeRates[currentCurrency] || 1;
  const converted = amountInUSD * targetRate;
  return new Intl.NumberFormat(i18next.language || 'en', {
    style: 'currency', currency: currentCurrency, maximumFractionDigits: 0
  }).format(converted);
}

function renderPricing() {
    const p1 = document.getElementById('planPrice1');
    const p2 = document.getElementById('planPrice2');
    if (p1) p1.innerHTML = `${formatPrice(49, 'USD')}<span class="price-period">/mo</span>`;
    if (p2) p2.innerHTML = `${formatPrice(99, 'USD')}<span class="price-period">/mo</span>`;
}

// ── I18N ──
i18next.init({
  lng: localStorage.getItem('language') || 'en',
  fallbackLng: 'en',
  resources: translations
}, () => updateContent());

function updateContent() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.innerText = i18next.t(el.getAttribute('data-i18n'));
  });
  const nameInput = document.querySelector('input[name="name"]');
  if (nameInput) nameInput.placeholder = i18next.t('placeholder_name') || 'John Doe';
  const notesArea = document.querySelector('#notesArea');
  if (notesArea) notesArea.placeholder = i18next.t('placeholder_notes') || 'Any special requirements...';
  renderCategoryTabs();
  renderServices(document.querySelector('.cat-tab.active')?.dataset.cat || 'all');
  populateServiceSelect();
}

// ── SCROLL ANIMATION (Framer-style) ──
const canvas = document.getElementById('heroCanvas');
const ctx = canvas?.getContext('2d');
let currentFrame = -1;
let targetFrame = 0;
const TOTAL_FRAMES = 124;
const frameImages = [];
let framesLoaded = 0;

const loadingOverlay = document.createElement('div');
loadingOverlay.style = 'position:fixed;inset:0;background:#060b18;z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;transition:opacity 0.8s ease;font-family:Inter,sans-serif;';
loadingOverlay.innerHTML = `
  <img src="/logo.png" style="height:60px;margin-bottom:24px;animation:pulse 2s infinite">
  <div style="width:200px;height:4px;background:rgba(255,255,255,0.08);border-radius:10px;overflow:hidden;margin-bottom:12px;">
    <div id="loadBar" style="width:0%;height:100%;background:#2563eb;transition:width 0.3s ease;"></div>
  </div>
  <div id="loadText" style="font-size:0.8rem;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;">Loading Experience 0%</div>
  <style>@keyframes pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.6; transform:scale(0.95); } }</style>
`;
document.body.appendChild(loadingOverlay);

const finishLoading = () => {
  setTimeout(() => {
    loadingOverlay.style.opacity = '0';
    setTimeout(() => loadingOverlay.remove(), 800);
    updateAnimation();
  }, 500);
};

for (let i = 1; i <= TOTAL_FRAMES; i++) {
  const img = new Image();
  img.src = `/frames/frame_${String(i).padStart(4, '0')}.jpg`;
  img.onload = () => {
    framesLoaded++;
    const pct = Math.round((framesLoaded / TOTAL_FRAMES) * 100);
    const bar = document.getElementById('loadBar');
    const txt = document.getElementById('loadText');
    if (bar) bar.style.width = pct + '%';
    if (txt) txt.textContent = `Loading Experience ${pct}%`;
    if (framesLoaded === TOTAL_FRAMES) finishLoading();
  };
  img.onerror = () => { framesLoaded++; if (framesLoaded === TOTAL_FRAMES) finishLoading(); };
  frameImages.push(img);
}

function drawFrame(index) {
  if (index === currentFrame || !ctx) return;
  const img = frameImages[index];
  if (!img || !img.complete) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const imgRatio = 1280 / 720;
  const canvasRatio = canvas.width / canvas.height;
  let drawW, drawH, drawX, drawY;
  if (canvasRatio > imgRatio) {
    drawW = canvas.width; drawH = canvas.width / imgRatio;
    drawX = 0; drawY = (canvas.height - drawH) / 2;
  } else {
    drawH = canvas.height; drawW = canvas.height * imgRatio;
    drawX = (canvas.width - drawW) / 2; drawY = 0;
  }
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  currentFrame = index;
}

function updateAnimation() {
  const diff = targetFrame - currentFrame;
  if (Math.abs(diff) > 0.1) drawFrame(Math.round(currentFrame + diff * 0.15));
  else drawFrame(targetFrame);
  requestAnimationFrame(updateAnimation);
}

const heroSection = document.getElementById('hero');
const heroContent = document.querySelector('.hero-content');
const scrollIndicator = document.querySelector('.scroll-indicator');

window.addEventListener('scroll', () => {
  const scrollTop = window.scrollY;
  const heroHeight = (heroSection?.offsetHeight || window.innerHeight * 2.5) - window.innerHeight;
  const progress = Math.min(Math.max(scrollTop / heroHeight, 0), 1);
  targetFrame = Math.min(Math.floor(progress * (TOTAL_FRAMES - 1)), TOTAL_FRAMES - 1);
  const contentFade = Math.max(1 - scrollTop / (window.innerHeight * 0.4), 0);
  if (heroContent) {
    heroContent.style.opacity = contentFade;
    heroContent.style.transform = `translateY(${-scrollTop * 0.2}px)`;
    heroContent.style.pointerEvents = contentFade < 0.1 ? 'none' : 'auto';
  }
  if (scrollIndicator) scrollIndicator.style.opacity = contentFade;
  document.getElementById('nav')?.classList.toggle('scrolled', scrollTop > 80);
}, { passive: true });

// ── SERVICES ──
async function initDynamicData() {
  await initCurrency();
  try {
    const snapshot = await getDocs(collection(db, 'services'));
    allServices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(s => s.isActive !== false);
    allServices.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    renderCategoryTabs();
    renderServices('all');
    populateServiceSelect();
    renderPricing();
  } catch (err) {
    console.error('Error fetching services:', err);
    const grid = document.getElementById('servicesGrid');
    if (grid) grid.innerHTML = '<p style="color:#94a3b8;text-align:center">Failed to load services.</p>';
  }

  // Load partners (company tenants)
  loadPartners();
}

async function loadPartners() {
  const grid = document.getElementById('partnersGrid');
  if (!grid) return;
  try {
    const snap = await getDocs(collection(db, 'companies'));
    allPartners = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(c => c.isActive !== false);
    renderPartners(allPartners);
  } catch {
    // Fallback demo partners if Firestore has no companies collection
    allPartners = [
      { id: 'demo1', name: 'AutoShine Premium', location: 'Dubai, UAE', rating: 4.9, services: 12, tags: ['Ceramic', 'Detailing', 'Paint'], emoji: '🚗' },
      { id: 'demo2', name: 'SparkleWash Co.', location: 'Mumbai, India', rating: 4.8, services: 8, tags: ['Express', 'Interior', 'Polish'], emoji: '✨' },
      { id: 'demo3', name: 'ProClean Garage', location: 'Riyadh, Saudi Arabia', rating: 4.7, services: 10, tags: ['Detailing', 'Wrap', 'PPF'], emoji: '🏁' },
      { id: 'demo4', name: 'LuxeWash Studio', location: 'London, UK', rating: 5.0, services: 15, tags: ['Luxury', 'Ceramic', 'Full Detail'], emoji: '💎' },
      { id: 'demo5', name: 'SwiftCar Care', location: 'Singapore', rating: 4.6, services: 6, tags: ['Express', 'Foam', 'Wax'], emoji: '⚡' },
      { id: 'demo6', name: 'GlossyFinish Pro', location: 'Toronto, Canada', rating: 4.8, services: 9, tags: ['Polish', 'Interior', 'Steam'], emoji: '🌟' },
    ];
    renderPartners(allPartners);
  }
}

function renderPartners(partners) {
  const grid = document.getElementById('partnersGrid');
  if (!grid) return;
  if (!partners.length) {
    grid.innerHTML = '<div class="partner-empty"><p>No partners found.</p></div>';
    return;
  }
  grid.innerHTML = partners.map(p => {
    const tags = (p.tags || p.services_offered || []).slice(0, 3);
    const rating = p.rating || (4.5 + Math.random() * 0.5).toFixed(1);
    const svcCount = p.services || p.serviceCount || Math.floor(Math.random() * 10 + 5);
    const emoji = p.emoji || '🚗';
    return `
      <div class="partner-card" onclick="openPartnerBooking('${p.id}')">
        <div class="pc-header">
          <div class="pc-avatar">${emoji}</div>
          <div class="pc-name-block">
            <h3>${p.name || p.companyName || 'Zwash Partner'}</h3>
            <span class="pc-location">📍 ${p.location || p.city || 'Location'}</span>
          </div>
        </div>
        <div class="pc-rating">⭐ ${rating} <span style="color:#64748b;font-weight:500">rating</span></div>
        <div class="pc-services-count">${svcCount} services available</div>
        ${tags.length ? `<div class="pc-tags">${tags.map(t => `<span class="pc-tag">${t}</span>`).join('')}</div>` : ''}
        <button class="pc-book-btn">Book with this Partner →</button>
      </div>
    `;
  }).join('');
}

window.openPartnerBooking = (partnerId) => {
  document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' });
};

// Partner search
document.getElementById('partnerSearch')?.addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  const filtered = allPartners.filter(p =>
    (p.name || p.companyName || '').toLowerCase().includes(q) ||
    (p.location || p.city || '').toLowerCase().includes(q)
  );
  renderPartners(filtered);
});

function renderCategoryTabs() {
  const container = document.getElementById('categoryTabs');
  if (!container) return;
  const categories = ['all', ...new Set(allServices.map(s => s.category).filter(Boolean))];
  container.innerHTML = categories.map(cat => `
    <button class="cat-tab ${cat === 'all' ? 'active' : ''}" data-cat="${cat}">
      ${i18next.t(cat === 'all' ? 'cat_all' : cat) || cat.charAt(0).toUpperCase() + cat.slice(1)}
    </button>
  `).join('');
  container.querySelectorAll('.cat-tab').forEach(btn => {
    btn.onclick = () => {
      container.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderServices(btn.dataset.cat);
    };
  });
}

function renderServices(category) {
  const grid = document.getElementById('servicesGrid');
  if (!grid) return;
  const filtered = category === 'all' ? allServices : allServices.filter(s => s.category === category);
  if (!filtered.length) {
    grid.innerHTML = '<p style="color:#94a3b8;text-align:center;grid-column:1/-1">No services found.</p>';
    return;
  }
  grid.innerHTML = filtered.map(s => {
    const price = s.prices ? (s.prices.sedan || s.prices.bike || s.price || 0) : (s.price || 0);
    return `
      <div class="service-card" data-service-id="${s.id}">
        <div class="sc-tag">${i18next.t(s.category) || s.category || 'Service'}</div>
        <h3>${s.name}</h3>
        <p>${s.description || ''}</p>
        <div class="sc-meta">
          <span class="sc-price">${formatPrice(price)}+</span>
          <span class="sc-time">⏱ ${s.durationMinutes || 30} min</span>
        </div>
        <button class="sc-book-btn" onclick="preBookService('${s.id}')">${i18next.t('book_this_service') || 'Book This Service'}</button>
      </div>
    `;
  }).join('');
}

function populateServiceSelect() {
  const select = document.getElementById('serviceSelect');
  if (!select) return;
  select.innerHTML = `<option value="">${i18next.t('choose_service') || 'Choose a service'}</option>` +
    allServices.map(s => {
      const price = s.prices ? (s.prices.sedan || s.prices.bike || s.price || 0) : (s.price || 0);
      return `<option value="${s.id}">${s.name} - ${i18next.t('from') || 'from'} ${formatPrice(price)}</option>`;
    }).join('');
}

window.preBookService = (serviceId) => {
  const select = document.getElementById('serviceSelect');
  if (select) {
    select.value = serviceId;
    document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' });
    checkSlotAvailability();
  }
};

document.getElementById('vehicleSelector')?.addEventListener('click', e => {
  const btn = e.target.closest('.veh-btn');
  if (!btn) return;
  document.querySelectorAll('.veh-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedVehicle = btn.dataset.veh;
  renderPricing();
});



// ── SLOT CHECK ──
async function checkSlotAvailability() {
  const dateStr = document.querySelector('input[name="date"]')?.value;
  const timeSelect = document.querySelector('select[name="time"]');
  if (!dateStr || !timeSelect) return;
  const now = new Date();
  const localToday = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  const isToday = dateStr === localToday;
  const currentHour = now.getHours();
  Array.from(timeSelect.options).forEach(opt => {
    if (!opt.value) return;
    opt.disabled = false; opt.style.display = 'block';
    if (isToday) {
      const [h] = opt.value.split(':').map(Number);
      if (h <= currentHour) { opt.style.display = 'none'; opt.disabled = true; }
    }
  });
  try {
    const q = query(collection(db, 'bookings'), where('bookingDate', '==', dateStr));
    const snap = await getDocs(q);
    snap.docs.map(doc => doc.data().startTime).forEach(time => {
      const opt = Array.from(timeSelect.options).find(o => o.value === time);
      if (opt) { opt.style.display = 'none'; opt.disabled = true; }
    });
  } catch {}
}

const dateInput = document.querySelector('input[name="date"]');
if (dateInput) {
  const today = new Date().toISOString().split('T')[0];
  dateInput.min = today;
  dateInput.value = today;
  dateInput.addEventListener('change', checkSlotAvailability);
}
setTimeout(checkSlotAvailability, 2000);

// ── BOOKING SUBMIT ──
document.getElementById('bookingForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('submitBtn');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = i18next.t('securing_slot') || 'Securing Slot...';
  const fd = new FormData(e.target);
  const service = allServices.find(s => s.id === fd.get('service'));
  const vehicleType = fd.get('vehicleType');
  const price = service?.prices?.[vehicleType] || service?.price || 0;
  try {
    const refId = 'ZW-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    await addDoc(collection(db, 'bookings'), {
      customerName: fd.get('name'),
      contactPhone: fd.get('phone'),
      email: fd.get('email') || '',
      vehicleType,
      serviceId: fd.get('service'),
      serviceName: service?.name || 'Custom Service',
      bookingDate: fd.get('date'),
      startTime: fd.get('time'),
      notes: fd.get('notes') || '',
      price, paidAmount: 0,
      status: 'pending_confirmation',
      bookingReference: refId,
      source: 'Booking Portal',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      licensePlate: 'NEW-REQUEST',
      location: 'Online Booking'
    });
    document.getElementById('successModal').style.display = 'flex';
    e.target.reset();
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    checkSlotAvailability();
  } catch (err) {
    console.error('Booking error:', err);
    alert(i18next.t('error_booking') || 'Something went wrong. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = i18next.t('btn_submit') || 'Submit Booking Request';
  }
});

// ── ERP CONTACT LOGIC ──
window.openModal = (id) => {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'flex';
};
window.closeModal = (id) => {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
};

document.querySelectorAll('.erp-contact-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
        const plan = btn.dataset.plan;
        document.getElementById('erpModalTitle').textContent = `Contact Zwash for ${plan} Plan`;
        document.getElementById('erpModalSub').textContent = `Choose how you'd like to get started with our ${plan} features.`;
        window.openModal('erpContactModal');
    });
});

document.getElementById('erpEnquiryForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Sending...';
    
    try {
        const plan = document.getElementById('erpModalTitle').textContent.split('Plan')[0].split('for')[1].trim();
        await addDoc(collection(db, 'platformEnquiries'), {
            fullName: document.getElementById('erpName').value,
            businessEmail: document.getElementById('erpEmail').value,
            inquiry: document.getElementById('erpMessage').value,
            budget: plan, // Mapping plan to budget column in dashboard
            status: 'new',
            source: 'Zwash Booking Portal - ERP Plans',
            createdAt: serverTimestamp(),
            phone: document.getElementById('erpPhone').value
        });
        alert('Enquiry sent successfully! Our sales team will contact you soon.');
        closeModal('erpContactModal');
        e.target.reset();
    } catch (err) {
        console.error('Enquiry error:', err);
        alert('Failed to send enquiry. Please try Gmail or Phone.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Send Message to Superadmin';
    }
});

// ── HAMBURGER ──
document.getElementById('hamburger')?.addEventListener('click', () => {
  const links = document.getElementById('navLinks');
  if (links) links.classList.toggle('open');
});

// ── INIT ──
initDropdowns();
initDynamicData();
window.onclick = (e) => {
    if (e.target.classList.contains('modal')) e.target.style.display = 'none';
};
