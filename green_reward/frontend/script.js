// script.js (replace your old script.js with this)
// Option B behaviour: resident updates ONLY after collector presses OK.

// -------- CONFIG ----------
const DB_KEY = "green_reward_db_final_v3";
const CURRENT_USER = "Ravi";
const POLL_INTERVAL_MS = 1000;

// --------- Local DB helpers ----------
function getSharedDB() {
    try {
        const s = localStorage.getItem(DB_KEY);
        if (s) return JSON.parse(s);
    } catch (e) { console.error(e); }
    // seed
    const seed = {
        points: 12450,
        history: [
            { description: "Dry waste scan", amount: 40, timestamp: new Date().toISOString() },
            { description: "Marketplace Redemption", amount: -200, timestamp: new Date(Date.now()-86400000).toISOString() }
        ]
    };
    try { localStorage.setItem(DB_KEY, JSON.stringify(seed)); } catch(e) {}
    return seed;
}

// IMPORTANT: updateSharedDB writes the DB but DOES NOT broadcast a storage event.
// That allows us to control *when* other tabs get notified (we'll send a specific 'OK' signal).
function updateSharedDB(updateFn) {
    const db = getSharedDB();
    const updated = updateFn(db);
    try {
        localStorage.setItem(DB_KEY, JSON.stringify(updated));
    } catch (e) { console.error(e); }
    return updated;
}

// Explicitly notify other tabs that collector pressed OK (resident should refresh)
function notifyOk() {
    // write a timestamp to force storage event in other tabs
    try {
        localStorage.setItem('green_reward_ok', Date.now().toString());
    } catch(e) { console.error(e); }
}

// --------- Mock API (local-only) ----------
async function getData(endpoint, method='GET', body=null) {
    // For this demo use local DB handler
    return new Promise((resolve) => {
        setTimeout(() => {
            const db = getSharedDB();
            if (endpoint.startsWith('/users/')) {
                resolve({ username: CURRENT_USER, points: db.points, history: db.history });
            } else if (endpoint.includes('/reward')) {
                const newDb = updateSharedDB(d => {
                    d.points += body.amount;
                    d.history.unshift({ description: body.description, amount: body.amount, timestamp: new Date().toISOString() });
                    return d;
                });
                resolve({ new_balance: newDb.points });
            } else if (endpoint.includes('/redeem')) {
                const newDb = updateSharedDB(d => {
                    d.points -= body.amount;
                    d.history.unshift({ description: `Redeemed at ${body.shop_name}`, amount: -body.amount, timestamp: new Date().toISOString() });
                    return d;
                });
                resolve({ new_balance: newDb.points });
            } else {
                resolve({});
            }
        }, 250);
    });
}

