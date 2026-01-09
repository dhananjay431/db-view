export default function html(base64Html) {
  return `<iframe src="data:text/html;base64,${base64Html}" width="100%" height="600px"></iframe>`;
}
