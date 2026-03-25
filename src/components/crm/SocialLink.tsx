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
  const handleWrapperPointerDown = (e: MouseEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const handleLinkClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.stopPropagation();
  };

  return (
    <span onMouseDown={handleWrapperPointerDown} className="inline-flex">
      <a
        href={cleanUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleLinkClick}
        title={`Open ${platform} profile`}
      >
        {children}
      </a>
    </span>
  );
}
