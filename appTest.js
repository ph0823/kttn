/**
 * appTest.JS - Phiên bản tối ưu (V2.0)
 * - Đã sửa lỗi nháy màn hình khi chọn đáp án
 * - Sửa lỗi tính điểm (Bỏ điểm sàn 5)
 * - Thêm validate dữ liệu đầu vào
 */

let students = [];
let questions = [];
let quiz = [];
let answers = {}; // Lưu đáp án dưới dạng: { "Q1": "Nội dung đáp án chọn" }
let currentIndex = 0;
let selectedStudent = null;
let timeLeft = 600;     // 10 phút = 600 giây
let timerInterval = null;

// Cấu hình
const MIN_SCORE = 5; // Điểm thấp nhất là 5
const GOOGLE_API = "https://script.google.com/macros/s/AKfycbyAFbKjEZlA0RmAChAsHWirbeWAK7RwzBNYEAQb4O4tLytTOjoAevXlhDNA3ANtwDcN/exec";

// ------------ 1. LOAD DATA ---------------
async function loadData() {
  try {
    const studentRes = await fetch("data/students.json");
    if (!studentRes.ok) throw new Error("Không tìm thấy file students.json");
    students = await studentRes.json();

    const questionRes = await fetch("data/questions.json");
    if (!questionRes.ok) throw new Error("Không tìm thấy file questions.json");
    questions = await questionRes.json();

    // 🟢 Chuẩn hóa dữ liệu: Tạo id nếu thiếu
    questions = questions.map((q, i) => ({
      ...q,
      id: q.id || "Q" + (i + 1)
    }));

    loadClasses();
    console.log("Đã tải dữ liệu thành công!");
  } catch (err) {
    alert("Lỗi tải dữ liệu: " + err.message);
    console.error(err);
  }
}

// ------------ 2. LOAD CLASSES / STUDENTS ---------------
function loadClasses() {
  const select = document.getElementById("select-class");
  // Lấy danh sách lớp duy nhất và sắp xếp
  const classes = [...new Set(students.map(s => s.LƠP))].sort();

  select.innerHTML = `<option value="">-- Chọn lớp --</option>` +
    classes.map(c => `<option value="${c}">${c}</option>`).join("");

  select.onchange = () => {
    selectedStudent = null;
    loadStudents(select.value);
  };
}

function loadStudents(className) {
  const select = document.getElementById("select-student");
  if (!className) {
    select.innerHTML = "";
    return;
  }
  
  const list = students.filter(s => s.LƠP == className);

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

  // Kiểm tra dữ liệu
  let selectedQuestions = [];
  if (NB.length < 5 || TH.length < 2 || VD.length < 3) {
    alert("Cảnh báo: Kho câu hỏi không đủ cấu trúc (5 NB, 2 TH, 3 VD). Lấy ngẫu nhiên 10 câu.");
    selectedQuestions = shuffle(questions).slice(0, 10);
  } else {
    selectedQuestions = [
      ...shuffle(NB).slice(0, 5),
      ...shuffle(TH).slice(0, 2),
      ...shuffle(VD).slice(0, 3),
    ];
  }

  // Xử lý xáo trộn đáp án nhưng giữ nguyên A, B, C, D
  const LABELS = ["A", "B", "C", "D", "E", "F"]; // Hỗ trợ tối đa 6 đáp án

  quiz = shuffle(selectedQuestions).map(q => {
    // 1. Tách lấy nội dung text (bỏ "A. ", "B. "...)
    // Giả định options trong JSON luôn theo thứ tự A, B, C, D tương ứng index 0, 1, 2, 3
    const rawContents = q.options.map(opt => {
      // Cắt chuỗi từ sau dấu chấm đầu tiên và xóa khoảng trắng thừa
      const dotIndex = opt.indexOf('.');
      return dotIndex > -1 ? opt.substring(dotIndex + 1).trim() : opt;
    });

    // 2. Xác định nội dung của đáp án đúng gốc
    // Ví dụ: q.correct = "C" -> index 2 -> Lấy nội dung tại rawContents[2]
    const oldCorrectIndex = LABELS.indexOf(q.correct);
    const correctContentText = rawContents[oldCorrectIndex];

    // 3. Xáo trộn nội dung
    const shuffledContents = shuffle([...rawContents]);

    // 4. Gán lại tiền tố A, B, C, D cho nội dung đã trộn
    const newOptions = shuffledContents.map((content, idx) => {
      return `${LABELS[idx]}. ${content}`;
    });

    // 5. Tìm xem nội dung đúng bây giờ đang nằm ở đâu để cập nhật đáp án chấm điểm
    const newCorrectIndex = shuffledContents.indexOf(correctContentText);
    const newCorrectLabel = LABELS[newCorrectIndex];

    return {
      ...q,
      options: newOptions,      // Bộ đáp án mới (A. [Nội dung lạ], B. [Nội dung lạ]...)
      correct: newCorrectLabel  // Đáp án đúng mới (để máy chấm điểm chính xác)
    };
  });

  answers = {};
  currentIndex = 0;

  // Render khung nhìn tổng quan
  renderOverview();
  // Render câu hỏi đầu tiên
  showQuestion();
}

