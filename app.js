// Render Backend Sunucu Bağlantısı
const BACKEND_URL = "https://gowaymaps-backend.onrender.com";
const socket = io(BACKEND_URL);

// Harita Başlatma (Varsayılan Türkiye / Ankara Merkezli)
const map = L.map('map').setView([39.9334, 32.8597], 6);

// OpenStreetMap Katmanı Ekleme
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap katkıda bulunanlar | GOWay MAPS'
}).addTo(map);

// Haritadaki İşaretçileri (Marker) Saklama Objesi
const markers = {};

// --- 1. SÜRÜCÜ KAYIT FORMU İŞLEMLERİ ---
const registerForm = document.getElementById('registerForm');

if (registerForm) {
    registerForm.addEventListener('submit', function (e) {
        e.preventDefault();

        // Form Verilerini Toplama
        const formData = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            plate: document.getElementById('plate').value,
            vehicleType: document.getElementById('vehicleType').value
        };

        // Render Sunucusuna Onay ve Kayıt İsteği Atma
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
            } else {
                alert("Başvuru gönderilirken bir hata oluştu: " + data.error);
            }
        })
        .catch(err => {
            console.error("Bağlantı Hatası:", err);
            alert("Sunucuya bağlanılamadı. Lütfen internet bağlantınızı ve sunucu durumunu kontrol edin.");
        });
    });
}

// --- 2. CANLI KONUM GÖNDERME (SÜRÜCÜ İÇİN) ---
function startTracking(driverId, driverName, plate) {
    if ('geolocation' in navigator) {
        navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;

                // Socket.io üzerinden canlı konumu yayınlama
                socket.emit('sendLocation', {
                    id: driverId,
                    name: driverName,
                    plate: plate,
                    lat: latitude,
                    lng: longitude
                });
            },
            (error) => {
                console.error("GPS Konum Hatası:", error.message);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 5000
            }
        );
    } else {
        alert("Cihazınız canlı konum takibini desteklemiyor.");
    }
}

// --- 3. CANLI KONUM ALMA VE HARİTADA GÖSTERME (HERKES İÇİN) ---
socket.on('updateLocation', (data) => {
    const { id, name, plate, lat, lng } = data;

    // Eğer sürücü haritada zaten varsa konumunu güncelle
    if (markers[id]) {
        markers[id].setLatLng([lat, lng]);
    } else {
        // Yeni sürücüyü haritaya ekle ve popup (bilgi penceresi) oluştur
        markers[id] = L.marker([lat, lng]).addTo(map)
            .bindPopup(`<b>${name}</b><br>Plaka: ${plate}`)
            .openPopup();
    }
});
