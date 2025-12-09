import React, { useEffect, useState } from "react";

function App() {
  const [students, setStudents] = useState([]);
  const [khoiList, setKhoiList] = useState([]);
  const [lopList, setLopList] = useState([]);
  const [sttList, setSttList] = useState([]);

  const [selectedKhoi, setSelectedKhoi] = useState("");
  const [selectedLop, setSelectedLop] = useState("");
  const [selectedStt, setSelectedStt] = useState("");
  const [studentName, setStudentName] = useState("");

  // Load students.json
  useEffect(() => {
    fetch("/data/students.json")
      .then((res) => res.json())
      .then((data) => {
        setStudents(data);

        // Auto-detect Khối
        const uniqueKhoi = [...new Set(data.map((s) => s["Khối"]))].sort();
        setKhoiList(uniqueKhoi);
      });
  }, []);

  // Khi chọn Khối -> auto-detect Lớp
  useEffect(() => {
    if (selectedKhoi) {
      const filteredLop = [
        ...new Set(
          students
            .filter((s) => s["Khối"] === selectedKhoi)
            .map((s) => s["LƠP"])
        ),
      ].sort();

      setLopList(filteredLop);
      setSelectedLop("");
      setSttList([]);
      setSelectedStt("");
      setStudentName("");
    }
  }, [selectedKhoi, students]);

  // Khi chọn Lớp -> auto-detect STT
  useEffect(() => {
    if (selectedLop) {
      const filteredStt = students
        .filter(
          (s) => s["Khối"] === selectedKhoi && s["LƠP"] === selectedLop
        )
        .map((s) => s["STT"])
        .sort((a, b) => a - b);

      setSttList(filteredStt);
      setSelectedStt("");
      setStudentName("");
    }
  }, [selectedLop, selectedKhoi, students]);

  // Khi chọn STT -> lấy tên học sinh
  useEffect(() => {
    if (selectedStt) {
      const stu = students.find(
        (s) =>
          s["Khối"] === selectedKhoi &&
          s["LƠP"] === selectedLop &&
          s["STT"] === Number(selectedStt)
      );
      setStudentName(stu ? stu["TEN"] : "");
    }
  }, [selectedStt, selectedKhoi, selectedLop, students]);

  return (
    <div style={{ padding: 20, maxWidth: 500, margin: "0 auto" }}>
      <h2>Tự động nhận danh sách học sinh</h2>

      {/* Chọn Khối */}
      <label>Chọn khối:</label>
      <select
        value={selectedKhoi}
        onChange={(e) => setSelectedKhoi(e.target.value)}
      >
        <option value="">-- Chọn khối --</option>
        {khoiList.map((k, i) => (
          <option key={i} value={k}>
            {k}
          </option>
        ))}
      </select>

      {/* Chọn Lớp */}
      {selectedKhoi && (
        <>
          <br />
          <label>Chọn lớp:</label>
          <select
            value={selectedLop}
            onChange={(e) => setSelectedLop(e.target.value)}
          >
            <option value="">-- Chọn lớp --</option>
            {lopList.map((lop, i) => (
              <option key={i} value={lop}>
                {lop}
              </option>
            ))}
          </select>
        </>
      )}

      {/* Chọn STT */}
      {selectedLop && (
        <>
          <br />
          <label>Chọn STT:</label>
          <select
            value={selectedStt}
            onChange={(e) => setSelectedStt(e.target.value)}
          >
            <option value="">-- STT --</option>
            {sttList.map((stt, i) => (
              <option key={i} value={stt}>
                {stt}
              </option>
            ))}
          </select>
        </>
      )}

      {/* Hiện tên học sinh */}
      {studentName && (
        <div style={{ marginTop: 20, padding: 15, border: "1px solid #ccc" }}>
          <h3>Học sinh:</h3>
          <p>
            <b>{studentName}</b>
          </p>
        </div>
      )}
    </div>
  );
}

export default App;
