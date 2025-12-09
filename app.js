/**
 * APP.JS - Phiên bản cập nhật tổng 10 câu hỏi
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

  // TẠO ĐỀ: Đã sửa để lấy tổng cộng 10 câu
  quiz = [
    // 5 NB (có 20 câu nên an toàn)
    ...shuffle(NB).slice(0, 5), 
    // 2 TH (chỉ có 2 câu nên lấy hết)
    ...shuffle(TH).slice(0, 2), 
    // 3 VD (có 4 câu nên lấy 3)
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
  document.getElementById(id).classList.add("active");
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
               onclick="selectAnswer('${q.id}', '${opt.replace(/'/g, "\\'")}')">
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

// Đảm bảo chạy code khi DOM đã sẵn sàng
document.addEventListener("DOMContentLoaded", () => {
  
  // Nút Bắt đầu
  const btnStart = document.getElementById("btn-start");
  if (btnStart) {
    btnStart.onclick = () => {
      if (!selectedStudent) return alert("Vui lòng chọn học sinh!");
      
      buildQuiz();
      
      // Hiển thị thông tin: Dùng key TEN và LƠP
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
    btnSubmit.onclick = () => {
      if (!confirm("Bạn chắc chắn muốn nộp bài? Kết quả sẽ được lưu lại.")) return;

      // Tính điểm
      let correctCount = 0;
      quiz.forEach(q => {
        if (answers[q.id] && answers[q.id].startsWith(q.correct)) {
          correctCount++;
        }
      });
      
      // Tính điểm trên thang 10
      const score = Math.round((correctCount / quiz.length) * 10); 

      // Gửi dữ liệu đi (mapping đúng key cho Google Sheet)
      const payload = {
        lop: selectedStudent.LƠP,
        stt: selectedStudent.STT,
        ten: selectedStudent.TEN,
        score: score,
        correctCount: correctCount,
        total: quiz.length,
        answers: answers
      };

      console.log("Đang gửi kết quả...", payload);

      // Gửi request
      fetch(GOOGLE_API, {
        method: "POST",
        mode: "no-cors", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(() => {
        console.log("Gửi thành công!");
      }).catch(err => console.error("Lỗi gửi:", err));

      // Hiển thị kết quả
      document.getElementById("result-info").innerHTML = 
        `Chúc mừng <b>${selectedStudent.TEN}</b><br>` +
        `Bạn đạt: <h1>${score} điểm</h1>` +
        `(${correctCount}/${quiz.length} câu đúng)`;

      showScreen("screen-result");
    };
  }

  // Window Global Functions (để gọi từ HTML onclick nếu cần)
  window.chooseAnswer = selectAnswer;
  window.jumpTo = jumpTo;

  // Cuối cùng: Gọi hàm tải dữ liệu
  loadData();
});
