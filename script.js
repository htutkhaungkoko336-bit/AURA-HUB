// --- DATA & STATE ---
let currentListener = null;
let currentMatchTab = 'waiting'; // ဒါကိုထည့်လိုက်ရင် "currentMatchTab is not defined" error ပျောက်သွားပါမယ်။
const mapData = [
    { 
        mode: "5vs5", 
        img: "5vs5.png", 
        rules: "Room တိုင်းတွင် Feeကြေး 10% ကျသင့်မည်ဖြစ်သည်။ ။ Fee ကြေးသည် 5000လျှင် 500Ks ၊ 10000လျှင် 1000Ks ၊ 15000လျှင် 1500Ks ၊ 25000လျှင် 2500Ks ၊ 50000လျှင် 5000Ks ကျသင့်မည်။K Pay လွှဲရာတွင် feeကြေးအပါလွှဲပေးရမည်။ ပွဲစဉ်ဖျက်သိမ်းပါက Feeကြေးချန်၍ ကျန်သည့်ငွေကို ပြန်လည် လွှဲပေးမည်ဖြစ်သည်။" // ဒီနေရာမှာပဲ ပြင်ပါ
    },
    { 
        mode: "1vs1", 
        img: "1vs1.png", 
        rules: "Room တိုင်းတွင် Feeကြေး 10% ကျသင့်မည်ဖြစ်သည်။ ။ Fee ကြေးသည် 5000လျှင် 500Ks ၊ 10000လျှင် 1000Ks ၊ 15000လျှင် 1500Ks ၊ 25000လျှင် 2500Ks ၊ 50000လျှင် 5000Ks ကျသင့်မည်။K Pay လွှဲရာတွင် feeကြေးအပါလွှဲပေးရမည်။ ပွဲစဉ်ဖျက်သိမ်းပါက Feeကြေးချန်၍ ကျန်သည့်ငွေကို ပြန်လည် လွှဲပေးမည်ဖြစ်သည်။" // ဒီနေရာမှာပဲ ပြင်ပါ
    }
];




let currentIndex = 0;
let selectedFee = 0;

// --- UI FUNCTIONS ---
function closeWelcome() {
    const isChecked = document.getElementById('read-check').checked;
    if (isChecked) {
        document.getElementById('welcome-popup').style.display = 'none';
        const dashboard = document.getElementById('main-dashboard');
        dashboard.style.pointerEvents = 'auto'; 
        dashboard.style.opacity = '1';          
    } else {
        alert("စည်းကမ်းချက်များကို အရင်ဆုံး Check လုပ်ပေးပါဦး။");
    }
}

function updateDisplay() {
    const current = mapData[currentIndex];
    document.querySelector('.map-tag').innerText = current.mode + " Mode";
    document.getElementById('mapImg').src = current.img;
    document.getElementById('preview-title').innerText = current.mode + " Preview";

    const sideA = document.getElementById('side-a-list');
    const sideB = document.getElementById('side-b-list');
    
    const itemHTML = current.mode === "1vs1" ? '<div class="team">Solo Player</div>' : 
                     Array(5).fill('<div class="team">Player Name</div>').join('');
    
    sideA.innerHTML = itemHTML;
    sideB.innerHTML = itemHTML;
}

function nextMap() {
    currentIndex = (currentIndex + 1) % mapData.length;
    updateDisplay();
}

// --- NAVIGATION ---
function goToRooms() {
    const current = mapData[currentIndex];
    document.getElementById('main-dashboard').style.display = 'none';
    document.getElementById('page-room-select').style.display = 'flex';
    document.getElementById('selected-mode-title').innerText = current.mode + " ROOMS";
    document.getElementById('rule-text-content').innerText = current.rules;
}

function goBack() {
    document.getElementById('page-room-select').style.display = 'none';
    document.getElementById('main-dashboard').style.display = 'flex';
}

function joinRoom(fee) {
    selectedFee = fee;
    const mode = mapData[currentIndex].mode;
    document.getElementById('page-room-select').style.display = 'none';

    // Preview ကို စတင်နားထောင်ပါ
    startLobbyListener(fee, mode);

    if (mode === "5vs5") {
        document.getElementById('page-5vs5').style.display = 'flex';
        document.getElementById('fee-5vs5').innerText = "Entry Fee: " + fee + " Ks";
    } else {
        document.getElementById('page-1vs1').style.display = 'flex';
        document.getElementById('fee-1vs1').innerText = "Entry Fee: " + fee + " Ks";
    }
}
function leaveRoom() {
    // Preview Listener ကို ပိတ်မယ်
    if (currentListener) {
        currentListener();
        currentListener = null;
    }
    
    document.getElementById('page-5vs5').style.display = 'none';
    document.getElementById('page-1vs1').style.display = 'none';
    document.getElementById('page-room-select').style.display = 'flex';
}
function goToPayment() {
    const mode = mapData[currentIndex].mode;
    let isValid = true;

    if (mode === "5vs5") {
        // ၁။ Squad Name စစ်မယ်
        const squadName = document.getElementById('squad-name').value;
        if (!squadName) isValid = false;

        // ၂။ Player ၅ ယောက်လုံးရဲ့ Name & ID စစ်မယ်
        const playerRows = document.querySelectorAll('#page-5vs5 .player-row input');
        playerRows.forEach(input => {
            if (!input.value) isValid = false;
        });

        // ၃။ K-Pay အချက်အလက် စစ်မယ်
        const kName = document.getElementById('kpay-name').value;
        const kNo = document.getElementById('kpay-no').value;
        if (!kName || !kNo) isValid = false;

    } else {
        // 1vs1 အတွက် စစ်မယ်
        const soloName = document.querySelector('#page-1vs1 .player-row input[type="text"]').value;
        const soloID = document.querySelector('#page-1vs1 .player-row input[type="number"]').value;
        const kName = document.getElementById('kpay-name-solo').value;
        const kNo = document.getElementById('kpay-no-solo').value;

        if (!soloName || !soloID || !kName || !kNo) isValid = false;
    }

    // Logo တင်ထားခြင်း ရှိမရှိ စစ်ရန် (Optional)
    if (mode === "5vs5" && document.getElementById('logoPreview').style.display === 'none') {
        alert("Logo ပုံလေး ထည့်ပေးပါဦးခင်ဗျာ။");
        return;
    }

    // အချက်အလက် မပြည့်စုံရင် Alert ပြပြီး ရပ်လိုက်မယ်
    if (!isValid) {
        alert("ကျေးဇူးပြု၍ အချက်အလက်အားလုံးကို ပြည့်စုံစွာ ဖြည့်စွက်ပေးပါ။");
        return;
    }

    // အားလုံးပြည့်စုံမှ Payment Page ကို သွားမယ်
    document.getElementById('page-5vs5').style.display = 'none';
    document.getElementById('page-1vs1').style.display = 'none';
    document.getElementById('page-payment-proof').style.display = 'flex';
}

