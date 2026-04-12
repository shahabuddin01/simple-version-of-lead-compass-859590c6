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
    <span onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} className="inline-flex">
      <a
        href={cleanUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title={`Open ${platform} profile`}
        aria-label={`Open ${platform} profile`}
        className="inline-flex"
      >
        {children}
      </a>
    </span>
  );
}
