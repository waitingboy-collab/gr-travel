// === QA ДЕБЪГЕР ===
window.onerror = function(message, source, lineno, colno, error) {
    alert("🔴 СЛУЧИ СЕ БЪГ!\n\nГрешка: " + message + "\nРед: " + lineno);
    return false;
};

// Координати на ГКПП Маказа за формулата
const MAKAZA_LAT = 41.2662;
const MAKAZA_LON = 25.4332;

// Глобални променливи за отчетената BG локация
let bgDistanceToMakaza = 0;
let currentCityName = "";

const translations = {
    bg: {
        title: "GR-RouteMaster",
        lblDepTime: "Час на тръгване от ГКПП Маказа:",
        lblConsumption: "Среден разход (л / 100 км):",
        lblPrice: "Цена на горивото за 1 литър (€):",
        lblDestination: "Избери крайна дестинация:",
        secTitle: "Маршрут в Гърция",
        btnText: "Преизчисли",
        lblDist: "Разстояние (км):",
        lblSpeed: "Твоята Скорост (км/ч):",
        lblLimit: "Ограничение",
        resTitle: "Отчет за пътуването:",
        resArrival: "Очаквано пристигане:",
        resDist: "Общо разстояние в Гърция:",
        resTime: "Чисто време в път (в Гърция):",
        resFuel: "Гориво за гръцката отсечка:",
        resPrice: "Цена за гориво:",
        hoursStr: "ч.",
        minStr: "мин.",
        warning: "Внимание: Има въведени скорости над ограниченията!",
        segMakaza: "ГКПП Маказа - Комотини",
        segHighway: "Магистрала Егнатия Одос",
        segLocal: "Регионална пътна мрежа"
    },
    el: { /* Запазени за превод */ },
    en: { /* Запазени за превод */ }
};

const destinationsDatabase = {
    arogi: { names: { bg: "Плаж Ароги / Фанари" }, hasHighway: false, highwayDist: 0, localDist: 35, localSpeed: 70, localAllowed: 70 },
    maroneia: { names: { bg: "Маронея" }, hasHighway: false, highwayDist: 0, localDist: 30, localSpeed: 70, localAllowed: 80 },
    alexandroupoli: { names: { bg: "Александруполис" }, hasHighway: true, highwayDist: 55, highwaySpeed: 120, highwayAllowed: 130, localDist: 10, localSpeed: 50, localAllowed: 50 },
    kavala: { names: { bg: "Кавала" }, hasHighway: true, highwayDist: 80, highwaySpeed: 120, highwayAllowed: 130, localDist: 15, localSpeed: 60, localAllowed: 60 },
    keramoti: { names: { bg: "Керамоти" }, hasHighway: true, highwayDist: 75, highwaySpeed: 120, highwayAllowed: 130, localDist: 25, localSpeed: 80, localAllowed: 90 }
};

let currentLang = 'bg';
let selectedDestKey = 'arogi';

