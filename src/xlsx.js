let XLSX = require("xlsx");
export default function xlsx(b64Data) {
  const workbook = XLSX.read(b64Data, { type: "base64" });

  // 2. Access the data (Example: Get the first sheet)
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // 3. Convert to JSON
  const json = XLSX.utils.sheet_to_json(worksheet);
  return XLSX.utils.sheet_to_html(worksheet);
}
