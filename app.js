// ===============================
// CONFIG GOOGLE APPS SCRIPT URL
// ===============================
const GOOGLE_API =
  "https://script.google.com/macros/s/AKfycbyAFbKjEZlA0RmAChAsHWirbeWAK7RwzBNYEAQb4O4tLytTOjoAevXlhDNA3ANtwDcN/exec";

// ===============================
// BIẾN TRẠNG THÁI
// ===============================
let students = [];
let questions = [];
let selectedClass = "";
let selectedStudent = null;
let quiz = [];
let answers = {};
let submitted = false;

// ===============================
// HÀM LOAD DATA
// ===============================
async function loadData() {
  students = await fetch("./data/students.json").then((r) => r.json());
  questions = await fetch("./data/questions.json").then((r) => r.json());

  renderClassSelect();
}

loadData();

// ===============================
// TẠO DANH SÁCH LỚP
// ===============================
function renderClassSelect() {
  const classSelect = document.getElementById("classSelect");

  const classes = [...new Set(students.map((s) => s["LỚP"]))];

  classSelect.innerHTML = `<option value="">-- Chọn lớp --</option>`;

  classes.forEach((c) => {
    classSelect.innerHTML += `<option value="${c}">${c}</option>`;
  });
}

// ===============================
// KHI CHỌN LỚP → LỌC HỌC SINH
// ===============================
function onClassChange() {
  selectedClass = document.getElementById("classSelect").value;
  const studentSelect = document.getElementById("studentSelect");

  studentSelect.innerHTML = `<option value="">-- Chọn học sinh --</option>`;

  if (!selectedClass) return;

  const filtered = students.filter((s) => s["LỚP"] === selectedClass);

  filtered.forEach((s) => {
    studentSelect.innerHTML += `
      <option value="${s["STT"]}">${s["STT"]} - ${s["TÊN"]}</option>`;
  });
}

// ===============================
// KHI CHỌN HỌC SINH
// ===============================
function onStudentChange() {
  const stt = document.getElementById("studentSelect").value;
  selectedStudent = students.find((s) => String(s["STT"]) === stt);
}

// ===============================
// SHUFFLE UTILITY
// ===============================
function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

// ===============================
// LẤY 20 CÂU THEO TỈ LỆ NB–TH–VD
// ===============================
function pickQuestions() {
  const NB = questions.filter((q) => q.level === "NB");
  const TH = questions.filter((q) => q.level === "TH");
  const VD = questions.filter((q) => q.level === "VD");

  const pickNB = shuffle(NB).slice(0, 8);
  const pickTH = shuffle(TH).slice(0, 7);
  const pickVD = shuffle(VD).slice(0, 5);

  const final = shuffle([...pickNB, ...pickTH, ...pickVD]).map((q) => ({
    ...q,
    options: shuffle(q.options),
  }));

  return final;
}

// ===============================
// BẮT ĐẦU LÀM BÀI
// ===============================
function startQuiz() {
  if (!selectedStudent) return alert("Hãy chọn học sinh!");

  quiz = pickQuestions();
  answers = {};
  submitted = false;

  document.getElementById("startScreen").style.display = "none";
  document.getElementById("quizScreen").style.display = "block";

  renderQuiz();
}

// ===============================
// HIỂN THỊ CÂU HỎI
// ===============================
function renderQuiz() {
  const box = document.getElementById("quizBox");
  box.innerHTML = "";

  quiz.forEach((q, index) => {
    const selected = answers[q.id];

    let html = `
      <div class="question-block">
        <div class="q-title"><b>Câu ${index + 1}:</b> ${q.q}</div>
    `;

    q.options.forEach((opt) => {
      const isCorrect = submitted && opt.startsWith(q.correct);
      const isWrong =
        submitted && selected === opt && !opt.startsWith(q.correct);

      html += `
        <div class="option
            ${selected === opt ? "selected" : ""}
            ${isCorrect ? "correct" : ""}
            ${isWrong ? "wrong" : ""}"
            onclick="chooseAnswer(${q.id}, '${opt.replace(/'/g, "\\'")}')">
            ${opt}
        </div>`;
    });

    html += `</div>`;

    box.innerHTML += html;
  });

  document.getElementById("studentInfo").innerHTML =
    `<b>${selectedStudent["TÊN"]}</b> – Lớp <b>${selectedStudent["LỚP"]}</b>`;
}

// ===============================
// CHỌN ĐÁP ÁN
// ===============================
function chooseAnswer(qid, opt) {
  if (submitted) return;
  answers[qid] = opt;
  renderQuiz();
}

// ===============================
// NỘP BÀI
// ===============================
function submitQuiz() {
  if (Object.keys(answers).length < quiz.length) {
    if (!confirm("Bạn chưa trả lời hết. Bạn có chắc muốn nộp?")) return;
  }

  submitted = true;

  const correctCount = quiz.filter(
    (q) => answers[q.id] && answers[q.id].startsWith(q.correct)
  ).length;

  const result = {
    lop: selectedStudent["LỚP"],
    stt: selectedStudent["STT"],
    ten: selectedStudent["TÊN"],
    score: Math.round((correctCount / quiz.length) * 10),
    correctCount,
    total: quiz.length,
    timestamp: new Date().toLocaleString("vi-VN"),
  };

  sendToGoogle(result);
  renderQuiz();

  document.getElementById("submitBtn").style.display = "none";
  document.getElementById("doneMsg").innerHTML =
    "✔ Đã nộp bài! Kết quả đã gửi lên Google Sheet.";
}

// ===============================
// GỬI LÊN GOOGLE SHEET
// ===============================
async function sendToGoogle(data) {
  try {
    await fetch(GOOGLE_API, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    console.log("✔ Gửi Google Sheet thành công");
  } catch (e) {
    console.error("Lỗi gửi:", e);
  }
}
