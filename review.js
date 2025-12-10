// review.js (Cập nhật) - Lấy danh sách học sinh có điểm >= 6 trực tiếp từ Google Sheet

let students = [];         // dữ liệu gốc từ data/students.json (dùng để hiển thị tên, lớp nếu cần)
let questions = [];        // dữ liệu câu hỏi (để show chi tiết)
let eligibleCache = {};    // cache: { "<LOP>": [ submissionObj, ... ] }

// Thay giá trị này bằng API bạn đang dùng (giữ nguyên nếu đã đúng)
const GOOGLE_API = "https://script.google.com/macros/s/AKfycbyAFbKjEZlA0RmAChAsHWirbeWAK7RwzBNYEAQb4O4tLytTOjoAevXlhDNA3ANtwDcN/exec";

document.addEventListener("DOMContentLoaded", () => {
  loadStudents();    // dùng để có danh sách lớp (chỉ cần lớp)
  loadQuestions();   // dùng để so sánh đáp án khi show chi tiết
  document.getElementById("btn-view").onclick = loadStudentResult;
});

// -------------------- 1) Load danh sách lớp từ data/students.json --------------------
async function loadStudents() {
  try {
    const res = await fetch("data/students.json");
    if (!res.ok) throw new Error("Không đọc được data/students.json");
    students = await res.json();

    const selectClass = document.getElementById("select-class");
    const classes = [...new Set(students.map(s => s.LƠP))].sort();

    selectClass.innerHTML = `<option value="">-- Chọn lớp --</option>` +
      classes.map(c => `<option value="${c}">${c}</option>`).join("");

    selectClass.onchange = async () => {
      const lop = selectClass.value;
      // Khi chọn lớp: lấy danh sách học sinh đã nộp và có điểm >= 6 từ Google Sheet
      if (lop) {
        await populateEligibleStudentsForClass(lop);
      } else {
        document.getElementById("select-student").innerHTML = "";
      }
    };
  } catch (err) {
    console.error(err);
    alert("Lỗi khi tải danh sách lớp: " + err.message);
  }
}

// -------------------- 2) Load câu hỏi (để so sánh khi hiện chi tiết) --------------------
async function loadQuestions() {
  try {
    const res = await fetch("data/questions.json");
    if (!res.ok) throw new Error("Không đọc được data/questions.json");
    questions = await res.json();
    questions = questions.map((q,i) => ({ ...q, id: q.id || "Q"+(i+1) }));
  } catch (err) {
    console.error("Lỗi load questions:", err);
  }
}

// -------------------- 3) Lấy danh sách bài nộp cho 1 lớp từ Google Sheet --------------------
async function fetchSubmissionsFromAPI(params = {}) {
  // params: object of query parameters, e.g. { action: "listByClass", lop: "7.1" }
  const url = new URL(GOOGLE_API);
  Object.entries(params).forEach(([k,v]) => url.searchParams.append(k, v));
  try {
    const res = await fetch(url.toString());
    // Nếu server trả về non-JSON hoặc CORS blocking, sẽ đi vào catch
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn("fetchSubmissionsFromAPI failed:", err);
    return null;
  }
}

// Duyệt cấu trúc trả về để lấy mảng submissions
function extractSubmissionsArray(apiResponse) {
  // Nếu apiResponse là mảng -> trả về trực tiếp
  if (!apiResponse) return null;
  if (Array.isArray(apiResponse)) return apiResponse;

  // Nếu là object chứa field hay key phổ biến
  const possibleKeys = ["submissions", "data", "records", "items", "results"];
  for (const k of possibleKeys) {
    if (Array.isArray(apiResponse[k])) return apiResponse[k];
  }

  // Nếu object có nhiều keys dạng row1,row2,... hoặc là map stt->obj
  // thử lấy các value là object có trường 'stt' hoặc 'score'
  const values = Object.values(apiResponse);
  if (values.length && values.every(v => typeof v === "object")) {
    // lọc các đối tượng có 'score' hoặc 'stt'
    const candidates = values.filter(v => v && (v.score !== undefined || v.stt !== undefined || v.stt == 0));
    if (candidates.length) return candidates;
  }

  return null;
}

