// export default function pdf(data) {
//   return `<embed src="data:application/pdf;base64,${data}" type="application/pdf" width="100%" height="600px" />`;
// }
export default function pdf(data) {

  const byteCharacters = atob(data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);
  return blobUrl
}