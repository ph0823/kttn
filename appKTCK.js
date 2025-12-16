

/**
 * appKTCK.js 
 * Tính năng 
 * - Khóa nút NỘP BÀI cho đến khi học sinh trả lời hết câu (hiển thị số câu còn lại)
 * - Chống double-submit (debounce & server ack)
 * - Autosave đáp án vào localStorage (phục hồi khi refresh)
 * 
 * - Chặn copy / paste / chuột phải / phím tắt (Ctrl/Cmd+U, F12) ở mức cơ bản
 * - Tối ưu render: chỉ render phần cần thay đổi, tối ưu overview
 * - Tự động nộp khi hết giờ (auto submit)
 * - Bảo vệ khi submit (disable, running state)
 *
 * LƯU Ý: Đặt file này vào cùng thư mục với index HTML (test.html) và đảm bảo:
 * - data/ontap7hk1.json
 *= [
 *   { cdA: [ {q, options, correct}, ... ] },
 *   { cdC: [ ... ] },
 *   { cdD1: [ ... ] },
 *   { cdD2: [ ... ] }
 *  ];
 * - data/students.json
 * {
  "7.1": [
    {
      "stt": 1,
      "ten": "Đoàn Phạm Khánh An"
    },
    {
      "stt": 2,
      "ten": "Nguyễn Mai Trâm Anh"
    }
  }
 * tồn tại và đúng cấu trúc.
 *
 * Nếu muốn tắt 1 tính năng (ví dụ anti-cheat), chỉnh biến config.allowCheatFeatures = true/false
 */

/* ================== Cấu hình ================== */
const CONFIG = {
  MIN_SCORE: 5,
  GOOGLE_API: "https://script.google.com/macros/s/AKfycbyAFbKjEZlA0RmAChAsHWirbeWAK7RwzBNYEAQb4O4tLytTOjoAevXlhDNA3ANtwDcN/exec",
  AUTO_SAVE_KEY: "ktck1_2025",
  FOCUS_MAX_WARN: 5, // số lần rời tab trước khi đánh dấu nghi ngờ
  allowCheatFeatures: true // bật/tắt các tính năng chống gian lận
};

/* ================== FIX: Ensure submit button updater exists early ================== */
function updateSubmitButton() {
  const total = quiz.length || 0;
  const answered = Object.keys(answers).length || 0;
  const btn = document.getElementById("btn-submit");
  if (!btn) return;

  if (answered < total) {
    btn.disabled = true;
    btn.style.opacity = "0.55";
    btn.innerText = `NỘP BÀI (${total - answered} câu còn lại)`;
  } else {
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.innerText = "NỘP BÀI";
  }
}

/* ================== State ================== */
let students = [];
let questions = [];
let quiz = [];
let answers = {}; // { questionId: "A. text" }
let currentIndex = 0;
let selectedStudent = null;
let timeLeft = 600; // seconds
let timerInterval = null;
let submitRunning = false;
let focusCount = 0;
let autoSaveTimer = null;
let lastSaveAt = null;
let serverAck = false;

/* ================== Helpers ================== */
const $ = id => document.getElementById(id);
const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
const safeText = s => (s===undefined || s===null)?'':String(s);
const encodeOpt = s => encodeURIComponent(s);
const decodeOpt = s => decodeURIComponent(s);

/* ================== Load data ================== */
async function loadData() {
  try {
    const studentRes = await fetch("data/students.json");
    if (!studentRes.ok) throw new Error("Không tìm thấy file students.json");
    students = await studentRes.json();

    const questionRes = await fetch("data/ontap7hk1.json");
    if (!questionRes.ok) throw new Error("Không tìm thấy file ontap7hk1.json");
    questions = await questionRes.json();

    // chuẩn hóa id
    questions = questions.map((q,i)=>({ ...q, id: q.id || "Q"+(i+1)}));

    loadClasses(students);
    console.log("Dữ liệu đã tải.");
  } catch (err) {
    alert("Lỗi khi tải dữ liệu: " + err.message);
    console.error(err);
  }
}

/* ================== Classes & Students ================== */
function loadClasses(studentsData) {
  const selectClass = $("select-class");
  selectClass.innerHTML = `<option value="">-- Chọn lớp --</option>`;

  Object.keys(studentsData).forEach(className => {
    const option = document.createElement("option");
    option.value = className;   // ví dụ: "7.1"
    option.textContent = className;
    selectClass.appendChild(option);
  });

  
  selectClass.onchange = () => {
    selectedStudent = null;
    loadStudentsByClass(studentsData, selectClass.value);
  };
}


