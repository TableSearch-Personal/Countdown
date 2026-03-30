/* -----------------------------
   DEV SETTINGS
----------------------------- */

const SETTINGS = {
    // CLICK CONTROL
    cooldownEnabled: false,         // default: false
    cooldownMs: 1000,               // default: 1000

    // AUDIO
    soundEnabled: true,             // default: true
    clickSoundEnabled: true,        // default: true
    volume: 1.0,                    // default: 1.0
    clickVolume: 0.2,               // default: 0.2
    potatoVolume: 1.0,              // default: 1.0

    // HOLD BEHAVIOR
    strictInsideHold: false,        // default: false

    holdClickEnabled: true,         // if false, holding does nothing
    holdThresholdDaily: 0,          // minimum hold time to allow normal click (0 = off) (default 0)

    // POTATO SYSTEM
    potatoEnabled: true,            // default: true
    potatoChance: 100,              // 1 in X chance (default 100)
    potatoAutoHideMs: 0,            // 0 = never auto hide (default 0)

    // LOG SETTINGS
    maxLogs: 0,                     // keeps localStorage from growing forever (0 = unlimited)
    showReachedDates: true,         // default: true
    showExtraClicksInLog: true,     // default: true

    // DEBUG / DEV TOOLS
    debugMode: false,               // default: false
    showHoldTimer: false,           // default: false
    allowMultiClickSameDay: true,   // if false, blocks extra clicks completely

    // Known issue: Clearing extra clicks in the log doesn't clear it completly. extra clicks stay somewhat stored because the count is still displayed even after reload. Only log gets cleared of it.
};

/* -----------------------------
   AUDIO UNLOCK
----------------------------- */

let audioUnlocked = false;

function unlockAudio(){
    if(audioUnlocked) return;

    const a = new Audio("sound.mp3");
    a.play().then(()=>{
        a.pause();
        audioUnlocked = true;
    }).catch(()=>{});
}

document.addEventListener("pointerdown", unlockAudio, { once: true });

/* -----------------------------
   SAFE AUDIO
----------------------------- */

function createSafeAudio(src, customVolume = null){

    let available = true;

    const test = new Audio();
    test.src = src;

    test.addEventListener("error", () => {
        available = false;
    });

    return {
        play(){
            if(!SETTINGS.soundEnabled || !available) return;

            const audio = new Audio(src);

            let vol = SETTINGS.volume;
            if(customVolume !== null){
                vol = customVolume;
            }

            audio.volume = Math.max(0, Math.min(1, vol));

            audio.play().catch(()=>{});
        }
    };
}

const potatoSound = createSafeAudio("sound.mp3", SETTINGS.potatoVolume);
const clickSound = createSafeAudio("sound-click.mp3", SETTINGS.clickVolume);

/* -----------------------------
   DOM
----------------------------- */

const el = {
    today: document.getElementById("today"),
    days: document.getElementById("days"),
    weeks: document.getElementById("weeks"),
    time: document.getElementById("time"),
    dailyCounter: document.getElementById("dailyCounter"),
    extraClicks: document.getElementById("extraClicks"),
    logContent: document.getElementById("logContent"),
    log: document.getElementById("log"),
    toggleLog: document.getElementById("toggleLog"),
    plus: document.getElementById("plus"),
    progress: document.getElementById("progressBar"),
    potato: document.getElementById("potatoAlert")
};

/* -----------------------------
   DATE
----------------------------- */

el.today.textContent =
new Date().toLocaleDateString(undefined,{
    weekday:"short",
    day:"2-digit",
    month:"short",
    year:"numeric"
});

/* -----------------------------
   STORAGE
----------------------------- */

const storage = {
    dailyCounter: parseInt(localStorage.getItem("dailyCounter")) || 0,
    extraClicks: parseInt(localStorage.getItem("extraClicks")) || 0,
    lastMainClick: localStorage.getItem("lastMainClick") || "",
    logs: JSON.parse(localStorage.getItem("logs") || "[]")
};