// --- IMAGE PREVIEWS (ULTIMATE FIX FOR RE-SELECTION) ---
function previewScreenshot(event) {
    const file = event.target.files[0];
    const output = document.getElementById('ssPreview');
    const placeholder = document.getElementById('ss-placeholder');
    if (file) {
        const reader = new FileReader();
        reader.onload = function() {
            output.src = reader.result;
            output.style.display = 'block';
            if (placeholder) placeholder.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
}

// 🔥 [UPDATED]: Logo Preview & Re-selection System
const logoInput = document.getElementById('sqLogo');
const logoPreviewImg = document.getElementById('logoPreview');

function previewLogo(event) {
    const file = event.target.files[0];
    const output = document.getElementById('logoPreview');
    const label = document.getElementById('logoLabel');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            output.src = e.target.result;
            output.style.display = 'block';
            if (label) label.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
}

// Event Delegator (ပုံကို ပြန်နှိပ်ရင် File Input ပြန်ပွင့်အောင်လုပ်ခြင်း)
document.body.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'logoPreview') {
        const sqLogoInput = document.getElementById('sqLogo');
        if (sqLogoInput) sqLogoInput.click();
    }
});

// --- IMGBB UPLOAD FUNCTION ---
async function uploadToImgBB(file) {
    const apiKey = "cfd35057610d4211c9b28055943596a8"; 
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: "POST",
        body: formData
    });
    const result = await response.json();
    if (result.success) {
        return result.data.url;
    } else {
        throw new Error("ImgBB Upload Failed");
    }
}

// --- SUBMIT TO FIRESTORE ---
async function submitRegistration(formData) {
    // ၁။ Firebase ကို အချက်အလက်ပို့ပါ
    const docRef = await db.collection("registrations").add({
        ...formData,
        status: "pending",
        createdAt: new Date()
    });

    // ၂။ Telegram ကို Noti ချက်ချင်းပို့ပါ
    const botToken = "YOUR_TELEGRAM_BOT_TOKEN";
    const chatId = "YOUR_GROUP_ID";
    const message = `🔔 *Registration အသစ်ဝင်လာပါပြီ!*\n\n` +
                    `Name: ${formData.squadName}\n` +
                    `Fee: ${formData.fee} Ks\n` +
                    `ID: ${docRef.id}`; // Database ထဲက ID ကို ယူသုံးတာပါ

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: "Markdown"
        })
    });

    alert("အောင်မြင်စွာ တင်ပြီးပါပြီ!");
}
// အပေါ်ဆုံးမှာ global variable တွေ ထားပေးပါ
let currentRegId = null; 
window.isResubmission = false; 

