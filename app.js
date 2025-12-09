/**
 * APP.JS - Phiên bản cập nhật (ẩn điểm, điểm tối thiểu = 5)
 * Phân bổ: 5 NB, 2 TH, 3 VD
 */

let students = [];
let questions = [];
let quiz = [];
let answers = {};
let currentIndex = 0;
let selectedStudent = null;

// Link Google Script (Giữ nguyên link của bạn)
const GOOGLE_API = "https://script.google.com/macros/s/AKfycbyAFbKjEZlA0RmAChAsHWirbeWAK7RwzBNYEAQb4O4tLytTOjoAevXlhDNA3ANtwDcN/exec";

// Tùy biến
const MIN_SCORE = 5; // điểm tối thiểu

// --- 1. HÀM TẢI DỮ LIỆU ---
async function loadData() {
  try {
    // Tải dữ liệu học sinh
    const studentRes = await fetch("data/students.json");
    students = await studentRes.json();
    
    // Tải dữ liệu câu hỏi
    const questionRes = await fetch("data/questions.json");
    questions = await questionRes.json();

    console.log(`Đã tải: ${students.length} học sinh và ${questions.length} câu hỏi.`);
    
    // Sau khi tải xong thì mới tạo danh sách lớp
    loadClasses();
    
  } catch (error) {
    console.error("Lỗi tải dữ liệu:", error);
    alert("Lỗi: Không thể tải file data/students.json hoặc data/questions.json. Hãy kiểm tra thư mục.");
  }
}

// --- 2. HÀM XỬ LÝ DROPDOWN ---
function loadClasses() {
  const select = document.getElementById("select-class");
  if (!select) return;

  // Lấy danh sách lớp duy nhất từ cột "LƠP" (theo file json bạn gửi)
  const classes = [...new Set(students.map(s => s.LƠP))];

  // Sắp xếp lớp
  classes.sort();

  select.innerHTML = `<option value="">-- Chọn lớp --</option>` +
    classes.map(c => `<option value="${c}">${c}</option>`).join("");

  // Khi chọn lớp -> nạp danh sách học sinh
  select.onchange = () => loadStudents(select.value);
}

function loadStudents(className) {
  const select = document.getElementById("select-student");
  if (!select) return;

  // Lọc học sinh theo lớp, khớp cột "LƠP"
  const list = students.filter(s => s.LƠP === className);

  select.innerHTML = `<option value="">-- Chọn học sinh --</option>` +
    list.map(s => `<option value="${s.STT}">${s.STT} - ${s.TEN}</option>`).join("");

  select.onchange = () => {
    // Tìm đối tượng học sinh dựa vào STT và Lớp để chính xác nhất
    selectedStudent = list.find(s => s.STT == select.value);
  };
}

// --- 3. HÀM XỬ LÝ ĐỀ THI ---
const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

function buildQuiz() {
  if (!questions || questions.length === 0) return alert("Chưa có dữ liệu câu hỏi!");

  // Phân loại câu hỏi
  const NB = questions.filter(q => q.level === "NB");
  const TH = questions.filter(q => q.level === "TH");
  const VD = questions.filter(q => q.level === "VD");

  // TẠO ĐỀ: tổng 10 câu như yêu cầu
  quiz = [
    ...shuffle(NB).slice(0, 5),
    ...shuffle(TH).slice(0, 2),
    ...shuffle(VD).slice(0, 3),
  ];

  // Xáo trộn đáp án từng câu
  quiz = shuffle(quiz).map(q => ({
    ...q,
    options: shuffle(q.options)
  }));

  answers = {};
  currentIndex = 0;
  updateOverview();
  showQuestion();
}

// --- 4. HÀM GIAO DIỆN (UI) ---
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

function showQuestion() {
  if (!quiz[currentIndex]) return;
  
  const q = quiz[currentIndex];
  const box = document.getElementById("question-box");

  box.innerHTML = `
      <h3>Câu ${currentIndex + 1}: ${q.q}</h3>
      <div class="options-grid">
        ${q.options.map(opt => `
          <div class="option ${answers[q.id] === opt ? "selected" : ""}"
               onclick="selectAnswer('${q.id}', ${JSON.stringify(opt)})">
            ${opt}
          </div>
        `).join("")}
      </div>
  `;
}