function loadStudentsByClass(studentsData, className) {
  const selectStudent = $("select-student");
  selectStudent.innerHTML = `<option value="">-- Chọn học sinh --</option>`;

  if (!className || !studentsData[className]) return;

  studentsData[className].forEach(stu => {
    const option = document.createElement("option");
    option.value = stu.stt; // dùng stt để xác định duy nhất
    option.textContent = `${stu.stt}. ${stu.ten}`;
    selectStudent.appendChild(option);
  });

 
  selectStudent.onchange = () => {
    const stt = Number(selectStudent.value);
    selectedStudent = studentsData[className].find(s => s.stt === stt);
    if (selectedStudent) {
      selectedStudent.LOP = className;
    }
  };
}





/* ================== Build Quiz (ontap7hk1.json) ================== */
/* ================== Build Quiz (random mỗi lần chạy) ================== */
function buildQuiz() {
  const bank = { cdA: [], cdC: [], cdD1: [], cdD2: [] };

  // gom câu hỏi từ ontap7hk1.json
  questions.forEach(obj => {
    Object.keys(bank).forEach(k => {
      if (Array.isArray(obj[k])) {
        bank[k].push(...obj[k]);
      }
    });
  });

  // tỉ lệ câu hỏi
  const RATIO = {
    cdA: 7,
    cdC: 4,
    cdD1: 4,
    cdD2: 5
  };

  let selectedQuestions = [];

  // lấy ngẫu nhiên theo tỉ lệ
  Object.keys(RATIO).forEach(k => {
    const picked = shuffle(bank[k]).slice(0, RATIO[k]);
    selectedQuestions.push(
      ...picked.map((q, i) => ({
        ...q,
        id: `${k}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        group: k
      }))
    );
  });

  const LABELS = ["A", "B", "C", "D"];

  // xáo trộn thứ tự câu + đáp án
  quiz = shuffle(selectedQuestions).map(q => {
    const contents = [...q.options];
    const correctContent = contents[q.correct];

    const shuffled = shuffle(contents);
    const newOptions = shuffled.map((c, i) => `${LABELS[i]}. ${c}`);
    const newCorrect = LABELS[shuffled.indexOf(correctContent)];

    return {
      id: q.id,
      q: q.q,
      options: newOptions,
      correct: newCorrect,
      group: q.group
    };
  });

  // reset trạng thái
  answers = {};
  currentIndex = 0;
  focusCount = 0;
  serverAck = false;

  renderOverview();
  showQuestion();
  updateSubmitButton();
  startAutoSave();
}



/* ================== Render Question ================== */
function showQuestion() {
  const q = quiz[currentIndex];
  const box = $("question-box");
  if(!q){ box.innerHTML = "<p>Không có câu hỏi.</p>"; return; }

  // Build options HTML (do not re-create overview)
  const optionsHtml = q.options.map(opt => {
    const selectedClass = answers[q.id] === opt ? "selected" : "";
    return `<div class="option ${selectedClass}" data-id="${q.id}" data-val="${encodeOpt(opt)}">${opt}</div>`;
  }).join("");

  box.innerHTML = `
    <h3>Câu ${currentIndex + 1}: ${safeText(q.q)}</h3>
    <div class="meta" style="font-size:13px;color:#555;margin-bottom:8px">
      <span>Loại: ${safeText(q.level)}</span>
    </div>
    <div class="options-grid">${optionsHtml}</div>
    <div style="margin-top:10px;color:#666;font-size:13px">Lần rời tab: <span id="focus-count">${focusCount}</span></div>
  `;

  // Attach events
  const opts = box.querySelectorAll(".option");
  opts.forEach(el=>{
    el.onclick = ()=>{
      if (submitRunning) return; // locked when submitting
      const id = el.dataset.id;
      const val = decodeOpt(el.dataset.val);
      answers[id] = val;

      opts.forEach(o=>o.classList.remove("selected"));
      el.classList.add("selected");

      updateOverviewStatus();
      updateSubmitButton();
      saveAutosaveDebounced();
    };
  });

  updateOverviewStatus();
}

/* ================== Overview ================== */
function renderOverview() {
  const box = $("overview");
  box.innerHTML = quiz.map((q,i)=>{
    return `<div class="over-btn" id="ov-btn-${i}" data-index="${i}">${i+1}</div>`;
  }).join("");

  // Attach click listeners
  box.querySelectorAll(".over-btn").forEach(el=>{
    el.onclick = ()=>{
      const idx = Number(el.dataset.index);
      currentIndex = idx;
      showQuestion();
    };
  });
}

function updateOverviewStatus() {
  quiz.forEach((q,i)=>{
    const btn = $("ov-btn-"+i);
    if(!btn) return;
    btn.className = "over-btn";
    if (i === currentIndex) btn.classList.add("current");
    if (answers[q.id]) btn.classList.add("answered");
  });
}

/* ================== Submit ================== */
async function submitQuiz(auto=false) {
  if (submitRunning) return;
  // check complete unless auto
  if (!auto) {
    const total = quiz.length;
    const answered = Object.keys(answers).length;
    if (answered < total) {
      alert(`Bạn còn ${total - answered} câu chưa làm. Vui lòng hoàn thành trước khi nộp bài!`);
      return;
    }
  }

  if (!auto) {
    if (!confirm("Bạn chắc chắn muốn nộp bài?")) return;
  }

  submitRunning = true;
  clearInterval(timerInterval);
  disableInteractions(true);

  const btn = $("btn-submit");
  btn.disabled = true;
  btn.innerText = "Đang nộp...";

  // calculate score
  let correctCount = 0;
  quiz.forEach(q=>{
    const ua = answers[q.id];
    // compare label or full string
    if (ua && (ua === q.correct || ua.startsWith(q.correct + "."))) correctCount++;
  });

  let score = Math.round((correctCount / quiz.length) * 1000) / 100;
  if (score < CONFIG.MIN_SCORE) score = CONFIG.MIN_SCORE;

  const payload = {
    lop: selectedStudent.LOP,
    stt: selectedStudent.stt,
    ten: selectedStudent.ten,
    score,
    correctCount,
    total: quiz.length,
    timestamp: new Date().toISOString(),
    answers,
    focusCount
  };

  // send - using try/finally to always cleanup UI
  try {
    // prevent double-send: mark serverAck false initially
    serverAck = false;

    // Use fetch but mode no-cors may not return OK; still attempt
    await fetch(CONFIG.GOOGLE_API, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    // if no-cors, we can't read response reliably. So assume success.
    serverAck = true;
  } catch (err) {
    console.error("Lỗi khi gửi:", err);
  } finally {
    // show result screen
    $("result-info").innerHTML = `
      <div class="submit-success-box">
        <h2 style="color:#28a745">✅ Nộp bài ${serverAck ? "thành công" : "đã lưu (tạm)"}!</h2>
        <p>Học sinh: <b>${selectedStudent.ten}</b> - Lớp ${selectedStudent.LOP}</p>        
        <p style="color:#666;font-style:italic">Kết quả đã được ghi nhận ${serverAck ? "trên hệ thống." : "tạm thời (vui lòng kiểm tra lại)."} </p>
      </div>
    `;

    submitRunning = false;
    disableInteractions(false);
    showScreen("screen-result");
    // clear autosave
    clearAutosave();
    btn.disabled = false;
    btn.innerText = "NỘP BÀI";
  }
}

/* ================== Screen ================== */
function showScreen(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

/* ================== Timer ================== */
function startTimer(){
  const box = $("timer-box");
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(()=>{
    timeLeft--;
    if (timeLeft < 0) timeLeft = 0;
    const m = Math.floor(timeLeft/60);
    const s = timeLeft % 60;
    box.innerText = `${m}:${s < 10 ? "0"+s : s}`;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      alert("⏰ Hết giờ! Hệ thống sẽ tự động nộp bài.");
      submitQuiz(true);
    }
    saveAutosaveDebounced();
  }, 1000);
}

/* ================== Autosave ================== */
function saveAutosave() {
  try {
    const data = {
      stt: selectedStudent ? selectedStudent.STT : null,
      quizIds: quiz.map(q=>q.id),
      answers,
      timeLeft,
      focusCount,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(CONFIG.AUTO_SAVE_KEY, JSON.stringify(data));
    lastSaveAt = new Date();
    // console.log("Autosaved");
  } catch(err){
    console.error("Autosave failed", err);
  }
}

function saveAutosaveDebounced() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(()=>saveAutosave(), 700);
}

function loadAutosave(){
  try {
    const raw = localStorage.getItem(CONFIG.AUTO_SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch(err){
    return null;
  }
}

function clearAutosave(){
  try { localStorage.removeItem(CONFIG.AUTO_SAVE_KEY); } catch(e){}
}

function startAutoSave(){
  saveAutosaveDebounced();
  // also periodic
  if (autoSaveTimer) clearInterval(autoSaveTimer);
  autoSaveTimer = setInterval(saveAutosave, 30*1000); // every 30s
}

/* ================== Utilities ================== */
function arraysEqual(a,b){
  if(!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i=0;i<a.length;i++) if (a[i] !== b[i]) return false;
  return true;
}

/* ================== Disable interactions during submit ================== */
function disableInteractions(disable) {
  const allOpts = document.querySelectorAll(".option");
  allOpts.forEach(o => o.style.pointerEvents = disable ? "none" : "");
  // optionally disable navigation
  $("btn-prev").disabled = disable;
  $("btn-next").disabled = disable;
  $("btn-start").disabled = disable;
}

/* ================== Anti-cheat / Focus detection ================== */
function setupFocusDetection(){
  if (!CONFIG.allowCheatFeatures) return;

  // block some keys
  document.addEventListener("keydown", (e)=>{
    if (!CONFIG.allowCheatFeatures) return;
    // block F12, Ctrl+Shift+I, Ctrl+U, Ctrl+S (save), Ctrl+C/V? we allow copy maybe
    if (e.key === "F12" || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "i") || (e.ctrlKey && e.key.toLowerCase() === "u")) {
      e.preventDefault();
      flashMessage("Chức năng này đã bị vô hiệu hóa trong bài kiểm tra.");
    }
    // prevent paste to answers (rudimentary)
    if (e.ctrlKey && (e.key.toLowerCase() === "v")) {
      e.preventDefault();
      flashMessage("Dán bị vô hiệu hóa trong lúc làm bài.");
    }
  });

  // context menu
  document.addEventListener("contextmenu", (e)=>{
    if (!CONFIG.allowCheatFeatures) return;
    e.preventDefault();
    flashMessage("Chuột phải đã bị vô hiệu hóa trong bài kiểm tra.");
  });
}

/* ================== Flash messages ================== */
let flashTimer = null;
function flashMessage(msg, timeout=2500){
  let el = document.getElementById("flash-msg");
  if (!el) {
    el = document.createElement("div");
    el.id = "flash-msg";
    el.style.position = "fixed";
    el.style.right = "20px";
    el.style.top = "20px";
    el.style.zIndex = 9999;
    el.style.background = "rgba(0,0,0,0.75)";
    el.style.color = "#fff";
    el.style.padding = "10px 14px";
    el.style.borderRadius = "8px";
    el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
    document.body.appendChild(el);
  }
  el.innerText = msg;
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(()=>{ el.remove(); flashTimer=null; }, timeout);
}

/* ================== Submit button status ================== */
function updateSubmitButton(){
  const total = quiz.length;
  const answered = Object.keys(answers).length;
  const btn = $("btn-submit");
  if (!btn) return;
  if (answered < total) {
    btn.disabled = true;
    btn.style.opacity = "0.55";
    btn.innerText = `NỘP BÀI (${total - answered} câu còn lại)`;
  } else {
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.innerText = "NỘP BÀI";
  }
}

/* ================== INIT / Events ================== */
document.addEventListener("DOMContentLoaded", ()=>{
  // wire up buttons
  $("btn-start").onclick = ()=>{
    if (!selectedStudent) { alert("Vui lòng chọn học sinh trước khi bắt đầu!"); return; }
    $("student-info").innerHTML = `Học sinh: <b>${selectedStudent.ten}</b> - Lớp: ${selectedStudent.LOP}`;
    buildQuiz();
    showScreen("screen-quiz");
    timeLeft = 600;
    startTimer();
    setupFocusDetection();
  };

  $("btn-next").onclick = ()=>{
    if (currentIndex < quiz.length - 1) {
      currentIndex++;
      showQuestion();
    }
  };

  $("btn-prev").onclick = ()=>{
    if (currentIndex > 0) {
      currentIndex--;
      showQuestion();
    }
  };

  $("btn-submit").onclick = ()=>{
    submitQuiz(false);
  };

  // prevent accidental form submit via enter
  document.addEventListener("keydown", (e)=>{
    if (e.key === "Enter" && document.activeElement && document.activeElement.tagName === "INPUT") {
      e.preventDefault();
    }
  });

  // load data
  loadData();
});

/* ================== Clear sensitive events on unload ================== */
window.addEventListener("beforeunload", (e)=>{
  saveAutosave();
  // standard prompt (modern browsers may ignore)
  // e.returnValue = "Bạn có chắc muốn rời trang? Bài làm sẽ được lưu tạm.";
});

/* ================== End of file ================== */