async function submitProof() {
    if (window.event) window.event.preventDefault();

    const ssFile = document.getElementById('ssFile').files[0];
    const sqLogoFile = document.getElementById('sqLogo').files[0];

    if (!ssFile) {
        alert("ကျေးဇူးပြု၍ Screenshot တင်ပေးပါ။");
        return;
    }

    document.getElementById('submit-btn').style.display = 'none';
    document.getElementById('waiting-msg').style.display = 'block';
    document.getElementById('waiting-msg').innerText = "Processing...";

    try {
        const paymentURL = await uploadToImgBB(ssFile);
        let squadLogoURL = sqLogoFile ? await uploadToImgBB(sqLogoFile) : "https://i.ibb.co/4pGm0Zf/default-logo.png";

        const mode = mapData[currentIndex].mode;
        let registrationData = {
            mode: mode,
            fee: selectedFee,
            paymentURL: paymentURL,
            squadLogo: squadLogoURL,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: "pending", // Resubmit လုပ်ရင်လည်း status ကို pending ပြန်လုပ်မယ်
            matchStatus: "none",
            isResubmission: window.isResubmission
        };

        // Player Data များ
        if (mode === "5vs5") {
            registrationData.squadName = document.getElementById('squad-name').value;
            registrationData.players = Array.from(document.querySelectorAll('#page-5vs5 .player-row')).map(row => ({
                name: row.querySelectorAll('input')[0].value,
                id: row.querySelectorAll('input')[1].value
            }));
            registrationData.kpayName = document.getElementById('kpay-name').value;
            registrationData.kpayPhone = document.getElementById('kpay-no').value;
        } else {
            const soloRow = document.querySelector('#page-1vs1 .player-row');
            registrationData.playerName = soloRow.querySelectorAll('input')[0].value;
            registrationData.mlbbId = soloRow.querySelectorAll('input')[1].value;
            registrationData.kpayName = document.getElementById('kpay-name-solo').value;
            registrationData.kpayPhone = document.getElementById('kpay-no-solo').value;
        }

        let docRefId;

        // Logic: Resubmit ဆိုရင် update, အသစ်ဆိုရင် add
        if (window.isResubmission && currentRegId) {
            await db.collection("registrations").doc(currentRegId).update(registrationData);
            docRefId = currentRegId;
        } else {
            const docRef = await db.collection("registrations").add(registrationData);
            docRefId = docRef.id;
            currentRegId = docRefId; // နောက်တစ်ခါအတွက် ID ကို မှတ်ထားမယ်
        }
        
        // Admin ဆီ Notify ပို့ခြင်း
        await fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                regId: docRefId, 
                data: registrationData 
            })
        });

        document.getElementById('waiting-msg').innerText = "Payment ကို Admin မှ စစ်ဆေးနေပါသည်။ ခဏစောင့်ပေးပါ...";
        watchStatus(docRefId);

    } catch (error) {
        alert("Error: " + error.message);
        document.getElementById('submit-btn').style.display = 'block';
        document.getElementById('waiting-msg').style.display = 'none';
    }
}
function backToRegistration() {
    document.getElementById('page-payment-proof').style.display = 'none';
    const mode = mapData[currentIndex].mode;
    if (mode === "5vs5") {
        document.getElementById('page-5vs5').style.display = 'flex';
    } else {
        document.getElementById('page-1vs1').style.display = 'flex';
    }
}

window.onload = updateDisplay;

// Live Lobby Preview Function
function startLobbyListener(fee, mode) {
    const listContainer = document.getElementById(`lobby-list-${mode}`);
    const boxContainer = document.getElementById(`lobby-preview-${mode}`);

    if (currentListener) currentListener();

currentListener = db.collection("registrations")
    .where("fee", "==", parseInt(fee))
    .where("mode", "==", mode)
    .where("matchStatus", "==", "waiting")
    .orderBy("timestamp", "desc") // ဒီနေရာမှာ အသစ်ဆုံးကို အပေါ်တင်ဖို့အတွက် desc သုံးပါ
    .onSnapshot((snapshot) => {
        listContainer.innerHTML = ""; 
        
        if (!snapshot.empty) {
            boxContainer.style.display = "block";
            snapshot.forEach(doc => {
                const data = doc.data();
                const name = data.squadName || data.playerName || "Player";
                
                listContainer.innerHTML += `
                    <div class="lobby-row" style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #333;">
                        <span style="color: #fff;">TEAM - ${name}</span>
                        <span class="waiting-text" style="color: #c9a66b;">waiting...</span>
                    </div>
                `;
            });
        } else {
            boxContainer.style.display = "none";
        }
    });
}
// သင့် joinRoom function ထဲတွင် ခေါ်သုံးရန်
// joinRoom(fee) ထဲမှာ - startLobbyListener(fee, mode); ကို ထည့်လိုက်ပါ
// --- MATCH CENTER SYSTEM ---
function watchStatus(docId) {
    db.collection("registrations").doc(docId).onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            myTeamInfo = { id: doc.id, ...data };
            const waitingMsg = document.getElementById('waiting-msg');

            // --- Admin က Confirm/Reject လုပ်တာကို စောင့်ကြည့်ခြင်း ---
            if (data.status === "confirm") {
                // Confirm ဖြစ်ရင် Match Center ကို ပို့ပေးမယ်
                document.getElementById('page-payment-proof').style.display = 'none';
                document.getElementById('page-match-center').style.display = 'flex';
                if (typeof loadMatchRooms === 'function') loadMatchRooms();
            } 
            else if (data.status === "rejected") {
                // Reject Reason များကို ပြသခြင်း
                const reasons = {
                    'fee': 'Fee ကြေး မလုံလောက်ပါ',
                    'identity': 'Name သို့မဟုတ် ID မမှန်ကန်ပါ',
                    'payment': 'K-Pay အချက်အလက် မှားယွင်းနေပါသည်',
                    'logo': 'တင်ထားသောပုံမှာ ညစ်ညမ်းနေပါသည်'
                };
                
                const reasonText = reasons[data.rejectReason] || "အချက်အလက်မပြည့်စုံခြင်း သို့မဟုတ် ငွေလွှဲပြေစာမမှန်ခြင်း";
                
                if (waitingMsg) {
                    waitingMsg.style.display = 'block';
                    waitingMsg.innerText = `❌ သင်၏ Registration ကို ပယ်ချလိုက်ပါသည်။\nအကြောင်းရင်း: ${reasonText}`;
                }

                // --- Resubmit အတွက် ပြင်ဆင်ခြင်း ---
                window.isResubmission = true;
                currentRegId = doc.id; // အဟောင်း ID ကို မှတ်ထားလိုက်တယ်

                // Submit Button ပြန်ပေါ်လာအောင် လုပ်ခြင်း
                const submitBtn = document.getElementById('submit-btn');
                if (submitBtn) {
                    submitBtn.style.display = 'block';
                    submitBtn.innerText = "Resubmit";
                }
                
                // Back to Form ခလုတ် ပြန်ပြခြင်း
                const backBtn = document.getElementById('back-to-form-btn');
                if (backBtn) backBtn.style.display = 'block';
            }

            // --- မူလ Rule များ ---
            if (data.status === "confirm" && (data.matchStatus === "none" || data.matchStatus === "waiting") && !data.currentMatchId) {
                const playingLobby = document.getElementById('page-playing-lobby');
                if (playingLobby) playingLobby.style.display = 'none';
                document.getElementById('page-payment-proof').style.display = 'none';
                document.getElementById('page-match-center').style.display = 'flex';
                if (typeof loadMatchRooms === 'function') loadMatchRooms();
            }
            
            if (data.matchStatus === "playing" && data.currentMatchId) {
                startMatchMonitoring(data.currentMatchId);
            }
        }
    });
}
// User က ပြန်ပြင်ဖို့ ခလုတ်ကို နှိပ်တဲ့အခါ
document.getElementById('back-to-form-btn').addEventListener('click', async () => {
    // 1. Database ထဲက status ကို pending ပြန်ပြောင်းမယ်
    await db.collection("registrations").doc(myTeamInfo.id).update({
        status: "pending",
        rejectReason: null // အရင် error message ကို ဖျက်လိုက်မယ်
    });
    
    // 2. Form ပြန်ပြမယ်
    document.getElementById('page-payment-proof').style.display = 'block';
    document.getElementById('back-to-form-btn').style.display = 'none';
    
    // 3. Status ပြောင်းသွားရင် စာသားကိုလည်း clear လုပ်ပေးမယ်
    document.getElementById('waiting-msg').innerText = "ကျေးဇူးပြု၍ ပြေစာအသစ် တင်ပေးပါ";
});

