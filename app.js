const BACKEND_URL = "https://gowaymaps-backend.onrender.com";

let currentUser = JSON.parse(localStorage.getItem('goway_user')) || null;
let watchId = null;
let manualSpeed = 60;

// Harita Kurulumu
const map = L.map('map').setView([39.92077, 32.85411], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap & GOWay MAPS'
}).addTo(map);

const driverMarkers = {};
const activeRoutes = {};   // Şu an izlenen mavi rota
const historyRoutes = {};  // Geçmiş izlenen gri/gri-mavi rota

// Socket Bağlantısı
const socket = io(BACKEND_URL, { transports: ['websocket', 'polling'] });

socket.on('connect', () => {
    document.getElementById('statusBadge').classList.add('online');
    document.getElementById('statusText').innerText = "Canlı Bağlantı Aktif";
});

socket.on('disconnect', () => {
    document.getElementById('statusBadge').classList.remove('online');
    document.getElementById('statusText').innerText = "Bağlantı Kesildi";
});

function switchTab(tabId, event) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    if (event) event.target.classList.add('active');
}

function updateSpeedValue(val) {
    manualSpeed = parseInt(val);
    document.getElementById('speedValLabel').innerText = `${val} km/s`;
}

function formatDate(dateStr) {
    if (!dateStr) return '--:--';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) + ' (' + d.toLocaleDateString('tr-TR') + ')';
}

function checkAuth() {
    if (currentUser) {
        document.getElementById('userInfoBox').style.display = 'flex';
        document.getElementById('welcomeUser').innerText = `${currentUser.name} (${currentUser.plate})`;
        document.getElementById('userVehicleType').innerText = currentUser.vehicleType;
        document.getElementById('userAvatar').src = currentUser.photoUrl || 'https://via.placeholder.com/40';
        document.getElementById('driverControls').style.display = 'block';

        document.getElementById('dispEstDep').innerText = formatDate(currentUser.estimatedDeparture);
        document.getElementById('dispEstArr').innerText = formatDate(currentUser.estimatedArrival);
    } else {
        document.getElementById('userInfoBox').style.display = 'none';
        document.getElementById('driverControls').style.display = 'none';
    }
}
checkAuth();

// GİRİŞ
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const resMsg = document.getElementById('loginResponse');

    try {
        const res = await fetch(`${BACKEND_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (data.success) {
            localStorage.setItem('goway_token', data.token);
            localStorage.setItem('goway_user', JSON.stringify(data.user));
            currentUser = data.user;
            resMsg.style.color = "green";
            resMsg.innerText = "Giriş başarılı!";
            checkAuth();
            switchTab('statusTab');
        } else {
            resMsg.style.color = "red";
            resMsg.innerText = data.error;
        }
    } catch (err) {
        resMsg.style.color = "red";
        resMsg.innerText = "Bağlantı hatası!";
    }
});

// KAYIT
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = {
        name: document.getElementById('regName').value,
        email: document.getElementById('regEmail').value,
        password: document.getElementById('regPassword').value,
        plate: document.getElementById('regPlate').value,
        vehicleType: document.getElementById('regVehicleType').value,
        photoUrl: document.getElementById('regPhotoUrl').value,
        estimatedDeparture: document.getElementById('regEstDep').value,
        estimatedArrival: document.getElementById('regEstArr').value
    };
    const resMsg = document.getElementById('regResponse');

    try {
        const res = await fetch(`${BACKEND_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        const data = await res.json();

        if (data.success) {
            resMsg.style.color = "green";
            resMsg.innerText = "Kayıt alındı! Yönetici onayından sonra giriş yapabilirsiniz.";
            document.getElementById('registerForm').reset();
        } else {
            resMsg.style.color = "red";
            resMsg.innerText = data.error;
        }
    } catch (err) {
        resMsg.style.color = "red";
        resMsg.innerText = "Sunucu hatası.";
    }
});

function logout() {
    localStorage.removeItem('goway_token');
    localStorage.removeItem('goway_user');
    currentUser = null;
    checkAuth();
    if (watchId) navigator.geolocation.clearWatch(watchId);
    switchTab('loginTab');
}

