import { cleanSocialUrl } from "@/lib/socialLinks";
import type { MouseEvent } from "react";

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

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.stopPropagation();
    // Fallback: manually open if the browser blocks the default anchor behavior
    window.open(cleanUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <span
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex"
    >
      <a
        href={cleanUrl}
        target="_blank"
        rel="noopener noreferrer"
        referrerPolicy="no-referrer"
        onClick={handleClick}
        title={`Open ${platform} profile`}
      >
        {children}
      </a>
    </span>
  );
}