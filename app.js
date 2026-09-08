// Render Backend Sunucu Bağlantısı
const BACKEND_URL = "https://gowaymaps-backend.onrender.com";
const socket = io(BACKEND_URL);

// 1. Haritayı Başlatma
const map = L.map('map').setView([39.9334, 32.8597], 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap | GOWay MAPS'
}).addTo(map);

// 2. Arama Motoru
if (typeof L.Control.geocoder !== 'undefined') {
    L.Control.geocoder({
        defaultMarkGeocode: true,
        placeholder: "Şehir, adres veya konum ara..."
    }).addTo(map);
}

const markers = {};

// 3. Tema Değiştirici
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

// 4. Modal Açma/Kapama İşlemleri
const openFormBtn = document.getElementById('openFormBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const registerModal = document.getElementById('registerModal');

const openLoginBtn = document.getElementById('openLoginBtn');
const closeLoginModalBtn = document.getElementById('closeLoginModalBtn');
const loginModal = document.getElementById('loginModal');

if (openFormBtn) openFormBtn.addEventListener('click', () => registerModal.style.display = 'flex');
if (closeModalBtn) closeModalBtn.addEventListener('click', () => registerModal.style.display = 'none');

if (openLoginBtn) openLoginBtn.addEventListener('click', () => loginModal.style.display = 'flex');
if (closeLoginModalBtn) closeLoginModalBtn.addEventListener('click', () => loginModal.style.display = 'none');

window.addEventListener('click', (e) => {
    if (e.target === registerModal) registerModal.style.display = 'none';
    if (e.target === loginModal) loginModal.style.display = 'none';
});

// 5. Sürücü Kaydı (Sunucu Uyanma Beklemeli)
const registerForm = document.getElementById('registerForm');

if (registerForm) {
    registerForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const submitBtn = document.getElementById('regSubmitBtn');
        submitBtn.innerText = "Gönderiliyor (Sunucuya Bağlanıyor...)...";
        submitBtn.disabled = true;

        const formData = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            plate: document.getElementById('plate').value,
            vehicleType: document.getElementById('vehicleType').value,
            photoUrl: document.getElementById('photoUrl').value || ''
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
                alert("Hata: " + (data.error || "Başvuru alınamadı."));
            }
        })
        .catch(err => {
            console.error("Hata:", err);
            alert("Sunucu uykuda olabilir veya yanıt vermiyor. Lütfen 30 saniye bekleyip tekrar deneyin.");
        })
        .finally(() => {
            submitBtn.innerText = "Başvuruyu Gönder";
            submitBtn.disabled = false;
        });
    });
}

// 6. Sürücü Girişi ve Konum Başlatma
const loginForm = document.getElementById('loginForm');

if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        
        const plate = document.getElementById('loginPlate').value;
        const vehicleType = document.getElementById('loginVehicleType').value;
        const photoUrl = document.getElementById('loginPhotoUrl').value || '';

        startTracking('driver_' + Date.now(), plate, vehicleType, photoUrl);
        
        alert(`Giriş Başarılı! ${plate} plakalı ${vehicleType} için canlı konum paylaşımı başlatıldı.`);
        loginModal.style.display = 'none';
    });
}

// 7. GPS Konum Yayınlama
function startTracking(driverId, plate, vehicleType, photoUrl) {
    if ('geolocation' in navigator) {
        navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                socket.emit('sendLocation', {
                    id: driverId,
                    plate: plate,
                    vehicleType: vehicleType,
                    photoUrl: photoUrl,
                    lat: latitude,
                    lng: longitude
                });
            },
            (error) => alert("GPS Konum İzni Verilmedi veya Alınamadı: " + error.message),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
    } else {
        alert("Cihazınız konum takibini desteklemiyor.");
    }
}

// 8. Socket.io ile Gelen Araçları Haritaya Ekleme
socket.on('updateLocation', (data) => {
    const { id, plate, vehicleType, photoUrl, lat, lng } = data;

    let imgHtml = photoUrl ? `<br><img src="${photoUrl}" class="vehicle-popup-img" alt="Araç Fotoğrafı" onError="this.style.display='none'">` : '';
    let popupContent = `<b>Plaka:</b> ${plate}<br><b>Tip:</b> ${vehicleType}${imgHtml}`;

    if (markers[id]) {
        markers[id].setLatLng([lat, lng]);
    } else {
        markers[id] = L.marker([lat, lng]).addTo(map)
            .bindPopup(popupContent)
            .openPopup();
    }
});