function save(){
    localStorage.setItem("dailyCounter",storage.dailyCounter);
    localStorage.setItem("extraClicks",storage.extraClicks);
    localStorage.setItem("lastMainClick",storage.lastMainClick);
    localStorage.setItem("logs",JSON.stringify(storage.logs));
}

/* -----------------------------
   COUNTDOWN
----------------------------- */

function updateCountdown(){
    const now = new Date();
    let year = 2028;

    while(new Date(year,5,30) <= now){
        year++;
    }

    const target = new Date(year,5,30);

    let diff = target - now;
    if(diff < 0) diff = 0;

    const days = Math.floor(diff / 86400000);
    const weeks = Math.floor(days / 7);

    const hours = Math.floor((diff/3600000)%24);
    const minutes = Math.floor((diff/60000)%60);
    const seconds = Math.floor((diff/1000)%60);

    el.days.textContent = days;
    el.weeks.textContent = weeks + " WEEKS";
    el.time.textContent = `${hours}h ${minutes}m ${seconds}s`;
}

setInterval(updateCountdown,1000);
updateCountdown();

/* -----------------------------
   POTATO
----------------------------- */

if(localStorage.getItem("potatoActive")==="true"){
    el.potato.style.display="block";
}

function tryPotato(){
    if(!SETTINGS.potatoEnabled) return;

    if(Math.floor(Math.random() * SETTINGS.potatoChance) === 0){
        el.potato.style.display = "block";
        localStorage.setItem("potatoActive", "true");

        if(SETTINGS.potatoAutoHideMs > 0){
            setTimeout(()=>{
                el.potato.style.display = "none";
                localStorage.removeItem("potatoActive");
            }, SETTINGS.potatoAutoHideMs);
        }
    }
}

el.potato.onclick = () => {
    potatoSound.play();
    el.potato.style.display = "none";
    localStorage.removeItem("potatoActive");
};

/* -----------------------------
   CHAINS
----------------------------- */

function isNextDay(prevISO, nextISO){
    const prev = new Date(prevISO);
    const next = new Date(nextISO);

    // remove time part (midnight)
    const prevDay = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate());
    const nextDay = new Date(next.getFullYear(), next.getMonth(), next.getDate());

    const diffDays = (nextDay - prevDay) / 86400000;

    // true if exactly 1 day difference
    return diffDays === 1;
}

function computeChains(){
    let lastDaily = null;

    for(let i = storage.logs.length - 1; i >= 0; i--){
        let l = storage.logs[i];

        // only daily clicks chain
        if(l.type !== "daily"){
            l.chain = false;
            continue;
        }

        if(lastDaily){
            l.chain = isNextDay(l.raw, lastDaily.raw);
        }else{
            l.chain = false;
        }

        lastDaily = l;
    }
}

/* -----------------------------
   Reached Dates
----------------------------- */

function getReachedDates(){
    if(!SETTINGS.showReachedDates) return [];

    const now = new Date();

    const startYear = 2028; // 2028
    const reached = [];

    for(let year = startYear; year <= now.getFullYear(); year++){
        const target = new Date(year, 5, 30); // June 30

        if(target <= now){
            reached.push(target.toLocaleDateString(undefined,{
                day:"2-digit",
                month:"2-digit",
                year:"numeric"
            }));
        }
    }

    return reached;
}

/* -----------------------------
   RENDER
----------------------------- */

function render(){
    el.dailyCounter.textContent = storage.dailyCounter;
    el.extraClicks.textContent = storage.extraClicks;

    computeChains();

    let reached = getReachedDates();

    let reachedHTML = reached
    .map(d=>`<div class="reached">✓ ${d} reached</div>`)
    .join("");

    let clickHTML = "";

    for(let i=storage.logs.length-1;i>=0;i--){
        let l = storage.logs[i];
    
        if(l.type === "extra" && !SETTINGS.showExtraClicksInLog){
            continue;
        }
    
        let cls = l.chain ? "chain" : l.type;
        clickHTML += `<div class="${cls}">${l.time} - ${l.label}</div>`;
    }

    if(!reachedHTML && !clickHTML){
        el.logContent.innerHTML = "No clicks yet.";
        return;
    }

    el.logContent.innerHTML = reachedHTML + clickHTML;
}

