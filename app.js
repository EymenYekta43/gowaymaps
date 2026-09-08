// Render Backend Sunucu Bağlantısı
const BACKEND_URL = "https://gowaymaps-backend.onrender.com";
const socket = io(BACKEND_URL);

// 1. Haritayı Başlatma (Ankara Merkezli)
const map = L.map('map').setView([39.9334, 32.8597], 6);

// OpenStreetMap Katmanı
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap | GOWay MAPS'
}).addTo(map);

// 2. Haritaya Arama Motorunu (Search Bar) Ekleme
if (typeof L.Control.geocoder !== 'undefined') {
    L.Control.geocoder({
        defaultMarkGeocode: true,
        placeholder: "Şehir, adres veya konum ara..."
    }).addTo(map);
}

// Marker Objesi
const markers = {};

// 3. Modal ve Buton Kontrolleri (Çalışmayan Tuşlar İçin)
const openFormBtn = document.getElementById('openFormBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const registerModal = document.getElementById('registerModal');

if (openFormBtn && registerModal) {
    openFormBtn.addEventListener('click', () => {
        registerModal.style.display = 'flex';
    });
}

if (closeModalBtn && registerModal) {
    closeModalBtn.addEventListener('click', () => {
        registerModal.style.display = 'none';
    });
}

window.addEventListener('click', (e) => {
    if (e.target === registerModal) {
        registerModal.style.display = 'none';
    }
});

// 4. Sürücü Kayıt Formu Gönderimi
const registerForm = document.getElementById('registerForm');

if (registerForm) {
    registerForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const formData = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            plate: document.getElementById('plate').value,
            vehicleType: document.getElementById('vehicleType').value
        };

        fetch(`${BACKEND_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert("Başvurunuz başarıyla alındı! Yönetici onayının ardından konum paylaşımı aktifleşecektir.");
                registerForm.reset();
                registerModal.style.display = 'none';
            } else {
                alert("Hata: " + data.error);
            }
        })
        .catch(err => {
            console.error("Hata:", err);
            alert("Sunucuya bağlanılamadı. Lütfen tekrar deneyin.");
        });
    });
}

// 5. Canlı Konum Alma (Socket.io)
socket.on('updateLocation', (data) => {
    const { id, name, plate, lat, lng } = data;

    if (markers[id]) {
        markers[id].setLatLng([lat, lng]);
    } else {
        markers[id] = L.marker([lat, lng]).addTo(map)
            .bindPopup(`<b>${name}</b><br>Plaka: ${plate}`)
            .openPopup();
    }
});
// --- TEMA DEĞİŞTİRME (AYDINLIK / KARANLIK MOD) ---
const themeToggleBtn = document.getElementById('themeToggleBtn');
let isDarkMode = true;

if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        document.body.classList.toggle('dark-mode', isDarkMode);
        document.body.classList.toggle('light-mode', !isDarkMode);
        
        const icon = themeToggleBtn.querySelector('i');
        if (isDarkMode) {
            icon.className = 'fa-solid fa-moon';
        } else {
            icon.className = 'fa-solid fa-sun';
        }
    });
}

// --- SÜRÜCÜ GİRİŞ YAP / KONUM BAŞLAT KONTROLÜ ---
const openLoginBtn = document.getElementById('openLoginBtn');
const loginModal = document.getElementById('loginModal');
const closeLoginModalBtn = document.getElementById('closeLoginModalBtn');
const loginForm = document.getElementById('loginForm');

if (openLoginBtn && loginModal) {
    openLoginBtn.addEventListener('click', () => {
        loginModal.style.display = 'flex';
    });
}

if (closeLoginModalBtn && loginModal) {
    closeLoginModalBtn.addEventListener('click', () => {
        loginModal.style.display = 'none';
    });
}

if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const plate = document.getElementById('loginPlate').value;

        // GPS Canlı Konum Paylaşımını Başlat
        startTracking('driver_' + Date.now(), 'Sürücü (' + plate + ')', plate);
        alert(`Giriş başarılı! ${plate} plakalı araç için canlı konum paylaşımı başlatıldı.`);
        loginModal.style.display = 'none';
    });
}
