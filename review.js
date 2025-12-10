let students = [];
let questions = [];

// === API lấy dữ liệu bài thi đã nộp ===
// (Bạn giữ nguyên API đang dùng)
const GOOGLE_API = "https://script.google.com/macros/s/AKfycbyAFbKjEZlA0RmAChAsHWirbeWAK7RwzBNYEAQb4O4tLytTOjoAevXlhDNA3ANtwDcN/exec";

document.addEventListener("DOMContentLoaded", () => {
  loadStudents();
  loadQuestions();

  document.getElementById("btn-view").onclick = loadStudentResult;
});

// -------------------------------------------------------
// 1. Load dữ liệu học sinh
// -------------------------------------------------------
async function loadStudents() {
  const res = await fetch("data/students.json");
  students = await res.json();

  const selectClass = document.getElementById("select-class");
  const classes = [...new Set(students.map(s => s.LƠP))].sort();

  selectClass.innerHTML = `<option value="">-- Chọn lớp --</option>` +
    classes.map(c => `<option value="${c}">${c}</option>`).join("");

  selectClass.onchange = () => {
    loadStudentList(selectClass.value);
  };
}

function loadStudentList(className) {
  const select = document.getElementById("select-student");

  if (!className) {
    select.innerHTML = "";
    return;
  }

  const list = students.filter(s => s.LƠP == className);

  select.innerHTML = `<option value="">-- Chọn học sinh --</option>` +
    list.map(s => `<option value="${s.STT}">${s.STT} - ${s.TEN}</option>`).join("");
}

// -------------------------------------------------------
// 2. Load câu hỏi để so sánh đáp án sai
// -------------------------------------------------------
async function loadQuestions() {
  const res = await fetch("data/questions.json");
  questions = await res.json();

  // Chuẩn hoá ID
  questions = questions.map((q, i) => ({
    ...q,
    id: q.id || "Q" + (i + 1)
  }));
}

// -------------------------------------------------------
// 3. Lấy kết quả bài làm từ API Google Apps Script
// -------------------------------------------------------
async function loadStudentResult() {
  const className = document.getElementById("select-class").value;
  const stt = document.getElementById("select-student").value;

  if (!className || !stt) {
    alert("Vui lòng chọn lớp và học sinh!");
    return;
  }

  const student = students.find(s => s.STT == stt && s.LƠP == className);

  const url = `${GOOGLE_API}?lop=${className}&stt=${stt}`;

  let res = await fetch(url);
  let data = await res.json();

  if (!data || !data.answers) {
    document.getElementById("result-area").innerHTML =
      `<div class='result-box'>❌ Không tìm thấy bài làm của học sinh.</div>`;
    return;
  }

  // Nếu điểm < 6 → không xem được chi tiết
  if (data.score < 6) {
    document.getElementById("result-area").innerHTML =
      `<div class='result-box'>
         <p>Học sinh <b>${student.TEN}</b> (${className})</p>
         <p class='bad'>Điểm: ${data.score} — Không đủ điều kiện xem chi tiết.</p>
       </div>`;
    return;
  }

  showDetailResult(student, data);
}

// -------------------------------------------------------
// 4. Hiển thị chi tiết câu sai
// -------------------------------------------------------
function showDetailResult(student, data) {
  const area = document.getElementById("result-area");

  let html = `
    <div class="result-box">
      <p>Học sinh: <b>${student.TEN}</b> — Lớp ${student.LƠP}</p>
      <p class="good">Điểm: ${data.score}</p>
      <h3>Các câu làm sai:</h3>
  `;

  const wrongList = [];

  questions.forEach(q => {
    const userAnswer = data.answers[q.id];
    if (!userAnswer) return;

    const correctText = q.options.find(o => o.startsWith(q.correct));
    const userCorrect = userAnswer.startsWith(q.correct);

    if (!userCorrect) wrongList.push({ q, userAnswer, correctText });
  });

  if (wrongList.length === 0) {
    html += `<p class="good">🎉 Hoàn hảo! Không có câu nào sai.</p>`;
  } else {
    wrongList.forEach(item => {
      html += `
        <div class="question">
          <div class='label'>${item.q.q}</div>
          <div>Đáp án đúng: <span class="good">${item.correctText}</span></div>
          <div>Học sinh chọn: <span class="bad">${item.userAnswer}</span></div>
        </div>
      `;
    });
  }

  html += `</div>`;
  area.innerHTML = html;
}
