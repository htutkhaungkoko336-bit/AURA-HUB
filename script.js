// --- DATA & STATE ---
const mapData = [
    { 
        mode: "5vs5", 
        img: "5vs5.png", 
        rules: "5vs5 Rules: No Cheat/Script. Team leader must capture result screenshot."
    },
    { 
        mode: "1vs1", 
        img: "1vs1.png", 
        rules: "1vs1 Rules: Mid lane only. First blood or first turret win."
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

    if (mode === "5vs5") {
        document.getElementById('page-5vs5').style.display = 'flex';
        document.getElementById('fee-5vs5').innerText = "Entry Fee: " + fee + " Ks";
    } else {
        document.getElementById('page-1vs1').style.display = 'flex';
        document.getElementById('fee-1vs1').innerText = "Entry Fee: " + fee + " Ks";
    }
}

function leaveRoom() {
    document.getElementById('page-5vs5').style.display = 'none';
    document.getElementById('page-1vs1').style.display = 'none';
    document.getElementById('page-room-select').style.display = 'flex';
}

function goToPayment() {
    const mode = mapData[currentIndex].mode;
    let name, phone;

    if (mode === "5vs5") {
        name = document.getElementById('kpay-name').value;
        phone = document.getElementById('kpay-no').value;
    } else {
        name = document.getElementById('kpay-name-solo').value;
        phone = document.getElementById('kpay-no-solo').value;
    }

    if (!name || !phone) {
        alert("K-Pay အချက်အလက်များကို အရင်ဖြည့်သွင်းပေးပါ။");
        return;
    }

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

// 🎯 [SUPER FIXED]: ပုံပေါ်လာပြီးနောက် ထပ်မံနှိပ်ပါကလည်း File Input ကို ပြန်ဖွင့်ပေးမည့် စနစ်
function previewLogo(event) {
    const file = event.target.files[0];
    const output = document.getElementById('logoPreview');
    const label = document.getElementById('logoLabel');
    const fileInput = document.getElementById('sqLogo');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function() {
            output.src = reader.result;
            output.style.display = 'block';
            if (label) label.style.display = 'none';

            // 🔥 [MAGIC LINE]: ပုံထွက်လာပြီးနောက် အဲဒီပုံကို ကလစ်ထပ်နှိပ်ရင် ဖိုင်ရွေးပုံး ပြန်ပွင့်လာအောင် ဖန်တီးခြင်း
            output.onclick = () => fileInput.click();
        };
        reader.readAsDataURL(file);
    }
}

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

    try {
        const paymentURL = await uploadToImgBB(ssFile);
        
        let squadLogoURL = ""; 
        if (sqLogoFile) {
            squadLogoURL = await uploadToImgBB(sqLogoFile);
        } else {
            squadLogoURL = "https://i.ibb.co/4pGm0Zf/default-logo.png";
        }

        const mode = mapData[currentIndex].mode;
        let registrationData = {
            mode: mode,
            fee: selectedFee,
            paymentURL: paymentURL,
            squadLogo: squadLogoURL,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: "pending",
            matchStatus: "none",
        };

        if (mode === "5vs5") {
            const players = Array.from(document.querySelectorAll('#page-5vs5 .player-row')).map(row => ({
                name: row.querySelectorAll('input')[0].value,
                id: row.querySelectorAll('input')[1].value
            }));
            registrationData.squadName = document.getElementById('squad-name').value;
            registrationData.players = players;
            registrationData.kpayName = document.getElementById('kpay-name').value;
            registrationData.kpayPhone = document.getElementById('kpay-no').value;
        } else {
            const soloRow = document.querySelector('#page-1vs1 .player-row');
            registrationData.playerName = soloRow.querySelectorAll('input')[0].value;
            registrationData.mlbbId = soloRow.querySelectorAll('input')[1].value;
            registrationData.kpayName = document.getElementById('kpay-name-solo').value;
            registrationData.kpayPhone = document.getElementById('kpay-no-solo').value;
        }

        const docRef = await db.collection("registrations").add(registrationData);
        document.getElementById('waiting-msg').innerText = "Payment ကို Admin မှ စစ်ဆေးနေပါသည်။ ခဏစောင့်ပေးပါ...";
        
        // Form တင်ပြီးပါက Clean ပြန်လုပ်ခြင်း
        document.getElementById('ssFile').value = "";
        document.getElementById('sqLogo').value = "";
        
        watchStatus(docRef.id);

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

// --- MATCH CENTER SYSTEM ---

let currentMatchTab = 'waiting';

let myTeamInfo = null;



function watchStatus(docId) {

    db.collection("registrations").doc(docId).onSnapshot((doc) => {

        if (doc.exists) {

            const data = doc.data();

            myTeamInfo = { id: doc.id, ...data };



            // ✨ [RULE 1]: Waiting Room အဆင့် (သို့မဟုတ်) အခန်းမရှိသေးသည့် အဆင့်

            // တစ်ဖက်လူက ပွဲဖျက်လိုက်လျှင် သော်လည်းကောင်း၊ မိမိဘာသာ Cancel လုပ်လျှင်သော်လည်းကောင်း Waiting UI သို့ အလိုအလျောက် ပြန်ပို့မည်

            if (data.status === "confirm" && (data.matchStatus === "none" || data.matchStatus === "waiting") && !data.currentMatchId) {

                const playingLobby = document.getElementById('page-playing-lobby');

                if (playingLobby) playingLobby.style.display = 'none';

               

                document.getElementById('page-payment-proof').style.display = 'none';

                document.getElementById('page-match-center').style.display = 'flex';

                loadMatchRooms();

            }



            // ✨ [RULE 2]: စိန်ခေါ်မှု အောင်မြင်၍ ပွဲစတင်ရန် ပြင်ဆင်သည့် အဆင့်

            if (data.matchStatus === "playing" && data.currentMatchId) {

                startMatchMonitoring(data.currentMatchId);

            }

        }

    });

}



function switchTab(tabName, element) {

    currentMatchTab = tabName;

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    element.classList.add('active');

    loadMatchRooms();

}



function loadMatchRooms() {

    const container = document.getElementById('match-content');

    if (!container) return;

   

    // 👇 ဒီစာကြောင်းလေး တစ်ကြောင်းတည်းကို အပေါ်ဆုံးမှာ ထည့်ပေးလိုက်ပါ (Error မတက်အောင် ကာကွယ်ခြင်း)

    if (!myTeamInfo || !myTeamInfo.fee) return;



    container.innerHTML = '<p style="text-align:center; color:#444; font-size:0.8rem;">Loading...</p>';

   

    // ... ကျန်တဲ့ ကုဒ်တွေက အောက်မှာ ပုံမှန်အတိုင်း ဆက်ရှိနေပါစေ ...

    // 🔒 Playing Tab ထဲရောက်ရင် Create Room ခလုတ်ကြီးကို ဖျောက်ထားပြီး Waiting Room ကျမှ ပြန်ပြပေးခြင်း

    const createRoomBtn = document.querySelector('.create-room-card');

    if (createRoomBtn) {

        if (currentMatchTab === 'playing') {

            createRoomBtn.style.display = 'none';

        } else {

            createRoomBtn.style.display = 'block'; // သို့မဟုတ် မူရင်း style အတိုင်း 'flex' ဟု ပြောင်းနိုင်သည်

        }

    }



    // 🔄 Tab အလိုက် ဒေတာဆွဲထုတ်မည့် လမ်းကြောင်းအား ခွဲထုတ်ခြင်း

    if (currentMatchTab === 'playing') {

        // 🎮 [PLAYING TAB LOGIC]: matches collection ဆီကနေ ပွဲစဉ်များကို တိုက်ရိုက်ဖတ်ပြီး ခလုတ်မပါသော UI ဆွဲမည်

        db.collection("matches")

            .orderBy("matchTimestamp", "desc")

            .onSnapshot((querySnapshot) => {

                container.innerHTML = "";

                if (querySnapshot.empty) {

                    container.innerHTML = `<p style="text-align:center; color:#333; margin-top:30px; font-size:0.8rem;">No matches running in playing tab yet.</p>`;

                    return;

                }



                querySnapshot.forEach((doc) => {

                    const data = doc.data();

                   

                    // နှစ်ဖက်စလုံးရဲ့ အသင်းနာမည်နှင့် Logo များဖြင့် တိုက်ရိုက် Card ပုံစံဆွဲခြင်း

                    const roomBar = `

                    <div class="match-card" style="border: 1px solid #333;">

                        <div class="match-header" style="justify-content: center;">

                            <span style="color:#c9a66b; font-weight:bold; font-size: 11px;">🎮 LIVE MATCHING</span>

                        </div>

                        <div class="match-body">

                            <div style="display:flex; align-items:center; gap:10px; width: 40%;">

                                <img src="${data.teamALogo || ''}" style="width:30px; height:30px; border-radius:50%; border:1px solid #333;">

                                <div style="color: #fff; font-size: 0.9rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Team <span style="color:#c9a66b; font-weight:bold;">${data.teamA}</span></div>

                            </div>

                           

                            <div style="color: #c9a66b; font-weight:bold; font-style:italic; width: 10%; text-align:center;">Vs</div>

                           

                            <div style="display:flex; align-items:center; gap:10px; justify-content:flex-end; width: 40%; text-align: right;">

                                <div style="color: #fff; font-size: 0.9rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Team <span style="color:#c9a66b; font-weight:bold;">${data.teamB}</span></div>

                                <img src="${data.teamBLogo || ''}" style="width:30px; height:30px; border-radius:50%; border:1px solid #333;">

                            </div>

                        </div>

                    </div>`;

                    container.innerHTML += roomBar;

                });

            });



    } else {

        // 🚪 [WAITING ROOM TAB LOGIC]: မူရင်းအတိုင်း registrations ထဲက အခန်းဖွင့်ထားသူများကိုပဲ ပြသပေးမည်

        db.collection("registrations")

            .where("fee", "==", Number(myTeamInfo.fee))

            .where("status", "==", "confirm")

            .where("matchStatus", "==", currentMatchTab)

            .onSnapshot((querySnapshot) => {

                container.innerHTML = "";

                if (querySnapshot.empty) {

                    container.innerHTML = `<p style="text-align:center; color:#333; margin-top:30px; font-size:0.8rem;">No entries in ${currentMatchTab} yet.</p>`;

                    return;

                }



                querySnapshot.forEach((doc) => {

                    const data = doc.data();

                    const isMyTeam = doc.id === myTeamInfo.id;

                    const name = data.mode === "5vs5" ? data.squadName : data.playerName;



                    const actionUI = isMyTeam

                        ? `<button class="cancel-room-btn" onclick="cancelMyRoom()" style="background:#cc0000; color:#fff; border:none; padding:4px 10px; border-radius:4px; font-size:0.7rem; cursor:pointer; font-weight:bold;">CANCEL ROOM</button>`

                        : `<button class="plus-join-btn" onclick="challengeTeam('${doc.id}')">+</button>`;



                    const roomBar = `

                    <div class="match-card" style="${isMyTeam ? 'border: 1px solid #c9a66b; background: rgba(201,166,107,0.05);' : ''}">

                        <div class="match-header">

                            <span>💰 ${data.fee}ks.</span>

                            <span style="opacity:0.7; font-size: 10px;">${data.mode}</span>

                        </div>

                        <div class="match-body">

                            <div style="display:flex; align-items:center; gap:10px;">

                                <img src="${data.squadLogo}" style="width:30px; height:30px; border-radius:50%; border:1px solid #333;">

                                <div style="color: #fff; font-size: 0.9rem;">Team <span style="color:#c9a66b; font-weight:bold;">${name}</span></div>

                            </div>

                            <div style="color: #c9a66b; font-weight:bold; font-style:italic;">Vs</div>

                            <div style="display:flex; align-items:center; gap:10px;">

                                <div style="width:28px; height:28px; border-radius:50%; border:1px dashed #444; display:flex; align-items:center; justify-content:center; color:#444; font-size:0.7rem;">?</div>

                                ${actionUI}

                            </div>

                        </div>

                    </div>`;

                    container.innerHTML += roomBar;

                });

            });

    }

}



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