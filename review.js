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
