
import React, { useEffect, useState, useRef } from "react";

/**
 * App.jsx
 *
 * Web trắc nghiệm React (single-file component)
 * - Tải students.json và questions.json từ /public/data/
 * - Chọn lớp, STT (học sinh)
 * - Làm bài, nộp kết quả tới Google Apps Script (appsScriptUrl)
 *
 * Lưu ý: chỉnh biến appsScriptUrl theo Web App URL bạn deploy từ Google Apps Script.
 */

export default function App() {
  const [studentsData, setStudentsData] = useState(null);
  const [questionsData, setQuestionsData] = useState(null);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSTT, setSelectedSTT] = useState("");
  const [currentStudent, setCurrentStudent] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const [appsScriptUrl, setAppsScriptUrl] = useState("");
  const [sending, setSending] = useState(false);
  const initialLoad = useRef(true);

  useEffect(() => {
    // Load student and question JSON files from public/data
    fetch("/data/students.json")
      .then((r) => {
        if (!r.ok) throw new Error("Không tải được students.json");
        return r.json();
      })
      .then((data) => setStudentsData(data))
      .catch((err) => {
        console.error(err);
        setMessage("Lỗi khi tải danh sách học sinh: " + err.message);
      });

    fetch("/data/questions.json")
      .then((r) => {
        if (!r.ok) throw new Error("Không tải được questions.json");
        return r.json();
      })
      .then((data) => setQuestionsData(data))
      .catch((err) => {
        console.error(err);
        setMessage("Lỗi khi tải câu hỏi: " + err.message);
      });
  }, []);

  // when class or stt changes, update currentStudent
  useEffect(() => {
    if (!studentsData) return;
    if (!selectedClass || !selectedSTT) {
      setCurrentStudent(null);
      return;
    }
    const list = studentsData.classes?.[selectedClass] || [];
    const sttNum = Number(selectedSTT);
    const found = list.find((s) => Number(s.stt) === sttNum) || null;
    setCurrentStudent(found);
  }, [studentsData, selectedClass, selectedSTT]);

  // try to load appsScriptUrl from localStorage once
  useEffect(() => {
    if (!initialLoad.current) return;
    initialLoad.current = false;
    try {
      const saved = localStorage.getItem("appsScriptUrl");
      if (saved) setAppsScriptUrl(saved);
    } catch (e) {}
  }, []);

  useEffect(() => {
    try {
      if (appsScriptUrl) localStorage.setItem("appsScriptUrl", appsScriptUrl);
    } catch (e) {}
  }, [appsScriptUrl]);

  function handleChoose(qid, idx) {
    setAnswers((prev) => ({ ...prev, [qid]: idx }));
  }

  function calculateScore() {
    if (!questionsData) return 0;
    let ok = 0;
    for (const q of questionsData.questions) {
      if (answers[q.id] === q.answerIndex) ok++;
    }
    return ok;
  }

  function answeredCount() {
    if (!questionsData) return 0;
    let count = 0;
    for (const q of questionsData.questions) {
      if (answers[q.id] !== undefined) count++;
    }
    return count;
  }

  async function handleSubmit() {
    setMessage("");
    if (!currentStudent) {
      setMessage("Vui lòng chọn lớp và STT trước khi nộp.");
      return;
    }
    if (!questionsData) {
      setMessage("Không có dữ liệu câu hỏi.");
      return;
    }
    if (!appsScriptUrl) {
      setMessage("Vui lòng nhập Apps Script Web App URL để gửi kết quả.");
      return;
    }

    const total = questionsData.questions.length;
    const correct = calculateScore();
    const payload = {
      timestamp: new Date().toISOString(),
      class: selectedClass,
      stt: currentStudent.stt,
      name: currentStudent.name,
      examTitle: questionsData.title || "",
      totalQuestions: total,
      correct: correct,
      answers: answers,
    };

    try {
      setSending(true);
      const res = await fetch(appsScriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      if (res.ok) {
        setSubmitted(true);
        setMessage("Gửi kết quả thành công ✅");
      } else {
        setMessage("Lỗi khi gửi kết quả: " + res.status + " — " + text);
      }
    } catch (err) {
      setMessage("Lỗi khi gửi: " + err.message);
    } finally {
      setSending(false);
    }
  }

  function handleReset() {
    setAnswers({});
    setSubmitted(false);
    setMessage("");
  }

  // Simple UI
  return (
    <div style={{ fontFamily: "Inter, Roboto, Arial, sans-serif", padding: 20, background: "#f7f7fb", minHeight: "100vh" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ background: "white", padding: 20, borderRadius: 12, boxShadow: "0 6px 18px rgba(0,0,0,0.06)" }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>{questionsData?.title || "Bài trắc nghiệm"}</h1>
          <p style={{ color: "#666", marginTop: 6 }}>{questionsData?.timeMinutes ? `${questionsData.timeMinutes} phút` : ""}</p>

          {/* Settings: appsScriptUrl */}
          <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
            <input
              value={appsScriptUrl}
              onChange={(e) => setAppsScriptUrl(e.target.value)}
              placeholder="Apps Script Web App URL (https://script.google.com/...)"
              style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
            />
            <button
              onClick={() => {
                if (!appsScriptUrl) {
                  setMessage("Chưa có URL.");
                  return;
                }
                try {
                  localStorage.setItem("appsScriptUrl", appsScriptUrl);
                  setMessage("Đã lưu URL vào localStorage.");
                } catch (e) {
                  setMessage("Không thể lưu URL: " + e.message);
                }
              }}
              style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#0ea5e9", color: "white" }}
            >
              Lưu
            </button>
          </div>

          {/* Select class and student */}
          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: 13, color: "#444" }}>Chọn lớp</label>
              <select
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setSelectedSTT("");
                }}
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd", marginTop: 6 }}
              >
                <option value="">-- Chọn lớp --</option>
                {Object.keys(studentsData?.classes || {}).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ width: 220 }}>
              <label style={{ display: "block", fontSize: 13, color: "#444" }}>Chọn STT</label>
              <select
                value={selectedSTT}
                onChange={(e) => setSelectedSTT(e.target.value)}
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd", marginTop: 6 }}
              >
                <option value="">-- STT --</option>
                {(studentsData?.classes?.[selectedClass] || []).map((s) => (
                  <option key={s.stt} value={s.stt}>
                    {s.stt} — {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <strong>Học sinh:</strong>{" "}
            {currentStudent ? `${currentStudent.stt} — ${currentStudent.name}` : <span style={{ color: "#888" }}>Chưa chọn</span>}
          </div>

          {/* Questions */}
          <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
            {questionsData?.questions?.map((q, i) => (
              <div key={q.id} style={{ padding: 12, borderRadius: 10, border: "1px solid #eee", background: "white" }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  Câu {i + 1}. <span style={{ fontWeight: 500 }}>{q.text}</span>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {q.choices.map((c, idx) => {
                    const checked = answers[q.id] === idx;
                    return (
                      <label
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: checked ? "1px solid #3b82f6" : "1px solid #eee",
                          background: checked ? "rgba(59,130,246,0.06)" : "transparent",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          checked={checked || false}
                          onChange={() => handleChoose(q.id, idx)}
                        />
                        <div style={{ minWidth: 26, fontWeight: 600 }}>{String.fromCharCode(65 + idx)}.</div>
                        <div>{c}</div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Footer actions */}
          <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleSubmit}
                disabled={sending}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "#10b981",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {sending ? "Đang gửi..." : "Gửi kết quả"}
              </button>
              <button
                onClick={handleReset}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "white",
                  color: "#374151",
                  border: "1px solid #e5e7eb",
                }}
              >
                Reset
              </button>
            </div>

            <div style={{ fontSize: 14, color: "#374151" }}>
              Điểm: <strong>{calculateScore()}</strong> / {questionsData?.questions?.length || 0} • Đã trả lời: {answeredCount()}
            </div>
          </div>

          {message && (
            <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: "#fffbeb", border: "1px solid #fef3c7", color: "#92400e" }}>
              {message}
            </div>
          )}

          <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>
            Lưu ý: triển khai Google Apps Script Web App với quyền truy cập phù hợp (Anyone, even anonymous) nếu muốn gọi trực tiếp từ frontend.
          </div>
        </div>

        {/* small credits */}
        <div style={{ marginTop: 12, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
          Mẫu bởi giáo viên — dễ sửa, có thể đưa lên GitHub Pages / Netlify.
        </div>
      </div>
    </div>
  );
}
