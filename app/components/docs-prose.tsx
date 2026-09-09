import type { Components } from "react-markdown";
import Markdown from "react-markdown";

const components: Components = {
  h1: ({ children }) => (
    <h1 className="font-display text-3xl italic tracking-tight sm:text-4xl">
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
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-kiln underline-offset-4 hover:underline"
    >
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const block = Boolean(className);
    if (block) {
      return <code className="font-mono text-[13px] text-foreground">{children}</code>;
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
};

export function DocsProse({ source }: { source: string }) {
  return (
    <article className="max-w-2xl">
      <Markdown components={components}>{source}</Markdown>
    </article>
  );
}
