/**
 * Social link utilities — opens social media URLs
 * with referrer stripping to prevent platform blocking.
 */

export function cleanSocialUrl(url: string, platform?: string): string {
  if (!url) return "";
  let clean = url.trim();
  
  // Remove leading apostrophes (Excel artifact)
  clean = clean.replace(/^'+/, "");
  
  // Add https if missing
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    clean = "https://" + clean;
  }
  
  // Fix common URL issues per platform
  if (platform === "facebook") {
    if (!clean.includes("facebook.com") && !clean.includes("fb.com")) {
      clean = "https://facebook.com/" + clean.replace(/^https?:\/\//, "");
    }
  }
  if (platform === "instagram") {
    if (!clean.includes("instagram.com")) {
      clean = "https://instagram.com/" + clean.replace(/^https?:\/\//, "");
    }
  }
  if (platform === "linkedin") {
    if (!clean.includes("linkedin.com")) {
      clean = "https://linkedin.com/in/" + clean.replace(/^https?:\/\//, "");
    }
  }
  
  return clean;
}

export function openSocialLink(url: string, platform?: string): void {
  if (!url) return;
  
  const cleanUrl = cleanSocialUrl(url, platform);
  if (!cleanUrl) return;
  
  // Open via blank window with referrer stripped
  const newWindow = window.open("", "_blank", "noopener");
  if (newWindow) {
    newWindow.document.write(
      `<!DOCTYPE html><html><head>` +
      `<meta name="referrer" content="no-referrer">` +
      `<meta http-equiv="refresh" content="0;url=${encodeURI(cleanUrl)}">` +
      `</head><body><p>Redirecting...</p>` +
      `<script>window.location.replace(${JSON.stringify(cleanUrl)});<\/script>` +
      `</body></html>`
    );
    newWindow.document.close();
  }
}

export function copySocialLink(url: string, platform?: string): void {
  if (!url) return;
  const cleanUrl = cleanSocialUrl(url, platform);
  if (cleanUrl) {
    navigator.clipboard.writeText(cleanUrl);
  }
}
