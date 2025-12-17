// chiTiet.js - Tối ưu cho appKTCK.js và Google Sheets của bạn
let questionsBank = []; 
let submissions = [];
let filteredFirstTime = []; 

const GOOGLE_API = "https://script.google.com/macros/s/AKfycbyAFbKjEZlA0RmAChAsHWirbeWAK7RwzBNYEAQb4O4tLytTOjoAevXlhDNA3ANtwDcN/exec";

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Tải ngân hàng câu hỏi trước
    await loadQuestions(); 
    // 2. Tải dữ liệu từ Google Sheet
    loadApiData();
});

// Phẳng hóa dữ liệu câu hỏi từ cấu trúc [{cdA:[]}, {cdC:[]}, ...]
async function loadQuestions() {
    try {
        const res = await fetch("data/ontap7hk1_with_id.json");
        const data = await res.json();
        
        questionsBank = [];
        data.forEach(topicObj => {
            Object.values(topicObj).forEach(qList => {
                if (Array.isArray(qList)) {
                    questionsBank.push(...qList);
                }
            });
        });
        console.log("Ngân hàng câu hỏi sẵn sàng:", questionsBank.length);
    } catch (err) {
        console.error("Lỗi tải câu hỏi:", err);
    }
}

async function loadApiData() {
    try {
        const res = await fetch(GOOGLE_API);
        submissions = await res.json();
        loadClassList();
    } catch (err) {
        console.error(err);
        alert("❌ Lỗi kết nối API Google Sheets!");
    }
}

function loadClassList() {
    const select = document.getElementById("select-class");
    // Lấy danh sách lớp duy nhất
    const classes = [...new Set(submissions.map(s => s.lop))].sort();
    select.innerHTML = `<option value="">-- Chọn lớp --</option>` +
        classes.map(c => `<option value="${c}">${c}</option>`).join("");
    select.onchange = () => processClass(select.value);
}

function processClass(lop) {
    const tableArea = document.getElementById("result-area");
    if (!lop) return;
    
    tableArea.innerHTML = "<p>Đang xử lý dữ liệu lớp " + lop + "...</p>";
    
    // Lọc theo lớp và lấy bài làm lần đầu của mỗi học sinh (theo STT)
    const classSubs = submissions.filter(s => String(s.lop) === String(lop));
    const map = {};
    classSubs.forEach(s => {
        if (!map[s.stt]) map[s.stt] = [];
        map[s.stt].push(s);
    });

    filteredFirstTime = [];
    Object.keys(map).forEach(stt => {
        const list = map[stt];
        // Sắp xếp theo timestamp để lấy bài đầu tiên
        const first = list.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0];
        filteredFirstTime.push(first);
    });

    filteredFirstTime.sort((a, b) => Number(a.stt) - Number(b.stt));
    renderTable(filteredFirstTime, lop);
}

function renderTable(list, lop) {
    let html = `<h3>Kết quả lớp ${lop} (Nộp lần đầu)</h3>
        <table border="1" style="border-collapse: collapse; width:100%; background:white; text-align:left;">
            <tr style="background:#f2f2f2">
                <th style="padding:8px">STT</th>
                <th style="padding:8px">Họ và Tên</th>
                <th style="padding:8px">Điểm</th>
                <th style="padding:8px">Rời tab</th>
                <th style="padding:8px">Hành động</th>
            </tr>`;

    list.forEach(s => {
        html += `<tr>
            <td style="padding:8px">${s.stt}</td>
            <td style="padding:8px">${s.ten}</td>
            <td style="padding:8px; font-weight:bold; color:${s.score >= 5 ? 'green' : 'red'}">${s.score}</td>
            <td style="padding:8px">${s.focusCount || 0}</td>
            <td style="padding:8px"><button class="btn-detail" data-stt="${s.stt}">Xem câu sai</button></td>
        </tr>`;
    });
    html += "</table><div id='detail-box' style='margin-top:20px'></div>";
    document.getElementById("result-area").innerHTML = html;
    document.querySelectorAll(".btn-detail").forEach(btn => {
      btn.addEventListener("click", () => {
        const stt = btn.dataset.stt;
        showStudentDetail(stt);
      });
    });
}

function showStudentDetail(stt) {
    const student = filteredFirstTime.find(s => String(s.stt) === String(stt));
    const box = document.getElementById("detail-box");
    
    // Kiểm tra nếu không tìm thấy học sinh
    if (!student) return;

    let wrongList = [];
    try {
        // Thay đổi student.answers thành student.details để khớp với cột Google Sheet
        let rawData = student.details; 
        
        // Chuyển đổi chuỗi JSON sang mảng, đảm bảo trả về mảng rỗng nếu dữ liệu lỗi
        wrongList = typeof rawData === 'string' ? JSON.parse(rawData) : (rawData || []);
    } catch (e) { 
        console.error("Lỗi khi parse cột details:", e);
        wrongList = []; 
    }

    let html = `<div style="padding:15px; border:2px solid #ff4d4d; border-radius:8px; background:#fff;">
        <h4>Chi tiết câu sai: ${student.ten}</h4><hr>`;

    // Kiểm tra an toàn biến wrongList phải là mảng trước khi đọc .length
    if (!Array.isArray(wrongList) || wrongList.length === 0) {
        html += "<p style='color:green'>Học sinh này không sai câu nào hoặc dữ liệu chi tiết trống.</p>";
    } else {
        wrongList.forEach(item => {
            html += `<div style="margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;">
                <p><b>Câu:</b> ${item.question || "Không rõ nội dung"}</p>
                <p style="color:red"><b>HS chọn:</b> ${item.userAnswer || "Không trả lời"}</p>
                <p style="color:green"><b>Đáp án đúng:</b> ${item.correctAnswer || "Chưa cập nhật"}</p>
            </div>`;
        });
    }
    
    box.innerHTML = html;
    box.scrollIntoView({ behavior: "smooth" });
}
