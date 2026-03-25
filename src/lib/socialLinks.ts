/**
 * Social link utilities — opens social media URLs reliably
 * using anchor click method to avoid about:blank issues.
 */

export function cleanSocialUrl(url: string, platform?: string): string {
  if (!url) return "";
  let clean = url.trim();
  clean = clean.replace(/^'+/, "").trim();

  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    clean = "https://" + clean;
  }

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

export function openSocialLink(url: string | null | undefined, platform?: string): void {
  if (!url || url.trim() === "") return;

  const cleanUrl = cleanSocialUrl(url, platform);
  if (!cleanUrl) return;

  try {
    new URL(cleanUrl);
  } catch {
    return;
  }

  const link = document.createElement("a");
  link.href = cleanUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function copySocialLink(url: string, platform?: string): void {
  if (!url) return;
  const cleanUrl = cleanSocialUrl(url, platform);
  if (cleanUrl) {
    navigator.clipboard.writeText(cleanUrl);
  }
}