function switchTab(tabName, element) {
    currentMatchTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    element.classList.add('active');
    loadMatchRooms();
}
function increaseLimit() {
    resultLimit += 10;
    loadMatchRooms(); // Tab ကို ပြန်ခေါ်ပြီး Listener ကို အသစ်လုပ်ပေးမယ်
}

function decreaseLimit() {
    if (resultLimit > 10) {
        resultLimit -= 10;
        loadMatchRooms();
    }
}
function loadMatchRooms() {
    const container = document.getElementById('match-content');
    const createRoomBtn = document.querySelector('.create-room-card');
    
    if (!container) return;
    
    // အရေးကြီးဆုံး: အရင်နားထောင်နေတဲ့ Listener ကို ပိတ်မှ နောက်တစ်ခုကို စလို့ရမယ်
    if (currentListener) {
        currentListener();
        currentListener = null;
    }

    // Create Room ခလုတ် ဖျောက်ရန်/ပြရန်
    if (createRoomBtn) {
        if (currentMatchTab === 'playing' || currentMatchTab === 'result') {
            createRoomBtn.style.display = 'none';
        } else {
            createRoomBtn.style.display = 'block';
        }
    }

    container.innerHTML = '<p style="text-align:center; color:#444; font-size:0.8rem;">Loading...</p>';

    // --- PLAYING TAB ---
    if (currentMatchTab === 'playing') {
        currentListener = db.collection("matches")
        .where("status", "!=", "finished") 
        .orderBy("status") // .where() တွင် inequality (!=) သုံးပါက orderBy တွင် ထို field ကို ထည့်ရပါမည်
        .orderBy("matchTimestamp", "desc")
        .onSnapshot((querySnapshot) => {    
                    container.innerHTML = "";
                if (querySnapshot.empty) {
                    container.innerHTML = `<p style="text-align:center; color:#333; margin-top:30px; font-size:0.8rem;">No matches running.</p>`;
                    return;
                }
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    container.innerHTML += `
                    <div class="match-card" style="border: 1px solid #333; margin-bottom:10px;">
                        <div class="match-header" style="justify-content: center;">
                            <span style="color:#c9a66b; font-weight:bold; font-size: 11px;">🎮 LIVE MATCHING</span>
                        </div>
                        <div class="match-body">
                            <div style="display:flex; align-items:center; gap:10px; width: 40%;">
                                <img src="${data.teamALogo || ''}" style="width:30px; height:30px; border-radius:50%; border:1px solid #333;">
                                <div style="color: #fff; font-size: 0.9rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${data.teamA}</div>
                            </div>
                            <div style="color: #c9a66b; font-weight:bold; font-style:italic; width: 10%; text-align:center;">Vs</div>
                            <div style="display:flex; align-items:center; gap:10px; justify-content:flex-end; width: 40%; text-align: right;">
                                <div style="color: #fff; font-size: 0.9rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${data.teamB}</div>
                                <img src="${data.teamBLogo || ''}" style="width:30px; height:30px; border-radius:50%; border:1px solid #333;">
                            </div>
                        </div>
                    </div>`;
                });
            });
    } 
