export default function eml(data) {
  const decodedString = atob(data);
  return `<div>${decodedString}</div>`;
}
