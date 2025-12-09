let students = [];
let questions = [];
let quiz = [];
let answers = {};
let currentIndex = 0;
let selectedStudent = null;

// Link Google Script
const GOOGLE_API =
  "https://script.google.com/macros/s/AKfycbyAFbKjEZlA0RmAChAsHWirbeWAK7RwzBNYEAQb4O4tLytTOjoAevXlhDNA3ANtwDcN/exec";

// Load data
async function loadData() {
  students = await fetch("data/students.json").then(r => r.json());
  questions = await fetch("data/questions.json").then(r => r.json());

  loadClasses();
}
loadData();

function loadClasses() {
  const select = document.getElementById("select-class");
  const classes = [...new Set(students.map(s => s.Lop))];

  select.innerHTML = `<option value="">-- Chọn lớp --</option>` +
    classes.map(c => `<option value="${c}">${c}</option>`).join("");

  select.onchange = () => loadStudents(select.value);
}

function loadStudents(cls) {
  const select = document.getElementById("select-student");
  const list = students.filter(s => s.Lop === cls);

  select.innerHTML = `<option value="">-- Chọn học sinh --</option>` +
    list.map(s => `<option value="${s.STT}">${s.STT} - ${s.Ten}</option>`).join("");

  select.onchange = () => {
    selectedStudent = list.find(s => s.STT == select.value);
  };
}

// Shuffle
const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

// Pick 20 Qs NB–TH–VD
function buildQuiz() {
  const NB = questions.filter(q => q.level === "NB");
  const TH = questions.filter(q => q.level === "TH");
  const VD = questions.filter(q => q.level === "VD");

  quiz = [
    ...shuffle(NB).slice(0, 8),
    ...shuffle(TH).slice(0, 7),
    ...shuffle(VD).slice(0, 5),
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

// UI switch
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// START
document.getElementById("btn-start").onclick = () => {
  if (!selectedStudent) return alert("Chưa chọn học sinh!");

  buildQuiz();
  document.getElementById("student-info").innerHTML =
    `HS: <b>${selectedStudent.Ten}</b> – Lớp ${selectedStudent.Lop}`;

  showScreen("screen-quiz");
};

// SHOW QUESTION
function showQuestion() {
  const q = quiz[currentIndex];
  const box = document.getElementById("question-box");

  box.innerHTML = `
      <h3>Câu ${currentIndex + 1}: ${q.q}</h3>
      ${q.options
        .map(opt => `
          <div class="option ${answers[q.id] === opt ? "selected" : ""}"
               onclick="chooseAnswer('${q.id}', '${opt.replace(/'/g, "\\'")}')">
            ${opt}
          </div>
        `)
        .join("")}
  `;
}

// Choose answer
function chooseAnswer(id, opt) {
  answers[id] = opt;
  updateOverview();
  showQuestion();
}

// Overview buttons (1–20)
function updateOverview() {
  const box = document.getElementById("overview");

  box.innerHTML = quiz
    .map((q, i) => {
      let cls = "over-btn";
      if (answers[q.id]) cls += " answered";
      return `<div class="${cls}" onclick="jumpTo(${i})">${i + 1}</div>`;
    })
    .join("");
}

function jumpTo(i) {
  currentIndex = i;
  showQuestion();
}

// NEXT / PREV
document.getElementById("btn-next").onclick = () => {
  if (currentIndex < quiz.length - 1) currentIndex++;
  showQuestion();
};
document.getElementById("btn-prev").onclick = () => {
  if (currentIndex > 0) currentIndex--;
  showQuestion();
};

// Submit
document.getElementById("btn-submit").onclick = () => {
  if (!confirm("Bạn chắc chắn muốn nộp bài?")) return;

  const correctCount = quiz.filter(
    q => answers[q.id] && answers[q.id].startsWith(q.correct)
  ).length;

  const score = Math.round((correctCount / quiz.length) * 10);

  const resultPayload = {
    lop: selectedStudent.Lop,
    stt: selectedStudent.STT,
    ten: selectedStudent.Ten,
    score,
    correctCount,
    total: quiz.length,
    answers
  };

  fetch(GOOGLE_API, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(resultPayload)
  });

  document.getElementById("result-info").innerHTML =
    `Điểm: <b>${score}</b> (${correctCount}/${quiz.length})`;

  showScreen("screen-result");
};