else if (currentMatchTab === 'result') {
    if (typeof resultLimit === 'undefined') resultLimit = 10;

    // 1. limit မသုံးတော့ဘဲ Data အကုန်ဆွဲထုတ်ပြီးမှ JS နဲ့ ဖြတ်ယူပါမယ်
    currentListener = db.collection("results")
        .orderBy("timestamp", "desc")
        .onSnapshot((querySnapshot) => {
            container.innerHTML = "";
            
            // 2. ရလာတဲ့ Docs အားလုံးကို Array ထဲထည့်ပါ
            const allDocs = querySnapshot.docs; 
            
            // 3. resultLimit (ဥပမာ 20) ထိရှိရင် 10 နဲ့ 20 ကြားကို ဖြတ်ယူပါ
            // slice(start, end) မှာ start က (လက်ရှိ limit - 10) ဖြစ်ရပါမယ်
            const displayDocs = allDocs.slice(resultLimit - 10, resultLimit);

            displayDocs.forEach(doc => {
                const data = doc.data();
                const isTeamAWinner = data.winner === 'teamA';
                const dateStr = data.timestamp ? data.timestamp.toDate().toLocaleDateString('en-GB') : "";

                container.innerHTML += `
                    <div style="background: #1a1a1a; border: 1px solid #333; padding: 12px; border-radius: 8px; margin-bottom: 10px; cursor: pointer;" 
                        onclick="showMatchDetail('${data.matchId}', '${data.teamA}', '${data.teamB}')">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <span style="font-size: 0.75rem; color: #c9a66b; font-weight: bold;">💰 ${data.fee} Ks</span>
                            <span style="font-size: 0.75rem; color: #666;">${dateStr}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="text-align: center; flex: 1;">
                                <div style="color: #fff; font-weight: 600; font-size: 0.95rem;">${data.teamA}</div>
                                <div style="color: #d4af37; font-size: 0.75rem; font-weight:bold; margin-top: 6px;">${isTeamAWinner ? 'WINNER' : 'LOSER'}</div>
                            </div>
                            <div style="color: #444; font-size: 0.7rem; font-weight: bold; margin: 0 10px;">VS</div>
                            <div style="text-align: center; flex: 1;">
                                <div style="color: #fff; font-weight: 600; font-size: 0.95rem;">${data.teamB}</div>
                                <div style="color: #d4af37; font-size: 0.75rem; font-weight:bold; margin-top: 6px;">${!isTeamAWinner ? 'WINNER' : 'LOSER'}</div>
                            </div>
                        </div>
                    </div>
                `;
            });

            // 4. Navigation ခလုတ်များ
            container.innerHTML += `
                <div id="navigationWrapper" style="display: flex; gap: 10px; margin-top: 10px;">
                    ${resultLimit > 10 ? `
                        <button onclick="decreaseLimit()" style="flex: 1; padding: 10px; background: #333; border: 1px solid #c9a66b; color: #c9a66b; border-radius: 5px; cursor: pointer;">
                            PREVIOUS
                        </button>
                    ` : ''}
                    
                    ${resultLimit < allDocs.length ? `
                        <button onclick="increaseLimit()" style="flex: 1; padding: 10px; background: #c9a66b; border: none; color: #fff; border-radius: 5px; cursor: pointer;">
                            NEXT
                        </button>
                    ` : ''}
                </div>
            `;
        });
}
//  WAITING TAB ---
    else {
        if (!myTeamInfo || !myTeamInfo.fee) return;
        
        currentListener = db.collection("registrations")
            .where("fee", "==", Number(myTeamInfo.fee))
            .where("status", "==", "confirm")
            .where("matchStatus", "==", "waiting")
            .onSnapshot((querySnapshot) => {
                container.innerHTML = "";
                if (querySnapshot.empty) {
                    container.innerHTML = `<p style="text-align:center; color:#333; margin-top:30px; font-size:0.8rem;">No entries in waiting room.</p>`;
                    return;
                }
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    const isMyTeam = doc.id === myTeamInfo.id;
                    const name = data.mode === "5vs5" ? data.squadName : data.playerName;
                    const actionUI = isMyTeam
                        ? `<button class="cancel-room-btn" onclick="cancelMyRoom()" style="background:#cc0000; color:#fff; border:none; padding:4px 10px; border-radius:4px; font-size:0.7rem; cursor:pointer; font-weight:bold;">CANCEL</button>`
                        : `<button class="plus-join-btn" onclick="challengeTeam('${doc.id}')" style="background:#c9a66b; border:none; padding:5px 10px; border-radius:4px; font-weight:bold;">+</button>`;
                    
                    container.innerHTML += `
                    <div class="match-card" style="${isMyTeam ? 'border: 1px solid #c9a66b; background: rgba(201,166,107,0.05);' : 'border: 1px solid #333;'} margin-bottom:10px;">
                        <div class="match-header">
                            <span>💰 ${data.fee}ks.</span>
                            <span style="opacity:0.7; font-size: 10px;">${data.mode}</span>
                        </div>
                        <div class="match-body">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <img src="${data.squadLogo}" style="width:30px; height:30px; border-radius:50%; border:1px solid #333;">
                                <div style="color: #fff; font-size: 0.9rem;">${name}</div>
                            </div>
                            <div style="color: #c9a66b; font-weight:bold; font-style:italic;">Vs</div>
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div style="width:28px; height:28px; border-radius:50%; border:1px dashed #444; display:flex; align-items:center; justify-content:center; color:#444; font-size:0.7rem;">?</div>
                                ${actionUI}
                            </div>
                        </div>
                    </div>`;
                });
            });
    }
}
async function showMatchDetail(matchId, teamAName, teamBName) {
    const modal = document.getElementById('match-detail-popup');
    const body = document.getElementById('match-detail-body');
    body.innerHTML = "Loading...";
    modal.style.display = 'flex';

    try {
        const regs = await db.collection("registrations")
                             .where("currentMatchId", "==", matchId)
                             .get();

        let teamAPlayersHTML = "";
        let teamBPlayersHTML = "";

        regs.forEach(doc => {
            const data = doc.data();
            const pList = data.players.map(p => `
                <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 4px; padding: 6px; margin-bottom: 5px; font-size: 0.75rem; text-align: center; color: #fff;">
                    ${p.name}
                </div>
            `).join("");
            
            if (data.squadName === teamAName) teamAPlayersHTML = pList;
            else if (data.squadName === teamBName) teamBPlayersHTML = pList;
        });

        body.innerHTML = `
            <div style="width: 100%; color: #fff; padding: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                    <div style="flex: 1;">
                        <div style="text-align: center; font-weight: 500; font-size: 1.2rem; color: #fff; margin-bottom: 20px;">
                            🚩 ${teamAName}
                        </div>
                        ${teamAPlayersHTML || '<div style="color:#555; text-align:center; font-size:0.75rem;">-</div>'}
                    </div>

                    <div style="display: flex; flex-direction: column; justify-content: center; height: 265px; color: #c9a66b; font-weight: 900; font-size: 0.9rem;">
                        VS
                    </div>

                    <div style="flex: 1;">
                        <div style="text-align: center; font-weight: 500; font-size: 1.2rem; color: #fff; margin-bottom: 20px;">
                            🚩 ${teamBName}
                        </div>
                        ${teamBPlayersHTML || '<div style="color:#555; text-align:center; font-size:0.75rem;">-</div>'}
                    </div>
                </div>
            </div>
        `;
    } catch (e) {
        body.innerHTML = "Error loading data.";
    }
}