/* -----------------------------
   LOG TOGGLE
----------------------------- */

el.toggleLog.onclick = () => {
    el.log.classList.toggle("show");
};

/* -----------------------------
   COOLDOWN
----------------------------- */

let lastClickTime = 0;

function canClick(){
    if(!SETTINGS.cooldownEnabled) return true;

    const now = Date.now();
    if(now - lastClickTime < SETTINGS.cooldownMs){
        return false;
    }

    lastClickTime = now;
    return true;
}

/* -----------------------------
   CLICK LOGIC
----------------------------- */

function handleClick(){

    if(!canClick()) return;

    if(SETTINGS.clickSoundEnabled){
        clickSound.play();
    }

    const today = new Date().toDateString();
    const stamp = new Date().toLocaleString();

    if(storage.lastMainClick !== today){

        storage.dailyCounter++;
        storage.extraClicks = 0;
        storage.lastMainClick = today;

        storage.logs.push({
            time:stamp,
            label:"DAILY CLICK",
            type:"daily",
            raw:new Date().toISOString()
        });

    }else{

        if(!SETTINGS.allowMultiClickSameDay) return;
    
        storage.extraClicks++;
    
        storage.logs.push({
            time: stamp,
            label: "EXTRA CLICK",
            type: "extra",
            raw: new Date().toISOString()
        });
    }

    if(SETTINGS.maxLogs > 0 && storage.logs.length > SETTINGS.maxLogs){
        storage.logs = storage.logs.slice(storage.logs.length - SETTINGS.maxLogs);
    }

    if(SETTINGS.debugMode){
        console.log("CLICK REGISTERED", storage);
    }

    save();
    tryPotato();
    render();
}

/* -----------------------------
   HOLD SYSTEM
----------------------------- */

let holding = false;
let holdStart = 0;
let animationFrame = null;

function startHold(){
    holding = true;
    holdStart = Date.now();
    animationFrame = requestAnimationFrame(updateHold);
}

function cancelHold(){
    holding = false;
    el.progress.style.width = "0%";

    if(animationFrame){
        cancelAnimationFrame(animationFrame);
    }
}

function finishHold(){
    if(!holding) return;

    holding = false;

    let held = (Date.now()-holdStart)/1000;

    el.progress.style.width="0%";

    if(held>=10 && held<20){
        storage.logs = storage.logs.filter(l=>l.type!=="extra");
        save();
        render();
        return;
    }

    if(held>=20 && held<30){
        localStorage.clear();
        location.reload();
        return;
    }

    if(held>=30) return;

    handleClick();
}

function updateHold(){
    if(!holding) return;

    let held = Date.now()-holdStart;

    let percent = Math.min((held/30000)*100,100);

    el.progress.style.width = percent + "%";

    if(held<10000){
        el.progress.style.background="#ff9f1c";
    }
    else if(held<20000){
        el.progress.style.background="#e63946";
    }
    else{
        el.progress.style.background="#888";
    }

    animationFrame = requestAnimationFrame(updateHold);
}

/* -----------------------------
   POINTER EVENTS
----------------------------- */

let activePointerId = null;

el.plus.addEventListener("pointerdown", (e) => {
    activePointerId = e.pointerId;
    el.plus.setPointerCapture(activePointerId);
    startHold();
});

el.plus.addEventListener("pointermove", (e) => {
    if(e.pointerId !== activePointerId || !holding) return;

    const rect = el.plus.getBoundingClientRect();

    const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

    if(!inside && SETTINGS.strictInsideHold){
        cancelHold();
    }
});

el.plus.addEventListener("pointerup", (e) => {
    if(e.pointerId !== activePointerId) return;

    finishHold();
    activePointerId = null;
});

el.plus.addEventListener("pointercancel", cancelHold);

/* -----------------------------
   START
----------------------------- */

render();