// -------------------- 4) Điền select-student từ submissions có điểm >= 6 --------------------
async function populateEligibleStudentsForClass(lop) {
  const select = document.getElementById("select-student");
  select.innerHTML = `<option>Đang tải...</option>`;

  // 1) Thử gọi API chuyên cho lớp nếu endpoint hỗ trợ
  let resp = await fetchSubmissionsFromAPI({ action: "listByClass", lop });
  let subs = extractSubmissionsArray(resp);

  // 2) Nếu không có, thử gọi API với tham số khác tên
  if (!subs) {
    resp = await fetchSubmissionsFromAPI({ action: "getByClass", lop });
    subs = extractSubmissionsArray(resp);
  }

  // 3) Nếu vẫn không có, gọi toàn bộ danh sách rồi lọc
  if (!subs) {
    resp = await fetchSubmissionsFromAPI({ action: "listAll" });
    subs = extractSubmissionsArray(resp);
  }

  // 4) Nếu vẫn không có, gọi API không kèm param (một số Apps Script trả toàn bộ khi không có param)
  if (!subs) {
    resp = await fetchSubmissionsFromAPI({});
    subs = extractSubmissionsArray(resp);
  }

  // 5) Nếu vẫn null -> fallback: không tìm thấy
  if (!subs) {
    select.innerHTML = `<option value="">-- Không tìm thấy bài nộp (vui lòng kiểm tra API) --</option>`;
    console.error("Không lấy được submissions từ API. Response examples:", resp);
    return;
  }

  // Chuẩn hoá: mỗi submission nên có: lop, stt, ten, score, answers (object)
  // Lọc chỉ những submission của lớp 'lop' và score >= 6
  const eligible = subs.filter(s => {
    // một vài sheet có score dưới dạng string -> chuyển số
    const score = (s.score === undefined) ? (s.Score ?? s.point ?? s.diem ?? null) : s.score;
    const num = Number(score);
    const sLop = s.lop ?? s.LOP ?? s.lớp ?? s.class ?? s.LƠP;
    return (sLop == lop) && !isNaN(num) && num >= 6;
  }).map(s => {
    // chuẩn hoá trường
    return {
      raw: s,
      lop: s.lop ?? s.LOP ?? s.lớp ?? s.class ?? s.LƠP,
      stt: s.stt ?? s.STT ?? s.id ?? s.no ?? "",
      ten: s.ten ?? s.TEN ?? s.name ?? s.Name ?? "",
      score: Number(s.score ?? s.Score ?? s.point ?? s.diem ?? s.score ?? 0)
    };
  });

  // Lưu cache
  eligibleCache[lop] = eligible;

  // Điền select: nếu rỗng -> thông báo
  if (!eligible || eligible.length === 0) {
    select.innerHTML = `<option value="">-- Chưa có học sinh đủ 6 điểm trong lớp này --</option>`;
    return;
  }

  select.innerHTML = `<option value="">-- Chọn học sinh --</option>` +
    eligible.map(e => `<option value="${e.stt}">${e.stt} - ${e.ten} (Điểm: ${e.score})</option>`).join("");
}

// -------------------- 5) Khi bấm XEM BÀI: Lấy bài nộp (dùng cache nếu có) --------------------
async function loadStudentResult() {
  const className = document.getElementById("select-class").value;
  const stt = document.getElementById("select-student").value;

  if (!className || !stt) {
    alert("Vui lòng chọn lớp và học sinh!");
    return;
  }

  // Tìm trong cache trước
  const cached = (eligibleCache[className] || []).find(x => String(x.stt) === String(stt));
  if (cached) {
    // Nếu cached.raw có đầy đủ answers, score -> show
    const data = normalizeSubmissionObject(cached.raw);
    if (data && data.answers) {
      if (Number(data.score) < 6) {
        document.getElementById("result-area").innerHTML = `
          <div class='result-box'>
            <p>Học sinh <b>${cached.ten}</b> (${className})</p>
            <p class='bad'>Điểm: ${data.score} — Không đủ điều kiện xem chi tiết.</p>
          </div>`;
        return;
      }
      showDetailResult({ TEN: cached.ten, LƠP: className }, data);
      return;
    }
    // nếu cached.raw chưa có answers, fallback gọi API lấy riêng
  }

  // Nếu không có trong cache hoặc thiếu answers -> gọi API lấy bài theo lop+stt
  let resp = await fetchSubmissionsFromAPI({ action: "getSubmission", lop: className, stt: stt });
  let subs = extractSubmissionsArray(resp);

  // Nếu API trả 1 object thay vì array, lấy object
  let submissionObj = null;
  if (Array.isArray(subs) && subs.length) {
    // tìm đúng stt
    submissionObj = subs.find(s => String(s.stt) === String(stt) || String(s.STT) === String(stt));
  } else if (resp && typeof resp === "object" && !Array.isArray(resp)) {
    // resp có thể chính là object submission
    submissionObj = resp;
  }

  // Nếu chưa, cố gắng lấy từ toàn bộ list và lọc
  if (!submissionObj) {
    const respAll = await fetchSubmissionsFromAPI({ action: "listAll" });
    const allSubs = extractSubmissionsArray(respAll);
    if (allSubs) {
      submissionObj = allSubs.find(s => {
        const sLop = s.lop ?? s.LOP ?? s.class ?? s.lớp;
        const sStt = s.stt ?? s.STT ?? s.id ?? "";
        return (sLop == className) && (String(sStt) === String(stt));
      });
    }
  }

  if (!submissionObj) {
    document.getElementById("result-area").innerHTML =
      `<div class='result-box'>❌ Không tìm thấy bài làm của học sinh. (Hãy kiểm tra tên cột trên Google Sheet và endpoint API)</div>`;
    return;
  }

  const data = normalizeSubmissionObject(submissionObj);

  if (!data || !data.answers) {
    document.getElementById("result-area").innerHTML =
      `<div class='result-box'>❌ Bài làm không có dữ liệu đáp án đầy đủ.</div>`;
    return;
  }

  if (Number(data.score) < 6) {
    const studentName = data.ten ?? (students.find(s=>s.STT==stt && s.LƠP==className)?.TEN ?? "");
    document.getElementById("result-area").innerHTML = `
      <div class='result-box'>
        <p>Học sinh <b>${studentName}</b> (${className})</p>
        <p class='bad'>Điểm: ${data.score} — Không đủ điều kiện xem chi tiết.</p>
      </div>`;
    return;
  }

  // Hiển thị chi tiết
  showDetailResult({ TEN: data.ten || "", LƠP: className }, data);
}