// SEFERİ BAŞLAT / DURDUR
function toggleTrip() {
    const btn = document.getElementById('startTripBtn');
    if (!watchId) {
        if ("geolocation" in navigator) {
            socket.emit('startTrip', { driverId: currentUser.id });
            
            watchId = navigator.geolocation.watchPosition((pos) => {
                const computedSpeed = pos.coords.speed ? (pos.coords.speed * 3.6) : manualSpeed;
                const payload = {
                    driverId: currentUser.id,
                    name: currentUser.name,
                    plate: currentUser.plate,
                    vehicleType: currentUser.vehicleType,
                    photoUrl: currentUser.photoUrl,
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    speed: computedSpeed,
                    heading: pos.coords.heading || 0
                };
                socket.emit('sendLocation', payload);
            }, (err) => alert("Konum alınamadı: " + err.message), { enableHighAccuracy: true });

            btn.innerText = "SEFERİ DURDUR";
            btn.style.background = "#d93025";
        }
    } else {
        socket.emit('endTrip', { driverId: currentUser.id });
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        btn.innerText = "SEFERİ BAŞLAT / KONUM PAYLAŞ";
        btn.style.background = "#1a73e8";
    }
}

socket.on('tripStarted', ({ driverId, actualDeparture }) => {
    if (currentUser && currentUser.id === driverId) {
        document.getElementById('dispActDep').innerText = formatDate(actualDeparture);
    }
});

socket.on('tripEnded', ({ driverId, actualArrival }) => {
    if (currentUser && currentUser.id === driverId) {
        document.getElementById('dispActArr').innerText = formatDate(actualArrival);
    }
});

// HARİTA TELEMETRİ GÜNCELLEMESİ (GEÇMİŞ ROTA + AKTİF ROTA + HIZ + GÖRSEL)
socket.on('updateLocation', (data) => {
    const { driverId, name, plate, vehicleType, photoUrl, lat, lng, speed, heading, routeGeometry } = data;
    if (!lat || !lng) return;

    document.getElementById('activeDriver').innerText = `${plate} (${vehicleType})`;
    document.getElementById('speedDisplay').innerText = `${Math.round(speed || 0)} km/s`;

    // Sürücü İkonu (Fotoğraflı veya Araç Tipli)
    const iconHtml = photoUrl 
        ? `<div class="marker-pin"><img src="${photoUrl}" /></div>`
        : `<div class="marker-pin"><span class="marker-icon">${vehicleType === 'Lojistik Transfer Aracı' ? '🚛' : '🚗'}</span></div>`;

    const customIcon = L.divIcon({
        className: 'custom-marker',
        html: iconHtml,
        iconSize: [42, 42],
        iconAnchor: [21, 21]
    });

    if (!driverMarkers[driverId]) {
        driverMarkers[driverId] = L.marker([lat, lng], { icon: customIcon }).addTo(map);
        driverMarkers[driverId].bindPopup(`<b>${plate}</b><br>${name}<br><i>${vehicleType}</i>`).openPopup();
        map.setView([lat, lng], 14);
        historyRoutes[driverId] = [];
    } else {
        driverMarkers[driverId].setLatLng([lat, lng]);
        driverMarkers[driverId].setIcon(customIcon);
    }

    // Google Maps Tarzı Geçmiş Rota Çizimi (Siyah / Gri kesikli çizgi)
    historyRoutes[driverId].push([lat, lng]);
    if (historyRoutes[driverId].length > 1) {
        if (!historyRoutes[`line_${driverId}`]) {
            historyRoutes[`line_${driverId}`] = L.polyline(historyRoutes[driverId], {
                color: '#5f6368',
                weight: 5,
                opacity: 0.7,
                dashArray: '5, 10'
            }).addTo(map);
        } else {
            historyRoutes[`line_${driverId}`].setLatLngs(historyRoutes[driverId]);
        }
    }

    // Aktif / Hedef Rota Çizimi (Koyu Mavi Canlı Rota)
    if (routeGeometry && Array.isArray(routeGeometry)) {
        if (activeRoutes[driverId]) {
            activeRoutes[driverId].setLatLngs(routeGeometry);
        } else {
            activeRoutes[driverId] = L.polyline(routeGeometry, {
                color: '#1a73e8',
                weight: 6,
                opacity: 0.9
            }).addTo(map);
        }
    }
});
