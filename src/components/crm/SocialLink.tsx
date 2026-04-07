import { toast } from "sonner";

import { cleanSocialUrl } from "@/lib/socialLinks";

interface SocialLinkProps {
  url: string | null | undefined;
  platform: string;
  children: React.ReactNode;
}

async function copyTextToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
}

export function SocialLink({ url, platform, children }: SocialLinkProps) {
  if (!url || url.trim() === "") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const cleanUrl = cleanSocialUrl(url, platform.toLowerCase());

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await copyTextToClipboard(cleanUrl);
      toast.success(`${platform} link copied`);
    } catch {
      toast.error(`Could not copy ${platform} link`);
    }
  };

  return (
    <span onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} className="inline-flex">
      <button
        type="button"
        onClick={handleClick}
        title={`Copy ${platform} profile link`}
        aria-label={`Copy ${platform} profile link`}
        className="inline-flex"
      >
        {children}
      </button>
    </span>
  );
}