// -------------------- 6) Chuẩn hóa object submission từ API --------------------
function normalizeSubmissionObject(obj) {
  if (!obj) return null;
  // Tìm answers: có thể là JSON string hoặc object
  let answers = obj.answers ?? obj.Answers ?? obj.answer ?? obj.answers_json ?? null;
  if (typeof answers === "string") {
    try { answers = JSON.parse(answers); } catch (e) { /* keep string */ }
  }
  // Tìm score
  const rawScore = obj.score ?? obj.Score ?? obj.diem ?? obj.Point ?? obj.point ?? obj.score;
  const score = rawScore !== undefined ? Number(rawScore) : undefined;

  // Tìm ten, stt, lop
  const ten = obj.ten ?? obj.TEN ?? obj.name ?? obj.Name ?? "";
  const stt = obj.stt ?? obj.STT ?? obj.id ?? obj.no ?? "";
  const lop = obj.lop ?? obj.LOP ?? obj.class ?? obj.lớp ?? "";

  return { ...obj, answers, score, ten, stt, lop };
}

// -------------------- 7) Hiển thị chi tiết câu sai --------------------
function showDetailResult(student, data) {
  const area = document.getElementById("result-area");

  let html = `
    <div class="result-box">
      <p>Học sinh: <b>${student.TEN}</b> — Lớp ${student.LƠP}</p>
      <p class="good">Điểm: ${data.score}</p>
      <h3>Các câu làm sai:</h3>
  `;

  const wrongList = [];

  // data.answers kỳ vọng là object map id -> "A. nội dung" hoặc "A. ..." tương tự
  const answersObj = data.answers || {};

  // nếu answers không phải object, cố parse thử
  if (typeof answersObj === "string") {
    try { answersObj = JSON.parse(answersObj); } catch (e) { /* leave as-is */ }
  }

  // So sánh dựa trên id của questions
  questions.forEach(q => {
    const userAnswer = answersObj[q.id] ?? answersObj[q.ID] ?? answersObj[q.q] ?? null;
    if (!userAnswer) return;
    // Xác định đáp án đúng hiện tại
    // q.correct có thể là "A" hoặc "A. nội dung". Chuẩn hoá
    const correctLabel = (typeof q.correct === "string") ? q.correct[0] : q.correct;
    // userAnswer có thể là "A. text" hoặc "A"
    const userLabel = (typeof userAnswer === "string") ? userAnswer.trim()[0] : "";
    const isCorrect = userLabel && correctLabel && (userLabel.toUpperCase() === String(correctLabel).toUpperCase());
    if (!isCorrect) {
      const correctText = (Array.isArray(q.options) ? q.options.find(o => o[0].toUpperCase() === String(correctLabel).toUpperCase()) : "") || (`${correctLabel}. (không có nội dung)`);
      wrongList.push({ q, userAnswer, correctText });
    }
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
