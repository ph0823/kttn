// ========================
// CONFIG
// ========================
const GOOGLE_API =
  "https://script.google.com/macros/s/AKfycbyAFbKjEZlA0RmAChAsHWirbeWAK7RwzBNYEAQb4O4tLytTOjoAevXlhDNA3ANtwDcN/exec";

// ========================
// GLOBAL STATE
// ========================
let students = [];
let questions = [];
let filteredStudents = [];
let selectedClass = "";
let selectedStudent = null;
let quiz = [];
let answers = {};
let submitted = false;

// ========================
// LOAD DATA
// ========================
async function loadData() {
  const s = await fetch("data/students.json").then((r) => r.json());
  const q = await fetch("data/questions.json").then((r) => r.json());

  students = s;
  questions = q;

  renderClassList();
}

loadData();

// ========================
// RENDER CLASS LIST
// ========================
function renderClassList() {
  const classSelect = document.getElementById("selectClass");
  const uniqueClasses = [...new Set(students.map((s) => s["LỚP"]))];

  classSelect.innerHTML = `<option value="">-- Chọn lớp --</option>`;

  uniqueClasses.forEach((lop) => {
    classSelect.innerHTML += `<option value="${lop}">${lop}</option>`;
  });
}

// ========================
// WHEN CLASS IS SELECTED
// ========================
function onClassChange() {
  selectedClass = document.getElementById("selectClass").value;

  const studentSelect = document.getElementById("selectStudent");
  studentSelect.innerHTML = `<option value="">-- Chọn học sinh --</option>`;

  if (selectedClass === "") return;

  filteredStudents = students.filter((s) => s["LỚP"] === selectedClass);

  filteredStudents.forEach((s) => {
    studentSelect.innerHTML += `<option value="${s.STT}">${s.STT} - ${s["TÊN"]}</option>`;
  });
}

// ========================
// WHEN STUDENT SELECTED
// ========================
function onStudentChange() {
  const stt = document.getElementById("selectStudent").value;
  selectedStudent = filteredStudents.find((s) => String(s.STT) === stt);
}

// ========================
// SHUFFLE ARRAY
// ========================
function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

// ========================
// PICK 20 QUESTIONS NB–TH–VD
// ========================
function pickQuestions() {
  const NB = questions.filter((q) => q.level === "NB");
  const TH = questions.filter((q) => q.level === "TH");
  const VD = questions.filter((q) => q.level === "VD");

  const pickNB = shuffle(NB).slice(0, 8);
  const pickTH = shuffle(TH).slice(0, 7);
  const pickVD = shuffle(VD).slice(0, 5);

  let final = [...pickNB, ...pickTH, ...pickVD];

  final = shuffle(final).map((q) => ({
    ...q,
    options: shuffle(q.options),
  }));

  quiz = final;
}

// ========================
// START QUIZ
// ========================
function startQuiz() {
  if (!selectedStudent) {
    alert("Hãy chọn học sinh!");
    return;
  }

  pickQuestions();
  answers = {};
  submitted = false;

  document.getElementById("startScreen").style.display = "none";
  document.getElementById("quizScreen").style.display = "block";

  renderQuiz();
}

// ========================
// RENDER QUIZ
// ========================
function renderQuiz() {
  const container = document.getElementById("quizContainer");
  container.innerHTML = "";

  quiz.forEach((q, idx) => {
    let html = `<div class="question-card">
      <div class="question-title"><b>Câu ${idx + 1}:</b> ${q.q}</div>
      <div class="options">`;

    q.options.forEach((opt) => {
      const selected = answers[q.id] === opt;
      const isCorrect = submitted && opt.startsWith(q.correct);
      const isWrong = submitted && selected && !isCorrect;

      html += `
        <div class="option ${selected ? "selected" : ""} 
                        ${isCorrect ? "correct" : ""} 
                        ${isWrong ? "wrong" : ""}"
             onclick="chooseAnswer('${q.id}', '${opt}')">
            ${opt}
        </div>`;
    });

    html += `</div></div>`;
    container.innerHTML += html;
  });
}

// ========================
// CHOOSE ANSWER
// ========================
function chooseAnswer(qid, opt) {
  if (submitted) return;
  answers[qid] = opt;
  renderQuiz();
}

// ========================
// SUBMIT QUIZ
// ========================
function submitQuiz() {
  if (Object.keys(answers).length < 20) {
    if (!confirm("Bạn chưa trả lời đủ 20 câu. Nộp luôn?")) return;
  }

  submitted = true;

  const correct = quiz.filter(
    (q) => answers[q.id] && answers[q.id].startsWith(q.correct)
  ).length;

  const result = {
    khoi: selectedStudent["Khối"],
    lop: selectedStudent["LỚP"],
    stt: selectedStudent["STT"],
    ten: selectedStudent["TÊN"],
    totalQuestions: quiz.length,
    correct,
    score: Math.round((correct / quiz.length) * 10),
    timestamp: new Date().toLocaleString("vi-VN"),
    answers,
  };

  sendToGoogle(result);
  renderQuiz();

  document.getElementById("submitBtn").style.display = "none";
  document.getElementById("submittedMsg").style.display = "block";
}

// ========================
// SEND RESULT TO GOOGLE SHEET
// ========================
async function sendToGoogle(data) {
  try {
    await fetch(GOOGLE_API, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
  } catch (e) {
    console.error("Lỗi gửi Google Sheet:", e);
  }
}
