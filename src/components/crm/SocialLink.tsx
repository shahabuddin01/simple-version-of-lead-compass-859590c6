import { cleanSocialUrl } from "@/lib/socialLinks";

interface SocialLinkProps {
  url: string | null | undefined;
  platform: string;
  children: React.ReactNode;
}

export function SocialLink({ url, platform, children }: SocialLinkProps) {
  if (!url || url.trim() === "") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const cleanUrl = cleanSocialUrl(url, platform.toLowerCase());

  return (
    <a
      href={cleanUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`Open ${platform} profile`}
    >
      {children}
    </a>
  );
}
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanUrl = cleanSocialUrl(url, platform.toLowerCase());
    if (!cleanUrl) return;

    // Copy to clipboard as fallback
    navigator.clipboard.writeText(cleanUrl).catch(() => {});

    // Use real anchor click to avoid popup blockers
    const link = document.createElement("a");
    link.href = cleanUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.referrerPolicy = "no-referrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast("Opening link... If blocked, URL is copied to clipboard");
  };

  return (
    <div className="inline-block" onClick={e => e.stopPropagation()}>
      <button onClick={handleClick} title={`Open ${platform} profile`}>
        {children}
      </button>
    </div>
  );
}