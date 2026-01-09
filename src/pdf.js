export default function pdf(data) {
  return `<embed src="data:application/pdf;base64,${data}" type="application/pdf" width="100%" height="600px" />`;
}
