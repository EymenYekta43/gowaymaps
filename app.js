// Harita Başlatma
const map = L.map('map').setView([39.92077, 32.85411], 6); // Türkiye Odaklı Başlangıç

// Harita Katmanları (Aydınlık / Karanlık)
const darkTile = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 });
const lightTile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });

darkTile.addTo(map);

// Özel Logolar
const logisticIcon = L.icon({
    iconUrl: 'https://i.imgur.com/8Q9Z4Xm.png', // Yük/Kamyon görseli ikonu
    iconSize: [40, 40],
    iconAnchor: [20, 20]
});

const publicIcon = L.icon({
    iconUrl: 'https://i.imgur.com/Y34N2gM.png', // Otomobil/Ulaşım ikonu
    iconSize: [35, 35],
    iconAnchor: [17, 17]
});

// Örnek Araç Verileri (Canlı Takip Simülasyonu)
const vehicles = [
    {
        id: "GW-1042",
        plate: "43 LGT 88",
        type: "Lojistik Transfer Aracı",
        driverStatus: "Trafikte İlerliyor",
        capacity: "%85 Dolu",
        startPoint: "Kütahya Lojistik Merkezi",
        endPoint: "Ankara Depo",
        departureTime: "08:30",
        estDeparture: "08:30",
        estArrival: "13:45",
        realArrival: "--:--",
        speed: 78,
        lat: 39.4242,
        lng: 29.9833,
        photo: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=500",
        icon: logisticIcon
    },
    {
        id: "GW-2055",
        plate: "06 BUS 01",
        type: "Genel Ulaşım Aracı",
        driverStatus: "Mola Verdi",
        capacity: "12 Boş Koltuk",
        startPoint: "Ankara AŞTİ",
        endPoint: "İstanbul Harem",
        departureTime: "10:00",
        estDeparture: "10:00",
        estArrival: "16:00",
        realArrival: "--:--",
        speed: 0,
        lat: 40.7358,
        lng: 31.6061,
        photo: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=500",
        icon: publicIcon
    }
];

// Araçları Haritaya Ekleme
vehicles.forEach(vehicle => {
    const marker = L.marker([vehicle.lat, vehicle.lng], { icon: vehicle.icon }).addTo(map);
    
    marker.on('click', () => {
        showVehicleDetails(vehicle);
    });
});

// Araç Detay Paneli Gösterme
function showVehicleDetails(v) {
    const panel = document.getElementById('detailPanel');
    const content = document.getElementById('panelContent');
    
    content.innerHTML = `
        <img src="${v.photo}" class="vehicle-img" alt="Araç Fotoğrafı">
        <h3>${v.plate} <small>(${v.id})</small></h3>
        <p><strong>Tür:</strong> ${v.type}</p>
        <p><strong>Durum:</strong> <span style="color:#00adb5;">${v.driverStatus}</span></p>
        <p><strong>Kapasite / Doluluk:</strong> ${v.capacity}</p>
        <p><strong>Anlık Hız:</strong> ${v.speed} km/s</p>
        <hr style="margin:10px 0; border-color:#444;">
        <p><strong>Güzergah:</strong> ${v.startPoint} ➔ ${v.endPoint}</p>
        <p><strong>Çıkış Saati:</strong> ${v.departureTime}</p>
        <p><strong>Tahmini Varış:</strong> ${v.estArrival}</p>
        <p><strong>Gerçek Varış:</strong> ${v.realArrival}</p>
        <br>
        <button class="btn-primary" style="width:100%" onclick="shareRoute('${v.id}')">📲 WhatsApp ile Sefer Paylaş</button>
    `;
    
    panel.classList.remove('hidden');
}

function closeDetailPanel() {
    document.getElementById('detailPanel').classList.add('hidden');
}

// Tema Değiştirme
let isDark = true;
function toggleTheme() {
    isDark = !isDark;
    document.body.className = isDark ? 'dark-theme' : 'light-theme';
    if (isDark) {
        map.removeLayer(lightTile);
        darkTile.addTo(map);
    } else {
        map.removeLayer(darkTile);
        lightTile.addTo(map);
    }
}

// Modal Yonetimi
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    if(tab === 'login') {
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
        document.getElementById('loginForm').classList.add('active');
    } else {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        document.getElementById('registerForm').classList.add('active');
    }
}

function toggleCustomVehicleInput(select) {
    const input = document.getElementById('customVehicleInput');
    if (select.value === 'custom') {
        input.classList.remove('hidden');
    } else {
        input.classList.add('hidden');
    }
}

// Kayıt Başvurusu (Admin E-posta Simülasyonu)
function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('regEmail').value;
    alert(`Başvurunuz alındı! 'info.eyem43@gmail.com' adresine onay e-postası gönderildi. Admin onayından sonra giriş yapabilirsiniz.`);
    closeModal('loginModal');
}

function handleLogin(e) {
    e.preventDefault();
    alert("Giriş başarılı! Konum paylaşım paneli aktifleşti.");
    closeModal('loginModal');
}

function shareRoute(id) {
    const url = `https://gowaymaps.com/sefer/${id}`;
    window.open(`https://api.whatsapp.com/send?text=GOWay MAPS Canlı Araç Takip Linki: ${url}`);
}