// review.js (bản chuẩn – hoạt động 100%)

let questions = [];
let submissions = [];    // Toàn bộ danh sách trả về từ Google API
let filtered = [];       // Danh sách của lớp đã chọn (điểm >= 6)

const GOOGLE_API = "https://script.google.com/macros/s/AKfycbyAFbKjEZlA0RmAChAsHWirbeWAK7RwzBNYEAQb4O4tLytTOjoAevXlhDNA3ANtwDcN/exec";

document.addEventListener("DOMContentLoaded", () => {
    loadQuestions();
    loadApiData();

    document.getElementById("btn-view").onclick = showStudentResult;
});

// ----------------------------------------------------
// 1) Load API Google Sheet
// ----------------------------------------------------
async function loadApiData() {
    try {
        const res = await fetch(GOOGLE_API);
        submissions = await res.json();   // ⭐ API trả về MẢNG → đọc trực tiếp
        console.log("Loaded submissions:", submissions);

        loadClassList();

    } catch (err) {
        console.error(err);
        alert("❌ Không thể tải dữ liệu bài làm từ Google Sheet!");
    }
}

// ----------------------------------------------------
// 2) Tạo danh sách lớp từ submissions
// ----------------------------------------------------
function loadClassList() {
    const classes = [...new Set(submissions.map(s => s.lop))].sort();
    const selectClass = document.getElementById("select-class");

    selectClass.innerHTML =
        `<option value="">-- Chọn lớp --</option>` +
        classes.map(c => `<option value="${c}">${c}</option>`).join("");

    selectClass.onchange = () => loadStudentList(selectClass.value);
}

// ----------------------------------------------------
// 3) Lọc học sinh điểm >= 6 theo lớp
// ----------------------------------------------------
function loadStudentList(lop) {
    const select = document.getElementById("select-student");

    filtered = submissions.filter(s => s.lop == lop && s.score >= 6);

    if (filtered.length === 0) {
        select.innerHTML = `<option>-- Không có học sinh đủ 6 điểm --</option>`;
        return;
    }

    select.innerHTML =
        `<option value="">-- Chọn học sinh --</option>` +
        filtered
            .map(s => `<option value="${s.stt}">${s.stt} - ${s.ten} (Điểm: ${s.score})</option>`)
            .join("");
}

// ----------------------------------------------------
// 4) Load câu hỏi từ JSON gốc
// ----------------------------------------------------
async function loadQuestions() {
    const res = await fetch("data/questions.json");
    questions = await res.json();

    questions = questions.map((q, i) => ({
        ...q,
        id: q.id || "Q" + (i + 1)
    }));
}

// ----------------------------------------------------
// 5) Hiển thị chi tiết bài làm
// ----------------------------------------------------
function showStudentResult() {
    const className = document.getElementById("select-class").value;
    const stt = document.getElementById("select-student").value;

    if (!className || !stt) {
        alert("Vui lòng chọn lớp và học sinh!");
        return;
    }

    const student = filtered.find(s => String(s.stt) === String(stt));

    if (!student) {
        alert("❌ Không tìm thấy bài làm!");
        return;
    }

    // Parse details → danh sách câu sai
    let wrongDetails = {};
    try {
        wrongDetails = JSON.parse(student.details);
    } catch (err) {
        console.error("Lỗi parse details:", err);
    }

    let html = `
      <div class="result-box">
          <p>Học sinh: <b>${student.ten}</b> — Lớp ${className}</p>
          <p class="good">Điểm: ${student.score}</p>
          <h3>Các câu làm sai:</h3>
    `;

    // Nếu 0 câu sai
    if (Object.keys(wrongDetails).length === 0) {
        html += `<p class="good">🎉 Hoàn hảo! Không có câu nào sai.</p></div>`;
        document.getElementById("result-area").innerHTML = html;
        return;
    }

    // Hiển thị từng câu sai
    for (const qId in wrongDetails) {
        const q = questions.find(x => x.id == qId || xId == Number(qId));

        html += `
          <div class="question">
              <div class='label'>${q ? q.q : "Câu " + qId}</div>
              <div>Học sinh chọn: <span class="bad">${wrongDetails[qId]}</span></div>
          </div>
        `;
    }

    html += `</div>`;
    document.getElementById("result-area").innerHTML = html;
}
