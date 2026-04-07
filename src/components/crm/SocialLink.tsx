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

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Use window.top to escape iframe context in preview
    const opener = window.top || window;
    opener.open(cleanUrl, "_blank");
  };

  return (
    <span
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex cursor-pointer"
    >
      <a href={cleanUrl} target="_blank" onClick={handleClick} title={`Open ${platform} profile`}>
        {children}
      </a>
    </span>
  );
}
