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
  try {
    // Đảm bảo file json nằm đúng thư mục data
    students = await fetch("data/students.json").then(r => r.json());
    questions = await fetch("data/questions.json").then(r => r.json());
    loadClasses();
  } catch (error) {
    console.error("Lỗi tải dữ liệu:", error);
    alert("Không tải được dữ liệu. Vui lòng kiểm tra lại file students.json và questions.json");
  }
}
loadData();

function loadClasses() {
  const select = document.getElementById("select-class");
  
  // SỬA: s.Lop -> s.LƠP (theo file JSON)
  const classes = [...new Set(students.map(s => s.LƠP))];

  select.innerHTML = `<option value="">-- Chọn lớp --</option>` +
    classes.map(c => `<option value="${c}">${c}</option>`).join("");

  select.onchange = () => loadStudents(select.value);
}

function loadStudents(cls) {
  const select = document.getElementById("select-student");
  
  // SỬA: s.Lop -> s.LƠP
  const list = students.filter(s => s.LƠP === cls);

  select.innerHTML = `<option value="">-- Chọn học sinh --</option>` +
    // SỬA: s.Ten -> s.TEN
    list.map(s => `<option value="${s.STT}">${s.STT} - ${s.TEN}</option>`).join("");

  select.onchange = () => {
    selectedStudent = list.find(s => s.STT == select.value);
  };
}

// Shuffle - Trộn mảng
const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

// Pick 20 Qs NB–TH–VD
function buildQuiz() {
  const NB = questions.filter(q => q.level === "NB");
  const TH = questions.filter(q => q.level === "TH");
  const VD = questions.filter(q => q.level === "VD");

  // Nếu số lượng câu hỏi trong kho không đủ, code có thể bị lỗi ở bước slice
  // Bạn nên đảm bảo file questions.json có đủ số lượng câu hỏi
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
  
  // SỬA: Hiển thị tên và lớp đúng theo key trong JSON
  document.getElementById("student-info").innerHTML =
    `HS: <b>${selectedStudent.TEN}</b> – Lớp ${selectedStudent.LƠP}`;

  showScreen("screen-quiz");
};

// SHOW QUESTION
function showQuestion() {
  if (!quiz[currentIndex]) return; // Phòng trường hợp mảng quiz rỗng

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
    // SỬA: Lấy dữ liệu từ key viết hoa, gán vào key viết thường để gửi đi (nếu Google Script yêu cầu)
    lop: selectedStudent.LƠP,
    stt: selectedStudent.STT,
    ten: selectedStudent.TEN,
    score,
    correctCount,
    total: quiz.length,
    answers
  };

  // Gửi dữ liệu
  fetch(GOOGLE_API, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(resultPayload)
  })
  .then(() => {
     console.log("Đã gửi kết quả");
  })
  .catch(err => console.error("Lỗi gửi:", err));

  document.getElementById("result-info").innerHTML =
    `Điểm: <b>${score}</b> (${correctCount}/${quiz.length})`;

  showScreen("screen-result");
};
