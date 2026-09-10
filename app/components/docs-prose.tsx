import type { Components } from "react-markdown";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "cn";

function safeUrl(url: string): string {
  const value = url.trim();
  if (/^(javascript|vbscript|data):/i.test(value)) {
    return "";
  }
  return url;
}

const tableComponents: Components = {
  table: ({ children }) => (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-[0.95rem] leading-relaxed">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-border">{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-border last:border-0">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="py-2 pr-4 text-left align-top font-medium text-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="py-2 pr-4 align-top text-muted-foreground">{children}</td>
  ),
};

const docsComponents: Components = {
  ...tableComponents,
  h1: ({ children }) => (
    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-10 text-lg font-medium tracking-tight">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-8 text-base font-medium tracking-tight">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="mt-4 text-[0.95rem] leading-relaxed text-muted-foreground">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mt-4 list-disc space-y-2 pl-5 text-[0.95rem] leading-relaxed text-muted-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-4 list-decimal space-y-2 pl-5 text-[0.95rem] leading-relaxed text-muted-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  a: ({ href, children }) => {
    const external = Boolean(
      href && /^https?:\/\//i.test(href) && !href.includes("slab.priyanshpatel.com")
    );
    return (
      <a
        href={href}
        className="text-kiln underline underline-offset-4 hover:underline"
        {...(external
          ? { rel: "noopener noreferrer", target: "_blank", referrerPolicy: "no-referrer" }
          : {})}
      >
        {children}
        {external ? (
          <span className="sr-only"> (opens in a new tab)</span>
        ) : null}
      </a>
    );
  },
  code: ({ className, children }) => {
    const block = Boolean(className);
    if (block) {
      return (
        <code className="font-mono text-[13px] text-foreground">{children}</code>
      );
    }
    return (
      <code className="rounded-md bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-card p-4 font-mono text-[13px] leading-relaxed">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mt-4 border-l-2 border-border pl-4 text-[0.95rem] leading-relaxed text-muted-foreground">
      {children}
    </blockquote>
  ),
  img: ({ src, alt }) => {
    if (!src) {
      return null;
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt ?? ""}
        referrerPolicy="no-referrer"
        loading="lazy"
        decoding="async"
        className="mt-4 h-auto max-w-full"
      />
    );
  },
};

const readmeComponents: Components = {
  ...tableComponents,
  h1: ({ children }) => (
    <h1 className="mb-4 border-b border-border pb-2 text-[2em] leading-tight font-semibold">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-6 mb-4 border-b border-border pb-2 text-[1.5em] leading-tight font-semibold">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-6 mb-4 text-[1.25em] leading-tight font-semibold">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="mb-4 text-base leading-7 whitespace-normal">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-4 list-disc space-y-1 pl-8 text-base leading-7">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-4 list-decimal space-y-1 pl-8 text-base leading-7">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  a: ({ href, children }) => {
    const external = Boolean(href && /^https?:\/\//i.test(href));
    return (
      <a
        href={href}
        className="inline-block align-middle text-kiln underline-offset-4 hover:underline [&:has(img)]:text-transparent [&:has(img)]:no-underline"
        {...(external
          ? { rel: "noopener noreferrer", target: "_blank", referrerPolicy: "no-referrer" as const }
          : {})}
      >
        {children}
        {external ? (
          <span className="sr-only"> (opens in a new tab)</span>
        ) : null}
      </a>
    );
  },
  img: ({ src, alt }) => {
    if (!src) {
      return null;
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt ?? ""}
        referrerPolicy="no-referrer"
        loading="lazy"
        decoding="async"
        className="m-0 inline-block h-auto max-w-full align-middle"
      />
    );
  },
  code: docsComponents.code,
  pre: docsComponents.pre,
  hr: () => <hr className="my-6 border-border" />,
};

export function DocsProse({
  source,
  variant = "docs",
  className,
}: {
  source: string;
  variant?: "docs" | "readme";
  className?: string;
}) {
  return (
    <article
      className={cn(
        variant === "readme" ? "slab-readme w-full max-w-none" : "max-w-2xl",
        className
      )}
    >
      <Markdown
        remarkPlugins={[remarkGfm]}
        urlTransform={safeUrl}
        components={variant === "readme" ? readmeComponents : docsComponents}
      >
        {source}
      </Markdown>
    </article>
  );
}
