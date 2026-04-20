export function notifySuccess(message: string) {
  console.log("✅", message);
  // later you can plug toast here (sonner / react-hot-toast)
}

export function notifyError(message: string) {
  console.error("❌", message);
}

export function notifyInfo(message: string) {
  console.log("ℹ️", message);
}