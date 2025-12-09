
# Web Trắc Nghiệm - Demo

Cách chạy (local):

1. Cài Node 18+.
2. `npm install`
3. `npm run dev`
4. Mở http://localhost:5173

Chỉnh sửa `public/data/students.json` và `public/data/questions.json` để thay dữ liệu.
Set `appsScriptUrl` trong ứng dụng trước khi gửi kết quả.

Google Apps Script (ví dụ) để lưu vào Google Sheet:

```javascript
function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Responses') || ss.insertSheet('Responses');
  if (sheet.getLastRow() === 0) sheet.appendRow(['Timestamp','Class','STT','Name','ExamTitle','TotalQuestions','Correct','Answers(JSON)']);
  var data = JSON.parse(e.postData.contents);
  sheet.appendRow([data.timestamp, data.class, data.stt, data.name, data.examTitle, data.totalQuestions, data.correct, JSON.stringify(data.answers)]);
  return ContentService.createTextOutput(JSON.stringify({status:'ok'})).setMimeType(ContentService.MimeType.JSON);
}
```