// --- СКОРОСТНА GPS ЛОКАЛИЗАЦИЯ И ГЕОКОДИРАНЕ (КОРИГИРАНА) ---
function getGPSLocation() {
    if (!navigator.geolocation) {
        alert("⚠️ Вашият браузър не поддържа GPS локализация.");
        return;
    }

    alert("Сензорът се активира. Моля, разрешете достъпа до локацията...");

    navigator.geolocation.getCurrentPosition(
        function(position) {
            const userLat = position.coords.latitude;
            const userLon = position.coords.longitude;

            // Формула на Хаверсин за разстояние
            const R = 6371; 
            const dLat = (MAKAZA_LAT - userLat) * Math.PI / 180;
            const dLon = (MAKAZA_LON - userLon) * Math.PI / 180;
            
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(userLat * Math.PI / 180) * Math.cos(MAKAZA_LAT * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
            
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            let distanceAir = R * c; 
            
            // Добавяме 15% за завои по реалния път
            bgDistanceToMakaza = Math.round(distanceAir * 1.15);

            // КРИТИЧНА ПОПРАВКА: Добавени заглавни части (headers), за да не ни отхвърля сървъра за карти
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${userLat}&lon=${userLon}&accept-language=bg`, {
                headers: {
                    'User-Agent': 'GR-RouteMaster-App-v2'
                }
            })
            .then(response => {
                if (!response.ok) throw new Error("Network error");
                return response.json();
            })
            .then(data => {
                // Извличаме името на населеното място (проверяваме за град, градче, село или община)
                const addr = data.address;
                currentCityName = addr.city || addr.town || addr.village || addr.suburb || addr.municipality || "Намерено място";
                
                alert(`🎯 Локализиран град: ${currentCityName}\n🚗 Разстояние до Маказа: ${bgDistanceToMakaza} км.`);
                calculateGreeceTrip();
            })
            .catch(err => {
                // Резервен вариант, ако API-то пак се разсърди
                currentCityName = "Засечен град (ГПС)";
                alert(`🎯 Успешно ГПС засичане!\nРазстояние до Маказа: ${bgDistanceToMakaza} км.`);
                calculateGreeceTrip();
            });
        },
        function(error) {
            alert("❌ Включете GPS на телефона си и дайте разрешение на браузъра. Код на грешка: " + error.message);
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

function populateDestinations() {
    const select = document.getElementById("destination-select");
    if (!select) return;
    const savedValue = select.value || selectedDestKey;
    select.innerHTML = "";
    for (let key in destinationsDatabase) {
        let opt = document.createElement("option");
        opt.value = key;
        opt.innerText = destinationsDatabase[key].names[currentLang] || key;
        if (key === savedValue) opt.selected = true;
        select.appendChild(opt);
    }
}

function updateDestination() {
    const select = document.getElementById("destination-select");
    if (!select) return;
    selectedDestKey = select.value;
    buildSegmentInputs();
    calculateGreeceTrip();
}

function changeLanguage() { /* Конфигурирана за промяна на езика */ }

function buildSegmentInputs() {
    const container = document.getElementById("gr-segments-container");
    if (!container) return;
    const t = translations[currentLang];
    const dest = destinationsDatabase[selectedDestKey];

    let html = `
        <div class="segment">
            <h4>📍 ${t.segMakaza} (${t.lblLimit}: 90)</h4>
            <label>${t.lblDist}</label>
            <input type="number" id="gr_makaza-dist" value="22" oninput="calculateGreeceTrip()">
            <label>${t.lblSpeed}</label>
            <input type="number" id="gr_makaza-speed" value="80" oninput="calculateGreeceTrip()">
        </div>
    `;

    if (dest.hasHighway) {
        html += `
            <div class="segment" style="border-left-color: #eab308;">
                <h4>🛣️ ${t.segHighway} (${t.lblLimit}: ${dest.highwayAllowed})</h4>
                <label>${t.lblDist}</label>
                <input type="number" id="gr_highway-dist" value="${dest.highwayDist}" oninput="calculateGreeceTrip()">
                <label>${t.lblSpeed}</label>
                <input type="number" id="gr_highway-speed" value="${dest.highwaySpeed}" oninput="calculateGreeceTrip()">
            </div>
        `;
    }

    html += `
        <div class="segment" style="border-left-color: #10b981;">
            <h4>📍 Комотини → ${dest.names[currentLang]} (${t.lblLimit}: ${dest.localAllowed})</h4>
            <label>${t.lblDist}</label>
            <input type="number" id="gr_local-dist" value="${dest.localDist}" oninput="calculateGreeceTrip()">
            <label>${t.lblSpeed}</label>
            <input type="number" id="gr_local-speed" value="${dest.localSpeed}" oninput="calculateGreeceTrip()">
        </div>
    `;

    container.innerHTML = html;
}

function addMinutesToTime(baseHours, baseMinutes, addedMinutes) {
    let totalMin = baseMinutes + Math.round(addedMinutes);
    let totalHr = baseHours + Math.floor(totalMin / 60);
    totalMin = totalMin % 60;
    totalHr = totalHr % 24;
    return `${String(totalHr).padStart(2, '0')}:${String(totalMin).padStart(2, '0')}`;
}

function calculateGreeceTrip() {
    const t = translations[currentLang];
    const dest = destinationsDatabase[selectedDestKey];

    const depTimeInput = document.getElementById("departure-time");
    if (!depTimeInput || !depTimeInput.value) return;
    
    const [depHours, depMinutes] = depTimeInput.value.split(":").map(Number);
    const fuelConsumption = parseFloat(document.getElementById("fuel-consumption").value) || 0;
    const fuelPriceEUR = parseFloat(document.getElementById("fuel-price-eur").value) || 0;

    let totalTime = 0;
    let totalDistanceGreece = 0;
    let speedWarning = false;

    const mDistInput = document.getElementById("gr_makaza-dist");
    const mSpeedInput = document.getElementById("gr_makaza-speed");
    if (mDistInput && mSpeedInput) {
        const mDist = parseFloat(mDistInput.value) || 0;
        const mSpeed = parseFloat(mSpeedInput.value) || 0;
        if (mDist > 0 && mSpeed > 0) {
            totalTime += mDist / mSpeed;
            totalDistanceGreece += mDist;
            if (mSpeed > 90) speedWarning = true;
        }
    }

    const hDistInput = document.getElementById("gr_highway-dist");
    const hSpeedInput = document.getElementById("gr_highway-speed");
    if (dest.hasHighway && hDistInput && hSpeedInput) {
        const hDist = parseFloat(hDistInput.value) || 0;
        const hSpeed = parseFloat(hSpeedInput.value) || 0;
        if (hDist > 0 && hSpeed > 0) {
            totalTime += hDist / hSpeed;
            totalDistanceGreece += hDist;
            if (hSpeed > dest.highwayAllowed) speedWarning = true;
        }
    }

    const lDistInput = document.getElementById("gr_local-dist");
    const lSpeedInput = document.getElementById("gr_local-speed");
    if (lDistInput && lSpeedInput) {
        const lDist = parseFloat(lDistInput.value) || 0;
        const lSpeed = parseFloat(lSpeedInput.value) || 0;
        if (lDist > 0 && lSpeed > 0) {
            totalTime += lDist / lSpeed;
            totalDistanceGreece += lDist;
            if (lSpeed > dest.localAllowed) speedWarning = true;
        }
    }

    // Сумиране на БГ километри + Гръцки километри
    let grandTotalDistance = totalDistanceGreece + bgDistanceToMakaza;

    // Сметки за разход спрямо ОБЩОТО разстояние
    let totalFuelLitres = (grandTotalDistance * fuelConsumption) / 100;
    let totalFuelCostEUR = totalFuelLitres * fuelPriceEUR;
    let totalFuelCostBGN = totalFuelCostEUR * 1.95583;

    const arrivalTimeFormatted = addMinutesToTime(depHours, depMinutes, totalTime * 60);
    const totalDurationMinutes = totalTime * 60;
    const durationHours = Math.floor(totalDurationMinutes / 60);
    const durationMinutes = Math.round(totalDurationMinutes % 60);

    let resultsHTML = `<h3>${t.resTitle}</h3>`;

    // Инжектиране на информацията за твоя град
    if (bgDistanceToMakaza > 0) {
        resultsHTML += `
            <div style="background-color: #f0fdf4; padding: 12px; border-radius: 6px; margin-bottom: 14px; border-left: 4px solid #16a34a; font-size: 14px;">
                📍 Настояща позиция: <strong>${currentCityName || "Засечен регион"}</strong><br>
                🚗 Разстояние до ГКПП Маказа: <strong>${bgDistanceToMakaza} км</strong>
            </div>
        `;
    }

    resultsHTML += `
        <p style="font-size: 17px;"><strong>${t.resArrival} <span style="color: #0275d8;">${arrivalTimeFormatted} ${t.hoursStr}</span></strong></p>
        <p><strong>Общо разстояние (БГ + Гърция):</strong> ${grandTotalDistance.toFixed(1)} км</p>
        <p style="font-size: 12px; color: #64748b; margin-top: -10px;">(Гръцка отсечка: ${totalDistanceGreece.toFixed(1)} км)</p>
        <p><strong>${t.resTime}</strong> ${durationHours} ${t.hoursStr} ${durationMinutes} ${t.minStr}</p>
        <hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 12px 0;">
        <p>Общо гориво за цялото пътуване: ${totalFuelLitres.toFixed(2)} л</p>
        <p style="font-size: 16px;"><strong>Крайна цена за гориво: <span style="color: #10b981;">${totalFuelCostEUR.toFixed(2)} €</span> (${totalFuelCostBGN.toFixed(2)} лв.)</strong></p>
    `;

    if (speedWarning) {
        resultsHTML += `<div class="warning-box">${t.warning}</div>`;
    }

    const resultsDiv = document.getElementById("results");
    if (resultsDiv) {
        resultsDiv.innerHTML = resultsHTML;
    }
}

// Стартиране
getGPSLocation() 
populateDestinations();
buildSegmentInputs();
calculateGreeceTrip();
