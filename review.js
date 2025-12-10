// review.js (phiên bản đã fix: lọc lần nộp đầu tiên, sắp theo STT, hiển thị bảng)

let questions = [];
let submissions = [];
let filteredFirstTime = [];   // danh sách bài lần đầu theo lớp

const GOOGLE_API = "https://script.google.com/macros/s/AKfycbyAFbKjEZlA0RmAChAsHWirbeWAK7RwzBNYEAQb4O4tLytTOjoAevXlhDNA3ANtwDcN/exec";

document.addEventListener("DOMContentLoaded", () => {
    loadQuestions();
    loadApiData();
    document.getElementById("btn-view").onclick = showStudentResult;
});

// -------------------------------------------------------------
// 1) LOAD toàn bộ submissions từ Google Sheet
// -------------------------------------------------------------
async function loadApiData() {
    try {
        const res = await fetch(GOOGLE_API);
        submissions = await res.json();

        console.log("Dữ liệu tải từ Google Sheet:", submissions);

        loadClassList();

    } catch (err) {
        console.error(err);
        alert("❌ Không thể tải dữ liệu bài làm từ Google Sheet!");
    }
}

// -------------------------------------------------------------
// 2) Tạo danh sách lớp
// -------------------------------------------------------------
function loadClassList() {
    const select = document.getElementById("select-class");

    const classes = [...new Set(submissions.map(s => s.lop))].sort();

    select.innerHTML =
        `<option value="">-- Chọn lớp --</option>` +
        classes.map(c => `<option value="${c}">${c}</option>`).join("");

    select.onchange = () => processClass(select.value);
}

// -------------------------------------------------------------
// 3) Lọc bài LẦN ĐẦU theo học sinh
// -------------------------------------------------------------
function processClass(lop) {
    const tableArea = document.getElementById("result-area");
    tableArea.innerHTML = "<p>Đang xử lý...</p>";

    // Lấy tất cả bài của lớp
    const classSubs = submissions.filter(s => s.lop == lop);

    // Nhóm theo STT
    const map = {};
    classSubs.forEach(s => {
        const key = s.stt;
        if (!map[key]) map[key] = [];
        map[key].push(s);
    });

    // Lấy bài làm lần đầu (timestamp nhỏ nhất)
    filteredFirstTime = [];

    Object.keys(map).forEach(stt => {
        const list = map[stt];

        // Chọn bài có timestamp nhỏ nhất = lần nộp đầu
        const first = list.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0];

        // Chỉ giữ học sinh đủ 6 điểm
        if (first.score >= 6) {
            filteredFirstTime.push(first);
        }
    });

    // Sắp xếp theo STT
    filteredFirstTime.sort((a, b) => Number(a.stt) - Number(b.stt));

    // Hiển thị bảng
    renderTable(filteredFirstTime, lop);
}

// -------------------------------------------------------------
// 4) Render bảng danh sách học sinh đủ 6 điểm & lần đầu
// -------------------------------------------------------------
function renderTable(list, lop) {
    if (list.length === 0) {
        document.getElementById("result-area").innerHTML =
            `<p>❌ Không có học sinh nào làm bài lần đầu và đạt ≥ 6 điểm.</p>`;
        return;
    }

    let html = `
        <h3>Danh sách học sinh lớp ${lop} (lần nộp đầu, ≥ 6 điểm)</h3>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; background:white;">
            <tr style="background:#eee">
                <th>STT</th>
                <th>Tên học sinh</th>
                <th>Điểm</th>
                <th>Xem chi tiết</th>
            </tr>
    `;

    list.forEach(s => {
        html += `
            <tr>
                <td>${s.stt}</td>
                <td>${s.ten}</td>
                <td style="color:green;font-weight:bold">${s.score}</td>
                <td><button onclick="showStudentDetail('${s.stt}')">Xem</button></td>
            </tr>
        `;
    });

    html += "</table>";

    html += `<div id="detail-box"></div>`;

    document.getElementById("result-area").innerHTML = html;
}

// -------------------------------------------------------------
// 5) Hiển thị chi tiết bài làm học sinh
// -------------------------------------------------------------
function showStudentDetail(stt) {
    const student = filteredFirstTime.find(s => String(s.stt) === String(stt));
    const box = document.getElementById("detail-box");

    if (!student) {
        box.innerHTML = "<p>Không tìm thấy bài làm.</p>";
        return;
    }

    // Parse danh sách câu sai
    let wrong = {};
    try {
        wrong = JSON.parse(student.details);
    } catch (e) {
        wrong = {};
    }

    let html = `
        <div style="margin-top:20px; padding:15px; background:white; border-radius:10px; box-shadow:0 0 5px #bbb">
            <h3>Chi tiết bài làm của <span style="color:#007bff">${student.ten}</span></h3>
            <p>Điểm: <b style="color:green">${student.score}</b></p>
            <h4 style="margin-top:15px">Các câu sai:</h4>
    `;

    // Nếu không có câu sai
    if (Object.keys(wrong).length === 0) {
        html += `<p style="color:green; font-weight:bold">🎉 Không sai câu nào.</p></div>`;
        box.innerHTML = html;
        return;
    }

    // Duyệt từng câu sai
    Object.keys(wrong).forEach(qId => {

        // Tìm câu hỏi gốc theo id
        const q = questions.find(x => x.id == qId || String(x.id) == String(qId));

        // Lấy đáp án đúng
        let correctAnswer = "";
        if (q && q.options && q.correct) {
            correctAnswer = q.options.find(opt => opt.startsWith(q.correct + ".")) || "";
        }

        html += `
            <div style="margin-top:15px; padding:12px; 
                        border:1px solid #ccc; border-left:6px solid #d9534f; 
                        border-radius:5px; background:#fafafa">

                <div style="font-size:16px; font-weight:bold; margin-bottom:6px">
                    Câu ${qId}: ${q ? q.q : "(Không tìm thấy nội dung câu hỏi)"}
                </div>

                <div style="margin:6px 0">
                    <b>Đáp án đúng:</b> 
                    <span style="color:green">${correctAnswer}</span>
                </div>

                <div>
                    <b>HS chọn:</b> 
                    <span style="color:#d9534f; font-weight:bold">${wrong[qId]}</span>
                </div>

            </div>
        `;
    });

    html += `</div>`;
    box.innerHTML = html;
}




// -------------------------------------------------------------
// 6) Load câu hỏi (nếu bạn muốn hiển thị câu hỏi gốc sau này)
// -------------------------------------------------------------
async function loadQuestions() {
    const res = await fetch("data/questions.json");
    questions = await res.json();
}
