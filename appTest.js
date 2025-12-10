/**
 * APP.JS - Phiên bản chuẩn – ĐÃ SỬA LỖI KHÔNG CHỌN ĐƯỢC ĐÁP ÁN
 */

let students = [];
let questions = [];
let quiz = [];
let answers = {};
let currentIndex = 0;
let selectedStudent = null;

const MIN_SCORE = 5;
const GOOGLE_API = "https://script.google.com/macros/s/AKfycbyAFbKjEZlA0RmAChAsHWirbeWAK7RwzBNYEAQb4O4tLytTOjoAevXlhDNA3ANtwDcN/exec";


// ------------ 1. LOAD DATA ---------------
async function loadData() {
  try {
    const studentRes = await fetch("data/students.json");
    students = await studentRes.json();

    const questionRes = await fetch("data/questions.json");
    questions = await questionRes.json();

    // 🟢 Tạo id cho từng câu nếu không có
    questions = questions.map((q, i) => ({
      ...q,
      id: q.id || "Q" + (i + 1)
    }));

    loadClasses();
  } catch (err) {
    alert("Không thể tải dữ liệu JSON.");
    console.error(err);
  }
}


// ------------ 2. LOAD CLASSES / STUDENTS ---------------
function loadClasses() {
  const select = document.getElementById("select-class");
  const classes = [...new Set(students.map(s => s.LƠP))].sort();

  select.innerHTML = `<option value="">-- Chọn lớp --</option>` +
    classes.map(c => `<option value="${c}">${c}</option>`).join("");

  select.onchange = () => loadStudents(select.value);
}

function loadStudents(className) {
  const select = document.getElementById("select-student");
  const list = students.filter(s => s.LƠP === className);

  select.innerHTML = `<option value="">-- Chọn học sinh --</option>` +
    list.map(s => `<option value="${s.STT}">${s.STT} - ${s.TEN}</option>`).join("");

  select.onchange = () => {
    selectedStudent = list.find(s => s.STT == select.value);
  };
}


// ------------ 3. QUIZ BUILDER ---------------
const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

function buildQuiz() {
  const NB = questions.filter(q => q.level === "NB");
  const TH = questions.filter(q => q.level === "TH");
  const VD = questions.filter(q => q.level === "VD");

  quiz = [
    ...shuffle(NB).slice(0, 5),
    ...shuffle(TH).slice(0, 2),
    ...shuffle(VD).slice(0, 3),
  ];

  quiz = shuffle(quiz).map(q => ({
    ...q,
    options: shuffle(q.options)
  }));

  answers = {};
  currentIndex = 0;

  updateOverview();
  showQuestion();
}


// ------------ 4. RENDER QUESTION ---------------
function showQuestion() {
  const q = quiz[currentIndex];
  const box = document.getElementById("question-box");

  box.innerHTML = `
    <h3>Câu ${currentIndex + 1}: ${q.q}</h3>

    <div class="options-grid">
      ${q.options.map(opt => `
        <div class="option ${answers[q.id] === opt ? "selected" : ""}"
             data-id="${q.id}"
             data-opt="${encodeURIComponent(opt)}">
          ${opt}
        </div>
      `).join("")}
    </div>
  `;

  document.querySelectorAll(".option").forEach(el => {
    el.onclick = () => {
      const id = el.dataset.id;
      const opt = decodeURIComponent(el.dataset.opt);

      answers[id] = opt;

      updateOverview();
      showQuestion();
    };
  });
}


// ------------ 5. OVERVIEW NAVIGATION ---------------
function updateOverview() {
  const box = document.getElementById("overview");

  box.innerHTML = quiz.map((q, i) => `
    <div class="over-btn
      ${answers[q.id] ? "answered" : ""}
      ${i == currentIndex ? "current" : ""}"
      onclick="jumpTo(${i})">
      ${i + 1}
    </div>
  `).join("");
}

window.jumpTo = i => {
  currentIndex = i;
  showQuestion();
  updateOverview();
};


// ------------ 6. SUBMIT ---------------
async function submitQuiz() {
  if (!confirm("Bạn chắc chắn muốn nộp bài?")) return;

  let correctCount = 0;

  quiz.forEach(q => {
    if (answers[q.id] && answers[q.id].startsWith(q.correct)) correctCount++;
  });

  let score = Math.round((correctCount / quiz.length) * 10);
  if (score < MIN_SCORE) score = MIN_SCORE;

  const payload = {
    lop: selectedStudent.LƠP,
    stt: selectedStudent.STT,
    ten: selectedStudent.TEN,
    score,
    correctCount,
    total: quiz.length,
    timestamp: new Date().toISOString(),
    answers
  };

  try {
    await fetch(GOOGLE_API, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error(err);
  }

  document.getElementById("result-info").innerHTML = `
  <div style="font-size:22px; color:#16a34a; margin-top:10px;">
    Học sinh: <b>${selectedStudent.TEN}</b>
  </div>
`;


  showScreen("screen-result");
}


// ------------ 7. CHANGE SCREEN ---------------
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}


// ------------ 8. BUTTON EVENTS ---------------
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-start").onclick = () => {
    if (!selectedStudent) return alert("Vui lòng chọn học sinh!");

    document.getElementById("student-info").innerHTML =
      `Học sinh: <b>${selectedStudent.TEN}</b> - Lớp: ${selectedStudent.LƠP}`;

    buildQuiz();
    showScreen("screen-quiz");
  };

  document.getElementById("btn-next").onclick = () => {
    if (currentIndex < quiz.length - 1) {
      currentIndex++;
      showQuestion();
      updateOverview();
    }
  };

  document.getElementById("btn-prev").onclick = () => {
    if (currentIndex > 0) {
      currentIndex--;
      showQuestion();
      updateOverview();
    }
  };

  document.getElementById("btn-submit").onclick = submitQuiz;

  loadData();
});