import * as React from "react";
import { cleanSocialUrl } from "@/lib/socialLinks";

interface SocialLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  url: string | null | undefined;
  platform: string;
  children: React.ReactNode;
}

export const SocialLink = React.forwardRef<HTMLAnchorElement, SocialLinkProps>(
  ({ url, platform, children, onClick, ...props }, ref) => {
    if (!url || url.trim() === "") {
      return <span className="text-xs text-muted-foreground">—</span>;
    }

    const cleanUrl = cleanSocialUrl(url, platform.toLowerCase());

    const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.stopPropagation();
      onClick?.(event);

      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      event.preventDefault();
      const openedWindow = window.open(cleanUrl, "_blank", "noopener,noreferrer");

      if (!openedWindow) {
        window.location.assign(cleanUrl);
      }
    };

    const stopPropagation = (
      event: React.MouseEvent<HTMLAnchorElement> | React.PointerEvent<HTMLAnchorElement>
    ) => {
      event.stopPropagation();
    };

    return (
      <a
        {...props}
        ref={ref}
        href={cleanUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={`Open ${platform} profile`}
        aria-label={`Open ${platform} profile`}
        className="inline-flex [touch-action:manipulation]"
        draggable={false}
        onPointerDown={stopPropagation}
        onMouseDown={stopPropagation}
        onClick={handleClick}
        onDragStart={(event) => event.preventDefault()}
      >
        {children}
      </a>
    );
  }
);

SocialLink.displayName = "SocialLink";
