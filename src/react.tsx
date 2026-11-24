import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { getAgent, getAgentIcon, getAgentLink, platformNames } from "./index.js";
import type { AgentId, LinkOptions, Platform } from "./index.js";

export interface AgentIconProps extends Omit<ComponentPropsWithoutRef<"img">, "src" | "alt"> {
  agent: AgentId;
  alt?: string;
}

export function AgentIcon({ agent, alt = "", width = 18, height = 18, ...props }: AgentIconProps) {
  const src = getAgentIcon(agent);
  if (!src) return null;
  return <img {...props} src={src} alt={alt} width={width} height={height} />;
}

export interface AgentLinkProps extends Omit<ComponentPropsWithoutRef<"a">, "href"> {
  agent: AgentId;
  platform: Platform;
  options?: LinkOptions;
  iconOnly?: boolean;
}

export const AgentLink = forwardRef<HTMLAnchorElement, AgentLinkProps>(function AgentLink(
  { agent, platform, options, iconOnly = false, children, "aria-label": label, ...props },
  ref,
) {
  const href = getAgentLink(agent, platform, options);
  if (!href) return null;

  const name = getAgent(agent).name;
  return (
    <a
      {...props}
      ref={ref}
      href={href}
      aria-label={label ?? (iconOnly ? `Open ${name} on ${platformNames[platform]}` : undefined)}
    >
      {children ?? (
        <>
          <AgentIcon agent={agent} />
          {(!iconOnly || !getAgentIcon(agent)) && name}
        </>
      )}
    </a>
  );
});