// --------- Resident page functions ----------
async function loadResidentProfile() {
    const pointsDisplay = document.getElementById('points-display');
    if (!pointsDisplay) return;
    try {
        const data = await getData(`/users/${CURRENT_USER}`);
        // update points (animated)
        let currentText = pointsDisplay.innerText.replace(/,/g,'').replace('pts','').trim();
        let currentVal = parseInt(currentText);
        if (isNaN(currentVal)) currentVal = 0;
        if (data.points !== currentVal) animateValue(pointsDisplay, currentVal, data.points, 700);

        // update activity list
        const list = document.getElementById('activity-list');
        if (list) {
            const firstDesc = list.firstElementChild?.querySelector('h4')?.innerText;
            const newFirst = data.history[0]?.description;
            if (firstDesc !== newFirst || list.innerText.trim() === "") {
                list.innerHTML = data.history.map(tx => {
                    const pos = tx.amount > 0;
                    return `
                        <div class="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition animate-fade-in border-b border-gray-50">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 ${pos ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'} rounded-full flex items-center justify-center">
                                    <i class="fas ${pos ? 'fa-recycle' : 'fa-shopping-bag'}"></i>
                                </div>
                                <div>
                                    <h4 class="font-bold text-sm text-gray-800">${tx.description}</h4>
                                    <p class="text-xs text-gray-400">${new Date(tx.timestamp).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div class="font-bold ${pos ? 'text-green-600' : 'text-gray-800'}">
                                ${pos ? '+' : ''}${tx.amount}
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
    } catch (e) { console.error(e); }
}

async function redeemPoints(shopName, amount) {
    if (!confirm(`Confirm redemption of ${amount} pts for ${shopName}?`)) return;
    await getData('/redeem', 'POST', { resident_name: CURRENT_USER, amount, shop_name: shopName });
    alert(`✅ Code Generated: GR-${Math.floor(Math.random()*9000)+1000}`);
    // Resident initiated - update immediately in this tab
    loadResidentProfile();
}

function logout() {
    if (!confirm("Are you sure you want to logout?")) return;
    document.body.innerHTML = `
        <div class="flex items-center justify-center h-screen bg-green-50">
            <div class="text-center animate-fade-in">
                <i class="fas fa-check-circle text-6xl text-green-600 mb-4"></i>
                <h1 class="text-2xl font-bold text-gray-800">Logged Out Successfully</h1>
                <p class="text-gray-500 mb-6 mt-2">Redirecting to login...</p>
                <button onclick="location.reload()" class="bg-green-600 text-white px-6 py-2 rounded-lg font-bold">Login Again</button>
            </div>
        </div>
    `;
    setTimeout(()=>location.reload(),1200);
}

function toggleHowItWorks() {
    const modal = document.getElementById('how-it-works-modal');
    if (!modal) return;
    modal.classList.toggle('hidden');
    modal.classList.toggle('flex');
}

// --------- Collector page functions ----------
async function submitReward() {
    const residentSelect = document.getElementById('resident-select');
    const btn = document.getElementById('reward-btn');
    const resultPanel = document.getElementById('result-panel');
    const photoInput = document.getElementById('waste-photo');
    if (!residentSelect || !btn || !resultPanel) return;

    const residentName = residentSelect.value;
    const residentText = residentSelect.options[residentSelect.selectedIndex].text;

    // 1. loading UI & lock inputs (prevent next scan until OK)
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i>Processing...';
    if (photoInput) { photoInput.disabled = true; photoInput.classList.add('opacity-50','pointer-events-none'); }
    residentSelect.disabled = true; residentSelect.classList.add('opacity-50');

    // 2. write reward to DB (DO NOT notify other tabs here - Option B)
    try {
        const res = await getData('/reward','POST',{ resident_name: residentName, amount: 10, description: "Dry waste scan • Doorstep" });
        const newBalance = res.new_balance ? res.new_balance.toLocaleString() : "...";

        // show success (stays until OK)
        resultPanel.innerHTML = `
            <div class="text-center py-6 animate-fade-in">
                <div class="w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center text-4xl mx-auto mb-4 shadow-lg shadow-green-200">
                    <i class="fas fa-check"></i>
                </div>
                <h3 class="text-2xl font-bold text-gray-800 mb-2">Points Sent!</h3>
                
                <div class="bg-green-50 p-4 rounded-xl border border-green-100 mb-8 mx-auto max-w-xs">
                    <p class="text-gray-500 text-xs uppercase font-bold tracking-wider">New Balance</p>
                    <p class="text-3xl font-extrabold text-green-600">${newBalance}</p>
                    <p class="text-xs text-gray-400 mt-1">for ${residentName}</p>
                </div>
                
                <button onclick="resetScan('${residentText}')" class="bg-gray-900 text-white px-10 py-3 rounded-xl font-bold hover:bg-black transition shadow-lg transform hover:-translate-y-0.5">
                    OK, Next Scan
                </button>
            </div>
        `;
    } catch (e) {
        console.error(e);
        alert("Something went wrong. Please try again.");
        btn.disabled = false;
        btn.innerText = "Approve & Reward 10 Points";
        // keep inputs disabled until user hits OK to avoid accidental re-scan in partial error state
    }
}

// Called ONLY when OK is clicked — this MUST trigger resident update (Option B)
function resetScan(completedResidentText) {
    const resultPanel = document.getElementById('result-panel');
    const photoInput = document.getElementById('waste-photo');
    const previewImg = document.getElementById('preview-img');
    const placeholder = document.getElementById('upload-placeholder');
    const residentSelect = document.getElementById('resident-select');

    // 1. re-enable inputs
    if (photoInput) {
        photoInput.value = '';
        photoInput.disabled = false;
        photoInput.classList.remove('opacity-50','pointer-events-none');
    }
    if (previewImg) { previewImg.classList.add('hidden'); previewImg.src = ''; }
    if (placeholder) placeholder.classList.remove('hidden');
    if (residentSelect) { residentSelect.disabled = false; residentSelect.classList.remove('opacity-50'); }

    // 2. restore result panel to waiting state
    if (resultPanel) {
        resultPanel.classList.add('opacity-50');
        resultPanel.innerHTML = `
            <div class="flex items-center gap-3 mb-6 justify-center">
                <span class="bg-gray-300 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">3</span>
                <h2 class="font-bold text-lg text-gray-400">Verification Status</h2>
            </div>
            
            <div id="ai-result-content" class="hidden">
                <div class="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 animate-bounce">
                    <i class="fas fa-check"></i>
                </div>
                <h3 class="text-2xl font-bold text-gray-800 mb-2">Verified!</h3>
                <p class="text-gray-500 mb-8">Dry plastic & cardboard detected.<br>Confidence Score: <span class="font-bold text-green-600">96%</span></p>
                
                <button onclick="submitReward()" id="reward-btn" class="w-full bg-green-600 text-white font-bold text-lg py-4 rounded-xl shadow-lg hover:bg-green-700 transform hover:-translate-y-1 transition-all">
                    Approve & Reward 10 Points
                </button>
            </div>
            
            <div id="ai-waiting-msg">
                <i class="fas fa-hourglass-start text-4xl text-gray-200 mb-4"></i>
                <p class="text-gray-400">Waiting for scan...</p>
            </div>
        `;
    }

    // 3. Notify other tabs/resident dashboard that collector pressed OK (so they refresh)
    notifyOk();

    // 4. small toast for feedback
    if (completedResidentText) {
        const msg = document.createElement('div');
        msg.className = "fixed top-24 right-10 bg-green-800 text-white px-6 py-4 rounded-xl shadow-2xl z-50 flex items-center gap-3 animate-fade-in";
        msg.innerHTML = `<i class="fas fa-check-circle"></i> <div><p class="font-bold text-sm">Scan Completed</p><p class="text-xs text-green-200">${completedResidentText}</p></div>`;
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 3000);
    }
}

// --------- Init & cross-tab listener ----------
document.addEventListener('DOMContentLoaded', () => {
    // initial resident load if resident page
    loadResidentProfile();

    // Listen for our OK signal only (Option B)
    window.addEventListener('storage', (ev) => {
        if (ev.key === 'green_reward_ok') {
            // another tab (collector) pressed OK — update resident profile
            loadResidentProfile();
        }
    });

    // fallback polling for resident page (keeps things responsive if storage events are blocked)
    if (document.getElementById('points-display')) {
        setInterval(loadResidentProfile, POLL_INTERVAL_MS);
    }

    // Collector preview & file handling (keeps your existing UX)
    const photoInput = document.getElementById('waste-photo');
    if (photoInput) {
        photoInput.addEventListener('change', function(e){
            const scanOverlay = document.getElementById('scan-overlay');
            const placeholder = document.getElementById('upload-placeholder');
            const preview = document.getElementById('preview-img');
            if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                if (scanOverlay) scanOverlay.classList.remove('hidden');
                reader.onload = function(ev) {
                    if (placeholder) placeholder.classList.add('hidden');
                    if (preview) { preview.src = ev.target.result; preview.classList.remove('hidden'); }
                    // simulate short analysis
                    setTimeout(() => {
                        if (scanOverlay) scanOverlay.classList.add('hidden');
                        const panel = document.getElementById('result-panel');
                        if (panel) panel.classList.remove('opacity-50');
                        const waiting = document.getElementById('ai-waiting-msg'); if (waiting) waiting.classList.add('hidden');
                        const content = document.getElementById('ai-result-content'); if (content) content.classList.remove('hidden');
                    }, 600);
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        });
    }
});

// small number animation helper
function animateValue(obj, start, end, duration) {
    if (start === end) return;
    let startTs = null;
    const step = (ts) => {
        if (!startTs) startTs = ts;
        const progress = Math.min((ts - startTs) / duration, 1);
        obj.innerHTML = Math.floor(start + (end - start) * progress).toLocaleString();
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}
