import { useState } from "react";
import { Copy, ExternalLink, Check } from "lucide-react";
import { cleanSocialUrl } from "@/lib/socialLinks";

interface SocialLinkProps {
  url: string | null | undefined;
  platform: string;
  children: React.ReactNode;
}

export function SocialLink({ url, platform, children }: SocialLinkProps) {
  const [showPopup, setShowPopup] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!url || url.trim() === "") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const cleanUrl = cleanSocialUrl(url, platform.toLowerCase());
  const displayUrl = cleanUrl
    .replace(/^https?:\/\/(www\.)?/, "")
    .slice(0, 30) + (cleanUrl.replace(/^https?:\/\/(www\.)?/, "").length > 30 ? "..." : "");

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(cleanUrl);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setShowPopup(false);
    }, 1500);
  };

  const handleOpenAnyway = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(cleanUrl, "_blank", "noopener,noreferrer");
    setShowPopup(false);
  };

  return (
    <div className="relative inline-block" onClick={e => e.stopPropagation()}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowPopup(!showPopup);
        }}
        title={`${platform} — click to copy link`}
      >
        {children}
      </button>

      {showPopup && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowPopup(false)} />
          <div className="absolute bottom-9 left-1/2 -translate-x-1/2 z-50 bg-popover border border-border rounded-lg shadow-lg p-3 w-64">
            <p className="text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
              {platform}
            </p>
            <p className="text-xs text-foreground mb-3 break-all font-mono bg-muted rounded p-1.5">
              {displayUrl}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium rounded-md transition-colors"
              >
                {copied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy Link</>}
              </button>
              <button
                onClick={handleOpenAnyway}
                className="flex items-center justify-center gap-1 px-2 py-1.5 border border-border hover:bg-accent text-muted-foreground text-xs rounded-md transition-colors"
                title="Try to open directly (may be blocked)"
              >
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              💡 Copy link and paste in browser if direct open is blocked
            </p>
          </div>
        </>
      )}
    </div>
  );
}