// ------------ 4. RENDER QUESTION (Đã tối ưu) ---------------
function showQuestion() {
  const q = quiz[currentIndex];
  const box = document.getElementById("question-box");

  // Render HTML câu hỏi
  box.innerHTML = `
    <h3>Câu ${currentIndex + 1}: ${q.q}</h3>
    <div class="options-grid">
      ${q.options.map(opt => `
        <div class="option ${answers[q.id] === opt ? "selected" : ""}" 
             data-id="${q.id}" 
             data-val="${encodeURIComponent(opt)}">
          ${opt}
        </div>
      `).join("")}
    </div>
  `;

  // Gán sự kiện Click (Sử dụng DOM để không render lại toàn bộ)
  const optionsElements = box.querySelectorAll(".option");
  optionsElements.forEach(el => {
    el.onclick = () => {
      const id = el.dataset.id;
      const val = decodeURIComponent(el.dataset.val);

      // 1. Lưu đáp án
      answers[id] = val;

      // 2. Cập nhật giao diện (CSS) trực tiếp
      optionsElements.forEach(opt => opt.classList.remove("selected"));
      el.classList.add("selected");

      // 3. Cập nhật thanh Overview bên dưới
      updateOverviewStatus();
    };
  });
  
  // Cập nhật trạng thái active của nút trên thanh overview
  updateOverviewStatus();
}

// ------------ 5. OVERVIEW NAVIGATION ---------------
function renderOverview() {
  const box = document.getElementById("overview");
  box.innerHTML = quiz.map((q, i) => `
    <div class="over-btn" id="ov-btn-${i}" onclick="jumpTo(${i})">
      ${i + 1}
    </div>
  `).join("");
}

function updateOverviewStatus() {
  quiz.forEach((q, i) => {
    const btn = document.getElementById(`ov-btn-${i}`);
    if (!btn) return;

    // Reset class
    btn.className = "over-btn";
    
    // Nếu là câu đang xem
    if (i === currentIndex) btn.classList.add("current");
    
    // Nếu đã trả lời
    if (answers[q.id]) btn.classList.add("answered");
  });
}

window.jumpTo = i => {
  currentIndex = i;
  showQuestion();
};


// ------------ 6. SUBMIT (Đã cập nhật bảo mật điểm) ---------------
async function submitQuiz(auto = false) {

  // ❗ Kiểm tra làm đủ câu
  if (!auto) {
    const total = quiz.length;
    const answered = Object.keys(answers).length;

    if (answered < total) {
      alert(`Bạn còn ${total - answered} câu chưa làm. Vui lòng hoàn thành trước khi nộp bài!`);
      return;
    }
  }

  // Xác nhận khi không phải auto-submit
  if (!auto) {
    if (!confirm("Bạn chắc chắn muốn nộp bài?")) return;
  }

  clearInterval(timerInterval);  // Dừng đồng hồ

  const btnSubmit = document.getElementById("btn-submit");
  btnSubmit.disabled = true;
  btnSubmit.innerText = "Đang nộp...";

  let correctCount = 0;

  quiz.forEach(q => {
    const userAnswer = answers[q.id];
    if (userAnswer && (userAnswer === q.correct || userAnswer.startsWith(q.correct + "."))) {
      correctCount++;
    }
  });

  let score = Math.round((correctCount / quiz.length) * 1000) / 100;
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

  // Giao diện sau khi nộp
  document.getElementById("result-info").innerHTML = `
    <div style="text-align:center; padding:10px">
      <h2 style="color:#28a745">✅ Nộp bài thành công!</h2>
      <p>Bạn <b>${selectedStudent.TEN}</b> - Lớp ${selectedStudent.LƠP}</p>
      <p style="color:#666; font-style:italic">Kết quả đã được ghi nhận.</p>
    </div>
  `;

  showScreen("screen-result");

  btnSubmit.disabled = false;
  btnSubmit.innerText = "NỘP BÀI";
}



// ------------ 7. CHANGE SCREEN ---------------
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ------------ 8. TIMER ---------------
function startTimer() {
  const box = document.getElementById("timer-box");

  timerInterval = setInterval(() => {
    timeLeft--;

    // xử lý định dạng mm:ss
    let m = Math.floor(timeLeft / 60);
    let s = timeLeft % 60;
    box.innerText = `${m}:${s < 10 ? "0" + s : s}`;

    // Hết giờ → tự động nộp bài
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      alert("⏰ Đã hết thời gian! Hệ thống sẽ tự động nộp bài.");
      submitQuiz(true); // true = auto submit
    }

  }, 1000);
}

// ------------ 9. BUTTON EVENTS ---------------
document.addEventListener("DOMContentLoaded", () => {
  
  // Nút Bắt đầu
  document.getElementById("btn-start").onclick = () => {
    if (!selectedStudent) {
      alert("Vui lòng chọn học sinh trước khi bắt đầu!");
      return;
    }
    
    document.getElementById("student-info").innerHTML =
      `Học sinh: <b>${selectedStudent.TEN}</b> - Lớp: ${selectedStudent.LƠP}`;

    buildQuiz();
    showScreen("screen-quiz");

    // 🟢 BẮT ĐẦU ĐỒNG HỒ
    timeLeft = 600;
    startTimer();
  };

  // Nút Next / Prev
  document.getElementById("btn-next").onclick = () => {
    if (currentIndex < quiz.length - 1) {
      currentIndex++;
      showQuestion();
    }
  };

  document.getElementById("btn-prev").onclick = () => {
    if (currentIndex > 0) {
      currentIndex--;
      showQuestion();
    }
  };

  // Nút Nộp bài
  document.getElementById("btn-submit").onclick = submitQuiz;

  // Khởi chạy
  loadData();
});
