const BACKEND_URL = "https://gowaymaps-backend.onrender.com";

// 1. Leaflet Haritası
const map = L.map('map').setView([39.92077, 32.85411], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap & GOWay MAPS'
}).addTo(map);

const driverMarkers = {};
const driverRoutes = {};

// 2. Tekil Socket.io Bağlantısı
const socket = io(BACKEND_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10
});

const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');

socket.on('connect', () => {
    console.log("✅ Sunucuya kesintisiz bağlandık!");
    statusBadge.classList.add('online');
    statusText.innerText = "Canlı Bağlantı Aktif";
});

socket.on('disconnect', () => {
    statusBadge.classList.remove('online');
    statusText.innerText = "Bağlantı Kesildi";
});

// 3. Canlı Konum ve Rota Çizimi
socket.on('updateLocation', (data) => {
    const { driverId, name, plate, lat, lng, speed, heading, routeGeometry, estimatedArrival } = data;
    if (!lat || !lng) return;

    document.getElementById('activeDriver').innerText = `${plate || 'Araç'} (${name || 'Sürücü'})`;
    document.getElementById('speedDisplay').innerText = `${Math.round(speed || 0)} km/s`;
    
    if (estimatedArrival) {
        const eta = new Date(estimatedArrival);
        document.getElementById('etaDisplay').innerText = eta.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    }

    const carIcon = L.divIcon({
        className: 'custom-car-icon',
        html: `<div style="transform: rotate(${heading || 0}deg); font-size: 28px; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));">🚗</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });

    if (!driverMarkers[driverId]) {
        driverMarkers[driverId] = L.marker([lat, lng], { icon: carIcon }).addTo(map);
        driverMarkers[driverId].bindPopup(`<b>${plate}</b><br>${name}`).openPopup();
        map.setView([lat, lng], 14);
    } else {
        driverMarkers[driverId].setLatLng([lat, lng]);
        driverMarkers[driverId].setIcon(carIcon);
    }

    if (routeGeometry && Array.isArray(routeGeometry) && routeGeometry.length > 0) {
        if (driverRoutes[driverId]) {
            driverRoutes[driverId].setLatLngs(routeGeometry);
        } else {
            driverRoutes[driverId] = L.polyline(routeGeometry, {
                color: '#1a73e8',
                weight: 6,
                opacity: 0.8
            }).addTo(map);
        }
    }
});

// 4. Form Gönderim İşlemi
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    const formResponse = document.getElementById('formResponse');

    submitBtn.disabled = true;
    submitBtn.innerText = "GÖNDERİLİYOR...";

    const formData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        plate: document.getElementById('plate').value,
        vehicleType: document.getElementById('vehicleType').value
    };

    try {
        const res = await fetch(`${BACKEND_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        const result = await res.json();

        if (result.success) {
            formResponse.style.color = "#2e7d32";
            formResponse.innerText = "✅ Başvuru alındı! Onay maili gönderildi.";
            document.getElementById('registerForm').reset();
        } else {
            formResponse.style.color = "#d93025";
            formResponse.innerText = "❌ " + (result.error || "Hata oluştu.");
        }
    } catch (err) {
        formResponse.style.color = "#d93025";
        formResponse.innerText = "❌ Sunucu hatası!";
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "BAŞVURUYU GÖNDER";
    }
});
