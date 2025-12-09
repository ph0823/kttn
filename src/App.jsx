<<<<<<< HEAD
=======

>>>>>>> 7b6c7e1 (initial commit)
import React, { useEffect, useState } from "react";

// ==========================
// CONFIG API URL
// ==========================
const GOOGLE_API = "https://script.google.com/macros/s/AKfycbyAFbKjEZlA0RmAChAsHWirbeWAK7RwzBNYEAQb4O4tLytTOjoAevXlhDNA3ANtwDcN/exec";

export default function App() {
  const [students, setStudents] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedClass, setSelectedClass] = useState("");
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [quiz, setQuiz] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  // Load students + questions
  useEffect(() => {
    fetch("/data/students.json")
      .then(res => res.json())
      .then(data => setStudents(data));

    fetch("/data/questions.json")
      .then(res => res.json())
      .then(data => setQuestions(data));
  }, []);

  // Khi chọn lớp → lọc học sinh
  useEffect(() => {
    if (selectedClass) {
      setFilteredStudents(
        students.filter(s => s.Lop === selectedClass)
      );
    }
  }, [selectedClass, students]);

  // ==========================
  // Shuffle utility
  // ==========================
  function shuffle(array) {
    return [...array].sort(() => Math.random() - 0.5);
  }

  // ==========================
  // Lấy 20 câu theo độ khó NB–TH–VD
  // ==========================
  function pick20Questions() {
    const NB = questions.filter(q => q.level === "NB");
    const TH = questions.filter(q => q.level === "TH");
    const VD = questions.filter(q => q.level === "VD");

    const pickNB = shuffle(NB).slice(0, 8);
    const pickTH = shuffle(TH).slice(0, 7);
    const pickVD = shuffle(VD).slice(0, 5);

    let final = [...pickNB, ...pickTH, ...pickVD];
    final = shuffle(final).map(q => ({
      ...q,
      options: shuffle(q.options) // trộn đáp án
    }));

    setQuiz(final);
  }

  // Khi chọn học sinh → tạo đề
  function startQuiz() {
    if (!selectedStudent) return alert("Hãy chọn học sinh!");
    pick20Questions();
  }

  // ==========================
  // Khi HS chọn đáp án
  // ==========================
  function chooseAnswer(qid, opt) {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [qid]: opt }));
  }

  // ==========================
  // Nộp bài
  // ==========================
  function submitQuiz() {
    if (Object.keys(answers).length < 20)
      if (!window.confirm("Bạn chưa trả lời hết. Nộp luôn?"))
        return;

    setSubmitted(true);

    const correctCount = quiz.filter(
      q => answers[q.id] && answers[q.id].startsWith(q.correct)
    ).length;

    const result = {
      lop: selectedStudent.Lop,
      stt: selectedStudent.STT,
      ten: selectedStudent.Ten,
      score: Math.round((correctCount / quiz.length) * 10),
      correctCount,
      total: quiz.length,
      details: answers
    };

    sendToGoogle(result);
  }

  // ==========================
  // Gửi kết quả lên Google Sheet
  // ==========================
  async function sendToGoogle(payload) {
    try {
      await fetch(GOOGLE_API, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      console.log("Đã gửi kết quả lên Google Sheet");
    } catch (err) {
      console.error("Lỗi gửi:", err);
    }
  }

  // ==========================
  // RENDER
  // ==========================
  if (!quiz.length)
    return (
      <div style={{ padding: 20 }}>
        <h2>🎓 Chọn học sinh để bắt đầu làm bài</h2>

        <div>
          <label>Chọn lớp: </label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            <option value="">-- Chọn lớp --</option>
            {[...new Set(students.map(s => s.Lop))].map(l => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>

        {selectedClass && (
          <div style={{ marginTop: 10 }}>
            <label>Chọn học sinh: </label>
            <select
              onChange={(e) => {
                const st = filteredStudents.find(
                  s => String(s.STT) === String(e.target.value)
                );
                setSelectedStudent(st);
              }}
            >
              <option value="">-- Chọn STT --</option>
              {filteredStudents.map(s => (
                <option key={s.STT} value={s.STT}>
                  {s.STT} - {s.Ten}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={startQuiz}
          disabled={!selectedStudent}
          style={{ marginTop: 20 }}
        >
          BẮT ĐẦU LÀM BÀI
        </button>
      </div>
    );

  // ==========================
  // Màn hình làm bài
  // ==========================
  return (
    <div style={{ padding: 20, maxWidth: 800, margin: "auto" }}>
      <h2>📝 Bài kiểm tra – 20 câu</h2>
      <p>
        Học sinh: <b>{selectedStudent.Ten}</b> – Lớp <b>{selectedStudent.Lop}</b>
      </p>

      {quiz.map((q, index) => {
        const selected = answers[q.id];
        const correctOpt = q.options.find(o => o.startsWith(q.correct));

        return (
          <div key={q.id} style={{ marginBottom: 20 }}>
            <div>
              <b>Câu {index + 1}:</b> {q.q}
            </div>

            {q.options.map(opt => {
              const isCorrect = submitted && opt.startsWith(q.correct);
              const isWrong =
                submitted &&
                selected === opt &&
                !opt.startsWith(q.correct);

              return (
                <div
                  key={opt}
                  onClick={() => chooseAnswer(q.id, opt)}
                  style={{
                    padding: 6,
                    marginTop: 4,
                    borderRadius: 5,
                    border: "1px solid #ddd",
                    background:
                      isCorrect ? "#b6f7b0" :
                      isWrong ? "#ffb3b3" :
                      selected === opt ? "#e6f0ff" : "#fff",
                    cursor: submitted ? "not-allowed" : "pointer"
                  }}
                >
                  {opt}
                </div>
              );
            })}
          </div>
        );
      })}

      {!submitted ? (
        <button
          onClick={submitQuiz}
          style={{
            padding: 10,
            background: "blue",
            color: "white",
            border: "none",
            borderRadius: 6
          }}
        >
          NỘP BÀI
        </button>
      ) : (
        <h3 style={{ color: "green" }}>
          ✔ Đã nộp bài! Kết quả đã gửi lên Google Sheet.
        </h3>
      )}
    </div>
  );
}
