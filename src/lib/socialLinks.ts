/**
 * Social link utilities — normalize CRM social URLs
 * before rendering them as native external anchors.
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
