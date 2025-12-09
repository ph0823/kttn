let students = [];
let questions = [];
let quiz = [];
let answers = {};
let currentIndex = 0;
let selectedStudent = null;

// Link Google Script (để gửi điểm)
const GOOGLE_API =
  "https://script.google.com/macros/s/AKfycbyAFbKjEZlA0RmAChAsHWirbeWAK7RwzBNYEAQb4O4tLytTOjoAevXlhDNA3ANtwDcN/exec";

// 1. Hàm tải dữ liệu
async function loadData() {
  try {
    // Tải file JSON
    students = await fetch("data/students.json").then(r => r.json());
    questions = await fetch("data/questions.json").then(r => r.json());
    
    // Sau khi tải xong thì mới tạo danh sách lớp
    loadClasses();
  } catch (error) {
    console.error("Lỗi tải dữ liệu:", error);
    alert("Không tìm thấy file dữ liệu (students.json hoặc questions.json). Hãy kiểm tra thư mục 'data'.");
  }
}

// 2. Hàm hiển thị danh sách lớp
function loadClasses() {
  const select = document.getElementById("select-class");
  
  // Kiểm tra an toàn: Nếu không tìm thấy thẻ select thì dừng ngay
  if (!select) return console.error("Không tìm thấy thẻ id='select-class'");

  // Lấy danh sách lớp (SỬA: s.LƠP viết hoa theo file json)
  const classes = [...new Set(students.map(s => s.LƠP))];

  select.innerHTML = `<option value="">-- Chọn lớp --</option>` +
    classes.map(c => `<option value="${c}">${c}</option>`).join("");

  // Khi chọn lớp thì tải danh sách học sinh tương ứng
  select.onchange = () => loadStudents(select.value);
}

// 3. Hàm hiển thị danh sách học sinh
function loadStudents(cls) {
  const select = document.getElementById("select-student");
  if (!select) return;

  // Lọc học sinh theo lớp (SỬA: s.LƠP)
  const list = students.filter(s => s.LƠP === cls);

  select.innerHTML = `<option value="">-- Chọn học sinh --</option>` +
    // (SỬA: s.TEN viết hoa và s.STT)
    list.map(s => `<option value="${s.STT}">${s.STT} - ${s.TEN}</option>`).join("");

  select.onchange = () => {
    // Tìm học sinh đã chọn
    selectedStudent = list.find(s => s.STT == select.value);
  };
}

// Hàm xáo trộn câu hỏi
const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

// 4. Tạo đề thi (20 câu: 8 NB, 7 TH, 5 VD)
function buildQuiz() {
  if (!questions || questions.length === 0) return alert("Chưa có dữ liệu câu hỏi!");

  const NB = questions.filter(q => q.level === "NB");
  const TH = questions.filter(q => q.level === "TH");
  const VD = questions.filter(q => q.level === "VD");

  quiz = [
    ...shuffle(NB).slice(0, 8),
    ...shuffle(TH).slice(0, 7),
    ...shuffle(VD).slice(0, 5),
  ];

  // Xáo trộn đáp án trong từng câu
  quiz = shuffle(quiz).map(q => ({
    ...q,
    options: shuffle(q.options)
  }));

  answers = {};
  currentIndex = 0;
  updateOverview();
  showQuestion();
}

// Chuyển màn hình
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// --- CÁC SỰ KIỆN NÚT BẤM ---

// Nút BẮT ĐẦU
const btnStart = document.getElementById("btn-start");
if (btnStart) {
  btnStart.onclick = () => {
    if (!selectedStudent) return alert("Vui lòng chọn học sinh trước!");

    buildQuiz();
    
    // Hiển thị thông tin HS đang làm bài (SỬA: .TEN và .LƠP)
    document.getElementById("student-info").innerHTML =
      `HS: <b>${selectedStudent.TEN}</b> – Lớp ${selectedStudent.LƠP}`;

    showScreen("screen-quiz");
  };
}

// Hiển thị câu hỏi hiện tại
function showQuestion() {
  if (!quiz[currentIndex]) return;
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

// Chọn đáp án
function chooseAnswer(id, opt) {
  answers[id] = opt;
  updateOverview();
  showQuestion();
}

// Cập nhật bảng tổng quan câu hỏi
function updateOverview() {
  const box = document.getElementById("overview");
  box.innerHTML = quiz
    .map((q, i) => {
      let cls = "over-btn";
      if (answers[q.id]) cls += " answered";
      if (currentIndex === i) cls += " active-q"; // Thêm class cho câu đang chọn
      return `<div class="${cls}" onclick="jumpTo(${i})">${i + 1}</div>`;
    })
    .join("");
}

function jumpTo(i) {
  currentIndex = i;
  showQuestion();
}

// Nút Tiếp / Trước
const btnNext = document.getElementById("btn-next");
const btnPrev = document.getElementById("btn-prev");

if (btnNext) btnNext.onclick = () => {
  if (currentIndex < quiz.length - 1) currentIndex++;
  showQuestion();
};

if (btnPrev) btnPrev.onclick = () => {
  if (currentIndex > 0) currentIndex--;
  showQuestion();
};

// Nút NỘP BÀI
const btnSubmit = document.getElementById("btn-submit");
if (btnSubmit) {
  btnSubmit.onclick = () => {
    if (!confirm("Bạn chắc chắn muốn nộp bài?")) return;

    // Tính điểm
    const correctCount = quiz.filter(
      q => answers[q.id] && answers[q.id].startsWith(q.correct)
    ).length;

    const score = Math.round((correctCount / quiz.length) * 10);

    // Chuẩn bị dữ liệu gửi đi (SỬA: .LƠP và .TEN)
    const resultPayload = {
      lop: selectedStudent.LƠP,
      stt: selectedStudent.STT,
      ten: selectedStudent.TEN,
      score,
      correctCount,
      total: quiz.length,
      answers
    };

    // Gửi sang Google Sheet
    fetch(GOOGLE_API, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(resultPayload)
    }).catch(err => console.log("Lỗi gửi điểm:", err));

    document.getElementById("result-info").innerHTML =
      `Điểm: <b>${score}</b> (${correctCount}/${quiz.length} câu đúng)`;

    showScreen("screen-result");
  };
}

// Window Global Functions (để gọi từ HTML onclick nếu cần)
window.chooseAnswer = chooseAnswer;
window.jumpTo = jumpTo;

// --- QUAN TRỌNG: CHẠY CODE KHI WEB ĐÃ TẢI XONG ---
document.addEventListener("DOMContentLoaded", () => {
  loadData();
});
