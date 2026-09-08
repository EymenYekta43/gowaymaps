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

// 2. Haritaya Arama Motoru Ekleme
if (typeof L.Control.geocoder !== 'undefined') {
    L.Control.geocoder({
        defaultMarkGeocode: true,
        placeholder: "Şehir, adres veya konum ara..."
    }).addTo(map);
}

const markers = {};

// 3. Tema Değiştirme (Aydınlık / Karanlık Mod)
const themeToggleBtn = document.getElementById('themeToggleBtn');
let isDarkMode = true;

if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        document.body.classList.toggle('dark-mode', isDarkMode);
        document.body.classList.toggle('light-mode', !isDarkMode);
        
        const icon = themeToggleBtn.querySelector('i');
        icon.className = isDarkMode ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    });
}

// 4. Modallar ve Butonlar
const openFormBtn = document.getElementById('openFormBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const registerModal = document.getElementById('registerModal');

const openLoginBtn = document.getElementById('openLoginBtn');
const closeLoginModalBtn = document.getElementById('closeLoginModalBtn');
const loginModal = document.getElementById('loginModal');

if (openFormBtn && registerModal) openFormBtn.addEventListener('click', () => registerModal.style.display = 'flex');
if (closeModalBtn && registerModal) closeModalBtn.addEventListener('click', () => registerModal.style.display = 'none');

if (openLoginBtn && loginModal) openLoginBtn.addEventListener('click', () => loginModal.style.display = 'flex');
if (closeLoginModalBtn && loginModal) closeLoginModalBtn.addEventListener('click', () => loginModal.style.display = 'none');

window.addEventListener('click', (e) => {
    if (e.target === registerModal) registerModal.style.display = 'none';
    if (e.target === loginModal) loginModal.style.display = 'none';
});

// 5. Sürücü Kayıt İşlemi
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

// 6. Sürücü Girişi ve Konum Paylaşımını Başlatma
const loginForm = document.getElementById('loginForm');

if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const plate = document.getElementById('loginPlate').value;

        startTracking('driver_' + Date.now(), 'Sürücü (' + plate + ')', plate);
        alert(`Giriş başarılı! ${plate} plakalı araç için canlı konum paylaşımı başlatıldı.`);
        loginModal.style.display = 'none';
    });
}

// 7. Canlı Konum Yayınlama (GPS)
function startTracking(driverId, driverName, plate) {
    if ('geolocation' in navigator) {
        navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                socket.emit('sendLocation', {
                    id: driverId,
                    name: driverName,
                    plate: plate,
                    lat: latitude,
                    lng: longitude
                });
            },
            (error) => console.error("GPS Hatası:", error.message),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
    } else {
        alert("Cihazınız konum takibini desteklemiyor.");
    }
}

// 8. Socket.io Canlı Konumu Haritada Güncelleme
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