// showResultTab() function ကို ဖျက်ပစ်ပါ (မလိုအပ်တော့ပါ)
// ✨ မိမိဖွင့်ထားသော အခန်းအား ဖျက်သိမ်းပြီး ပြန်ထွက်သည့် Function
async function cancelMyRoom() {
    if (!myTeamInfo || !myTeamInfo.id) return;
    if (confirm("မင်းရဲ့အခန်းကို ဖျက်သိမ်းမလား?")) {
        try {
            await db.collection("registrations").doc(myTeamInfo.id).update({
                matchStatus: 'none'
            });
            alert("အခန်းကို ဖျက်သိမ်းပြီးပါပြီ။");
            // 🔓 [FIX]: အခန်းဖျက်လိုက်လျှင် Create New Room ခလုတ်အား ပုံမှန်အတိုင်း ပြန်ဖွင့်ပေးခြင်း
            const createBtn = document.querySelector('.create-room-card');
            if (createBtn) {
                createBtn.style.pointerEvents = 'auto';
                createBtn.style.opacity = '1';
            }
        } catch (error) {
            console.error("Error cancelling room:", error);
        }
    }
}
async function createNewRoom() {
    if (!myTeamInfo || !myTeamInfo.id) {
        alert("Error: Team info not found. Please refresh.");
        return;
    }
    const btn = document.querySelector('.create-room-card');
    if(btn) {
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.5';
    }
    try {
        await db.collection("registrations").doc(myTeamInfo.id).update({
            matchStatus: 'waiting'
        });
        alert("အခန်းဖွင့်လိုက်ပါပြီ။ ပြိုင်ဘက်ကို စောင့်ဆိုင်းနေပါသည်...");
    } catch (error) {
        console.error("Error creating room: ", error);
        alert("Error: " + error.message);
        // 🔓 [FIX]: Error တက်ခဲ့လျှင်လည်း ခလုတ်ပြန်ပွင့်လာစေရန် စစ်ဆေးခြင်း
        if(btn) {
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
        }
    }
}
async function challengeTeam(opponentId) {
    if(confirm("ဒီအသင်းကို စိန်ခေါ်မလား?")) {
        const matchId = "MATCH_" + Math.random().toString(36).substr(2, 9);
        try {
            // တစ်ဖက်အသင်း (Opponent) ရဲ့ ဒေတာကို ဆွဲထုတ်ခြင်း
            const oppDoc = await db.collection("registrations").doc(opponentId).get();
            if (!oppDoc.exists) return;
            const oppData = oppDoc.data();
            const myName = myTeamInfo.mode === "5vs5" ? myTeamInfo.squadName : myTeamInfo.playerName;
            const oppName = oppData.mode === "5vs5" ? oppData.squadName : oppData.playerName;
            // 📞 Bot ဆီသို့ ပေးပို့ရန် ဖုန်းနှင့် ID အချက်အလက်များ စုစည်းခြင်း
            const myInfoText = myTeamInfo.mode === "5vs5"
                ? `Leader: ${myTeamInfo.kpayName || 'Unknown'}, Ph: ${myTeamInfo.kpayPhone || 'None'}`
                : `ID: ${myTeamInfo.mlbbId || 'None'}, Ph: ${myTeamInfo.kpayPhone || 'None'}`;
            const oppInfoText = oppData.mode === "5vs5"
                ? `Leader: ${oppData.kpayName || 'Unknown'}, Ph: ${oppData.kpayPhone || 'None'}`
                : `ID: ${oppData.mlbbId || 'None'}, Ph: ${oppData.kpayPhone || 'None'}`;
            const batch = db.batch();
            batch.update(db.collection("registrations").doc(myTeamInfo.id), {
                matchStatus: 'playing',
                currentMatchId: matchId,
                isReady: false
            });
            batch.update(db.collection("registrations").doc(opponentId), {
                matchStatus: 'playing',
                currentMatchId: matchId,
                isReady: false
            });
            // 👑 [MATCHES] ထဲသို့ Bot အတွက်ပါ ဒေတာများကို အပြည့်အစုံ ထည့်သွင်းပေးခြင်း
            const matchRef = db.collection("matches").doc(matchId);
            batch.set(matchRef, {
                matchId: matchId,
                fee: myTeamInfo.fee,
                teamA: myName,
                teamALogo: myTeamInfo.squadLogo || "",
                teamA_LeaderId: myTeamInfo.id,
                leaderA_Info: myInfoText,
                teamB: oppName,
                teamBLogo: oppData.squadLogo || "",
                teamB_LeaderId: opponentId,    //  [FIX]: oppData.id စား အပေါ်က လက်ခံရရှိတဲ့ opponentId ကို တိုက်ရိုက်သုံးလိုက်သည်
                leaderB_Info: oppInfoText,
                firstPickWinner: "",
                status: "open",
                matchTimestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            await batch.commit();
            console.log("Match linked successfully!");
            startMatchMonitoring(matchId);
        } catch (error) {
            alert("Match ချိတ်ဆက်ရာတွင် အမှားအယွင်းရှိပါသည်: " + error.message);
        }
    }
}
function startMatchMonitoring(matchId) {
    const matchCenter = document.getElementById('page-match-center');
    const playingLobby = document.getElementById('page-playing-lobby');
    if(matchCenter) matchCenter.style.display = 'none';
    if(playingLobby) playingLobby.style.display = 'flex';
    db.collection("registrations")
        .where("currentMatchId", "==", matchId)
        .onSnapshot((querySnapshot) => {
            let teams = [];
            querySnapshot.forEach(doc => {
                teams.push({ id: doc.id, ...doc.data() });
            });
            // ကစားသမားနှစ်ဦးစလုံး ပွဲထဲတွင် ကျန်ရှိနေမှသာ UI ဆွဲမည်
            if (teams.length >= 2) {
                renderBattleUI(teams, matchId);
            }
        });
}
// Render Battle UI
function renderBattleUI(teams, matchId) {
    const myTeam = teams.find(t => t.id === myTeamInfo.id);
    const opponent = teams.find(t => t.id !== myTeamInfo.id);
    if (!myTeam || !opponent) return;
    document.getElementById('match-fee-display').innerText = myTeam.fee + " Ks";
    // --- Team A (My Team) ---
    const teamAName = myTeam.squadName || myTeam.playerName;
    document.getElementById('p-team-a-name').innerText = teamAName;
    document.getElementById('p-team-a-logo').src = myTeam.squadLogo;
    const myPlayersHTML = myTeam.mode === "5vs5"
        ? myTeam.players.map(p => `<div class="player-name">👤 ${p.name}</div>`).join('')
        : `<div class="player-name">👤 ${myTeam.playerName}</div>`;
    document.getElementById('p-team-a-players').innerHTML = myPlayersHTML;
    document.getElementById('p-team-a-ready-badge').style.display = myTeam.isReady ? 'block' : 'none';
    // --- Team B (Opponent Team) ---
    const teamBName = opponent.squadName || opponent.playerName;
    document.getElementById('p-team-b-name').innerText = teamBName;
    document.getElementById('p-team-b-logo').src = opponent.squadLogo;
    const opponentPlayersHTML = opponent.mode === "5vs5"
        ? opponent.players.map(p => `<div class="player-name">👤 ${p.name}</div>`).join('')
        : `<div class="player-name">👤 ${opponent.playerName}</div>`;
    document.getElementById('p-team-b-players').innerHTML = opponentPlayersHTML;
    document.getElementById('p-team-b-ready-badge').style.display = opponent.isReady ? 'block' : 'none';
    // --- 🎮 Ready Button Toggling & Cancel Match Locking Logic ---
    const readyBtn = document.getElementById('ready-btn');
    const cancelMatchBtn = document.getElementById('cancel-match-btn');
    readyBtn.onclick = () => toggleReady(myTeam.isReady);
    if (cancelMatchBtn) {
        cancelMatchBtn.onclick = () => cancelMatch(matchId, myTeam.id, opponent.id);
    }
    if (myTeam.isReady) {
        readyBtn.innerText = "CONFIRMED";
        readyBtn.style.background = "#c9a66b";
        readyBtn.style.color = "#000";
        if (cancelMatchBtn) {
            cancelMatchBtn.disabled = true;
            cancelMatchBtn.style.opacity = "0.3";
            cancelMatchBtn.style.pointerEvents = "none";
        }
    } else {
        readyBtn.innerText = "CONFIRM (READY)";
        readyBtn.style.background = "#111";
        readyBtn.style.color = "#fff";
        if (cancelMatchBtn) {
            cancelMatchBtn.disabled = false;
            cancelMatchBtn.style.opacity = "1";
            cancelMatchBtn.style.pointerEvents = "auto";
        }
    }
    // --- 🚀 ပွဲစတင်ခြင်း (နှစ်ဖက်စလုံး Confirm ဖြစ်ပါက) ---
    if (myTeam.isReady && opponent.isReady) {
        if (!window.isMatchSetupInProgress) {
            window.isMatchSetupInProgress = true;
            db.collection("matches").doc(matchId).get().then((matchDoc) => {
                const randomWinnerName = Math.random() > 0.5 ? teamAName : teamBName;
                // matches doc ရှိပြီးသားဆိုရင် firstPickWinner ကိုပဲ update သွားလုပ်ပေးခြင်း
                db.collection("matches").doc(matchId).update({
                    firstPickWinner: randomWinnerName
                }).then(() => {
                    const batch = db.batch();
                    batch.update(db.collection("registrations").doc(myTeam.id), { matchStatus: 'playing' });
                    batch.update(db.collection("registrations").doc(opponent.id), { matchStatus: 'playing' });
                    batch.commit().then(() => {
                        listenToWheelSpin(matchId, teamAName, teamBName);
                    });
                }).catch(() => {
                    listenToWheelSpin(matchId, teamAName, teamBName);
                });
            });
        }
    }
}
// ✨ Confirm (Ready) အား စိတ်ကြိုက် ဖွင့်/ပိတ် (Toggle) လုပ်ပေးမည့် Function
async function toggleReady(currentReadyState) {
    if (!myTeamInfo || !myTeamInfo.id) return;
    try {
        await db.collection("registrations").doc(myTeamInfo.id).update({
            isReady: !currentReadyState
        });
    } catch (error) {
        console.error("Error toggling ready state: ", error);
    }
}
// ✨ [RULE 4]: ပွဲထွက်ခြင်း / ပွဲဖျက်သိမ်းခြင်း (Cancel Match Logic)
async function cancelMatch(matchId, myId, opponentId) {
    if (!confirm("ဒီပွဲစဉ်ကို ဖျက်သိမ်းပြီး Waiting Room သို့ ပြန်သွားမလား?")) return;
    try {
        const batch = db.batch();
        batch.update(db.collection("registrations").doc(myId), {
            matchStatus: 'none',
            currentMatchId: firebase.firestore.FieldValue.delete(),
            isReady: false
        });
        batch.update(db.collection("registrations").doc(opponentId), {
            matchStatus: 'waiting',
            currentMatchId: firebase.firestore.FieldValue.delete(),
            isReady: false
        });
        // ပွဲဖျက်လိုက်ရင် matches doc ကိုပါ တခါတည်းဖျက်ထုတ်ပေးခြင်း
        batch.delete(db.collection("matches").doc(matchId));
        await batch.commit();
        console.log("Match cancelled. Standard setup restored.");
        // 🔓 [FIX]: ပွဲဖျက်ပြီး Lobby သို့ ပြန်ရောက်သွားချိန်တွင်လည်း Create New Room ခလုတ်အား အလိုအလျောက် ပြန်ပွင့်စေခြင်း
        const createBtn = document.querySelector('.create-room-card');
        if (createBtn) {
            createBtn.style.pointerEvents = 'auto';
            createBtn.style.opacity = '1';
        }
    } catch (error) {
        console.error("Error cancelling match: ", error);
        alert("အမှားအယွင်းရှိပါသည်: " + error.message);
    }
}
// ✨ Listener စနစ်သုံးခြင်း
function listenToWheelSpin(matchId, nameA, nameB) {
    if (window.isWheelSpinning) return;
    window.isWheelSpinning = true;
    db.collection("matches").doc(matchId).onSnapshot((doc) => {
        if (doc.exists) {
            const matchData = doc.data();
            if (matchData.firstPickWinner) {
                startSpinWheel(matchData.firstPickWinner, nameA, nameB, matchId);
            }
        }
    });
}
function startSpinWheel(winnerName, nameA, nameB, matchId) {
    const container = document.getElementById('spin-container');
    const wheel = document.getElementById('main-wheel');
    const resultText = document.getElementById('spin-result');
    document.getElementById('page-playing-lobby').style.display = 'none';
    if (container) container.style.display = 'block';
    const labelA = document.querySelector('.label-a');
    const labelB = document.querySelector('.label-b');
    if (labelA) labelA.innerText = nameA;
    if (labelB) labelB.innerText = nameB;
    if (wheel) {
        wheel.style.transition = 'none';
        wheel.style.transform = 'rotate(0deg)';
    }
    setTimeout(() => {
        if (wheel) {
            wheel.style.transition = 'transform 6s cubic-bezier(0.1, 0, 0, 1)';
            const extraSpins = 3600;
            const stopAt = (winnerName === nameA) ? 90 : 270;
            const finalDeg = extraSpins + (360 - stopAt);
            wheel.style.transform = `rotate(${finalDeg}deg)`;
        }
        setTimeout(() => {
            if (resultText) resultText.innerHTML = `🎲 Result: <b style="color:#c9a66b; font-size:1.1rem;">${winnerName}</b> gets FIRST PICK!`;
            localStorage.setItem('last_match_id', matchId);
            setTimeout(() => {
                window.location.href = "https://t.me/aura_hub_match_bot?start=" + matchId;  
            }, 2000);
        }, 6500);
    }, 100);
}
async function cancelMatch() {
    const regId = localStorage.getItem('userRegId');

    if (!regId) {
        alert("❌ သင် မှတ်ပုံတင်ထားခြင်း မရှိသေးပါ။");
        return;
    }

    if (!confirm("ပွဲမစခင် ဖျက်သိမ်းပြီး ငွေပြန်အမ်းမှု တောင်းဆိုမှာလား?")) return;

    try {
        // Firebase မှာ Status ပြောင်းခြင်း
        await db.collection("registrations").doc(regId).update({
            status: "cancellation_requested"
        });

        // API ဆီ Notification ပို့ခြင်း
        await fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                type: 'cancel_request', 
                regId: regId,
                leaderName: "User" // လိုအပ်ရင် နာမည်ကို localStorage မှာ သိမ်းပြီး ဒီမှာ ပြန်ခေါ်သုံးပါ
            })
        });

        alert("ပွဲဖျက်ရန် တောင်းဆိုမှု ပေးပို့ပြီးပါပြီ။");
    } catch (error) {
        console.error("Error:", error);
        alert("အမှားအယွင်းရှိပါသည်။");
    }
}
fetch('/api/notify', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ type: 'registration', regId, data })
});
