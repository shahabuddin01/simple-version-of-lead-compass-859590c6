import { MouseEvent } from "react";
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

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    const openedWindow = window.open(cleanUrl, "_blank", "noopener,noreferrer");

    if (!openedWindow) {
      window.location.href = cleanUrl;
    }
  };

  return (
    <button
      type="button"
      title={`Open ${platform} profile`}
      aria-label={`Open ${platform} profile`}
      className="inline-flex items-center justify-center rounded-none border-0 bg-transparent p-0 text-inherit shadow-none [touch-action:manipulation]"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={handleClick}
    >
      {children}
    </button>
  );
}