// Hàm được gọi từ HTML (window scope)
window.selectAnswer = (id, opt) => {
  answers[id] = opt;
  updateOverview();
  showQuestion(); // Render lại để thấy hiệu ứng chọn
};

function updateOverview() {
  const box = document.getElementById("overview");
  if (!box) return;

  box.innerHTML = quiz.map((q, i) => {
    let cls = "over-btn";
    if (answers[q.id]) cls += " answered"; // Đã làm
    if (currentIndex === i) cls += " current"; // Đang xem
    return `<div class="${cls}" onclick="jumpTo(${i})">${i + 1}</div>`;
  }).join("");
}

window.jumpTo = (i) => {
  currentIndex = i;
  showQuestion();
  updateOverview();
};

// --- 5. SỰ KIỆN CÁC NÚT BẤM ---
document.addEventListener("DOMContentLoaded", () => {
  
  // Nút Bắt đầu
  const btnStart = document.getElementById("btn-start");
  if (btnStart) {
    btnStart.onclick = () => {
      if (!selectedStudent) return alert("Vui lòng chọn học sinh!");
      
      buildQuiz();
      
      // Hiển thị thông tin học sinh (chỉ tên và lớp)
      document.getElementById("student-info").innerHTML = 
        `Học sinh: <b>${selectedStudent.TEN}</b> - Lớp: ${selectedStudent.LƠP}`;
        
      showScreen("screen-quiz");
    };
  }

  // Nút Next
  const btnNext = document.getElementById("btn-next");
  if (btnNext) {
    btnNext.onclick = () => {
      if (currentIndex < quiz.length - 1) {
        currentIndex++;
        showQuestion();
        updateOverview();
      }
    };
  }

  // Nút Prev
  const btnPrev = document.getElementById("btn-prev");
  if (btnPrev) {
    btnPrev.onclick = () => {
      if (currentIndex > 0) {
        currentIndex--;
        showQuestion();
        updateOverview();
      }
    };
  }

  // Nút Nộp bài
  const btnSubmit = document.getElementById("btn-submit");
  if (btnSubmit) {
    btnSubmit.onclick = async () => {
      if (!confirm("Bạn chắc chắn muốn nộp bài? Kết quả sẽ được lưu lại.")) return;

      // Tính số câu đúng (lưu nội bộ)
      let correctCount = 0;
      quiz.forEach(q => {
        // giữ nguyên cách so sánh hiện có (ví dụ: đáp án bắt đầu bằng ký tự đúng)
        if (answers[q.id] && answers[q.id].startsWith(q.correct)) {
          correctCount++;
        }
      });
      
      // Tính điểm trên thang 10
      let score = Math.round((correctCount / quiz.length) * 10);

      // Áp điểm tối thiểu
      if (score < MIN_SCORE) score = MIN_SCORE;

      // Gửi dữ liệu đi (mapping đúng key cho Google Sheet)
      const payload = {
        lop: selectedStudent.LƠP,
        stt: selectedStudent.STT,
        ten: selectedStudent.TEN,
        score: score,               // vẫn gửi cho server
        correctCount: correctCount, // vẫn gửi cho server
        total: quiz.length,
        answers: answers,
        timestamp: new Date().toISOString()
      };

      // Gửi request (no-cors nếu apps script không trả CORS headers)
      try {
        await fetch(GOOGLE_API, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        // Nếu no-cors, fetch có thể ném lỗi; tuy nhiên dữ liệu vẫn có thể tới server.
        console.debug("Lỗi khi gửi (không ảnh hưởng đến UX):", err);
      }

      // KHÔNG hiển thị điểm hay kết quả cho học sinh.
      // Chỉ hiển thị thông báo trung tính:
      const resultBox = document.getElementById("result-info");
      if (resultBox) {
        resultBox.innerHTML = `<p><strong>Bài nộp thành công</strong></p>`;
      }

      showScreen("screen-result");
    };
  }

  // Window Global Functions (để gọi từ HTML onclick nếu cần)
  window.chooseAnswer = selectAnswer;
  window.jumpTo = jumpTo;

  // Cuối cùng: Gọi hàm tải dữ liệu
  loadData();
});
