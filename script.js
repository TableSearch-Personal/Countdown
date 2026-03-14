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

    const potatoSound = new Audio("sound.mp3");
    potatoSound.preload = "auto";

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
    
    function getTargetDate(){
    const now = new Date();
    let year = 2028;
    
    while(new Date(year,5,30) <= now){
    year++;
    }
    
    return new Date(year,5,30);
    }
    
    function getReachedDates(){
    
    const now = new Date();
    let year = 2028;
    let reached = [];
    
    while(new Date(year,5,30) <= now){
    
    let d = new Date(year,5,30);
    
    reached.push(
    d.toLocaleDateString(undefined,{
    day:"2-digit",
    month:"long",
    year:"numeric"
    })
    );
    
    year++;
    
    }
    
    return reached;
    }
    
    function updateCountdown(){
    
    const target = getTargetDate();
    const now = new Date();
    
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
    
    if(Math.floor(Math.random()*100)===0){
    
    el.potato.style.display="block";
    localStorage.setItem("potatoActive","true");
    
    }
    
    }
    
    el.potato.onclick = () => {

    potatoSound.currentTime = 0;
    potatoSound.play();
        
    el.potato.style.display = "none";
    localStorage.removeItem("potatoActive");
        
    };
    
    /* -----------------------------
       CHAINS
    ----------------------------- */
    
    function computeChains(){
    
    let lastDate = null;
    
    for(let i=storage.logs.length-1;i>=0;i--){
    
    let l = storage.logs[i];
    
    if(l.type !== "daily"){
    l.chain = false;
    continue;
    }
    
    let d = new Date(l.raw);
    
    if(lastDate){
    
    let diff = (lastDate - d)/86400000;
    l.chain = (diff === 1);
    
    }else{
    
    l.chain = false;
    
    }
    
    lastDate = d;
    
    }
    
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
       CLICK LOGIC
    ----------------------------- */
    
    let lastClickSecond = 0;
    
    function handleClick(){
    
    const currentSecond = Math.floor(Date.now()/1000);
    
    if(currentSecond === lastClickSecond) return;
    
    lastClickSecond = currentSecond;
    
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
    
    storage.extraClicks++;
    
    storage.logs.push({
    time:stamp,
    label:"EXTRA CLICK",
    type:"extra",
    raw:new Date().toISOString()
    });
    
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
    
    el.plus.addEventListener("pointerdown",startHold);
    
    window.addEventListener("pointerup",finishHold);
    
    el.plus.addEventListener("pointerleave",cancelHold);
    
    /* -----------------------------
       START
    ----------------------------- */
    
    render();
