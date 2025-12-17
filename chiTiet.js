// chiTiet.js - Đã sửa để khớp với appKTCK.js
let questionsBank = []; // Lưu danh sách câu hỏi đã phẳng hóa
let submissions = [];
let filteredFirstTime = []; 

const GOOGLE_API = "https://script.google.com/macros/s/AKfycbyAFbKjEZlA0RmAChAsHWirbeWAK7RwzBNYEAQb4O4tLytTOjoAevXlhDNA3ANtwDcN/exec";

document.addEventListener("DOMContentLoaded", async () => {
    await loadQuestions(); // Đợi tải câu hỏi xong mới tải API
    loadApiData();
});

// Hàm chuẩn hóa để so sánh nội dung đáp án
function cleanAnswer(text) {
    if (!text) return "";
    // Loại bỏ phần "A. ", "B. " ở đầu để so sánh nội dung thuần
    return text.replace(/^[A-D]\.\s*/i, "").trim();
}

// 1. Tải và PHẲNG HÓA câu hỏi từ cấu trúc file JSON mới
async function loadQuestions() {
    try {
        const res = await fetch("data/ontap7hk1_with_id.json");
        const data = await res.json();
        
        // Chuyển cấu trúc [{cdA:[]}, {cdC:[]}] thành [q1, q2, q3...]
        questionsBank = [];
        data.forEach(topicObj => {
            Object.values(topicObj).forEach(qList => {
                if (Array.isArray(qList)) {
                    questionsBank.push(...qList);
                }
            });
        });
        console.log("Đã tải ngân hàng câu hỏi:", questionsBank.length);
    } catch (err) {
        console.error("Lỗi tải câu hỏi:", err);
    }
}

// 2. Tải dữ liệu từ Google Sheet
async function loadApiData() {
    try {
        const res = await fetch(GOOGLE_API);
        submissions = await res.json();
        loadClassList();
    } catch (err) {
        console.error(err);
        alert("❌ Không thể tải dữ liệu từ Google Sheet!");
    }
}

function loadClassList() {
    const select = document.getElementById("select-class");
    const classes = [...new Set(submissions.map(s => s.lop))].sort();
    select.innerHTML = `<option value="">-- Chọn lớp --</option>` +
        classes.map(c => `<option value="${c}">${c}</option>`).join("");
    select.onchange = () => processClass(select.value);
}

// 3. Xử lý lọc bài làm lần đầu
function processClass(lop) {
    const tableArea = document.getElementById("result-area");
    if (!lop) return;
    
    tableArea.innerHTML = "<p>Đang xử lý...</p>";
    const classSubs = submissions.filter(s => String(s.lop) === String(lop));

    const map = {};
    classSubs.forEach(s => {
        if (!map[s.stt]) map[s.stt] = [];
        map[s.stt].push(s);
    });

    filteredFirstTime = [];
    Object.keys(map).forEach(stt => {
        const list = map[stt];
        // Lấy bài nộp sớm nhất dựa trên timestamp
        const first = list.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0];
        filteredFirstTime.push(first);
    });

    filteredFirstTime.sort((a, b) => Number(a.stt) - Number(b.stt));
    renderTable(filteredFirstTime, lop);
}

function renderTable(list, lop) {
    let html = `<h3>Danh sách học sinh lớp ${lop} (Lần nộp đầu)</h3>
        <table border="1" style="border-collapse: collapse; width:100%; background:white;">
            <tr style="background:#eee">
                <th>STT</th><th>Tên</th><th>Điểm</th><th>Số câu đúng</th><th>Chi tiết</th>
            </tr>`;

    list.forEach(s => {
        html += `<tr>
            <td>${s.stt}</td>
            <td>${s.ten}</td>
            <td style="font-weight:bold">${s.score}</td>
            <td>${s.correctCount}/${s.total || 20}</td>
            <td><button onclick="showStudentDetail('${s.stt}')">Xem câu sai</button></td>
        </tr>`;
    });
    html += "</table><div id="detail-box"></div>";
    document.getElementById("result-area").innerHTML = html;
}

// 4. Hiển thị chi tiết (Sửa để khớp với field 'answers' từ appKTCK.js)
function showStudentDetail(stt) {
    const student = filteredFirstTime.find(s => String(s.stt) === String(stt));
    const box = document.getElementById("detail-box");
    if (!student) return;

    let userAnswers = {};
    try {
        // appKTCK.js gửi qua field 'answers', tùy vào Google Script bạn đặt tên cột là gì
        // Nếu script trả về 'answers', dùng student.answers. Nếu là 'details', dùng student.details
        userAnswers = typeof student.answers === 'string' ? JSON.parse(student.answers) : student.answers;
    } catch (e) { console.error("Lỗi parse đáp án"); }

    let html = `<div style="margin-top:20px; padding:15px; border:1px solid #007bff; border-radius:8px;">
        <h4>Chi tiết câu sai của: ${student.ten}</h4>`;

    let wrongCount = 0;
    
    // Lặp qua danh sách câu hỏi trong ngân hàng để kiểm tra bài làm
    // Vì appKTCK.js trộn câu hỏi, ta phải tìm câu hỏi theo ID
    questionsBank.forEach(q => {
        const studentChoice = userAnswers[q.id]; // Lấy đáp án HS chọn cho ID này
        if (!studentChoice) return;

        // Tìm nội dung đáp án đúng dựa vào label (0, 1, 2, 3)
        const correctLabel = ["A", "B", "C", "D"][q.correct];
        const correctText = q.options[q.correct];

        // So sánh: Lấy ký tự đầu (A/B/C/D) từ đáp án học sinh chọn
        const studentLabel = studentChoice.trim().charAt(0).toUpperCase();

        if (studentLabel !== correctLabel) {
            wrongCount++;
            html += `<div style="margin-bottom:10px; border-bottom:1px dashed #ccc; padding-bottom:5px;">
                <p><b>Câu ${q.id}:</b> ${q.q}</p>
                <p style="color:red">HS chọn: ${studentChoice}</p>
                <p style="color:green">Đáp án đúng: ${correctLabel}. ${correctText}</p>
            </div>`;
        }
    });

    if (wrongCount === 0) html += "<p>Học sinh này làm đúng hết!</p>";
    
    html += `</div>`;
    box.innerHTML = html;
    box.scrollIntoView({ behavior: "smooth" });
}