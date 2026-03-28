import React, { useState, useMemo } from "react";

interface MarkdownRendererProps {
  content: string;
}

/**
 * 간단한 마크다운 렌더러 (외부 라이브러리 없이 순수 구현)
 * 지원: headings, bold, italic, inline code, code blocks, lists, blockquotes, links, hr
 */
export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const blocks = useMemo(() => parseBlocks(content), [content]);

  return (
    <div className="chat-content text-sm text-text-primary leading-relaxed select-text">
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}

// ── Block types ──
type BlockType =
  | { type: "paragraph"; content: string }
  | { type: "heading"; level: number; content: string }
  | { type: "code"; language: string; content: string }
  | { type: "blockquote"; content: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "hr" };

function parseBlocks(text: string): BlockType[] {
  const blocks: BlockType[] = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.trimStart().startsWith("```")) {
      const lang = line.trimStart().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: "code", language: lang, content: codeLines.join("\n") });
      i++; // skip closing ```
      continue;
    }

    // HR
    if (/^---+$|^\*\*\*+$|^___+$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({ type: "heading", level: headingMatch[1].length, content: headingMatch[2] });
      i++;
      continue;
    }

    // Blockquote
    if (line.trimStart().startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith("> ")) {
        quoteLines.push(lines[i].trimStart().slice(2));
        i++;
      }
      blocks.push({ type: "blockquote", content: quoteLines.join("\n") });
      continue;
    }

    // Unordered list
    if (/^\s*[-*+]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s/, ""));
        i++;
      }
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s/, ""));
        i++;
      }
      blocks.push({ type: "list", ordered: true, items });
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph (collect consecutive non-empty lines)
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].trimStart().startsWith("```") && !lines[i].trimStart().startsWith("#") && !lines[i].trimStart().startsWith("> ") && !/^\s*[-*+]\s/.test(lines[i]) && !/^\s*\d+\.\s/.test(lines[i]) && !/^---+$/.test(lines[i].trim())) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", content: paraLines.join("\n") });
    }
  }

  return blocks;
}

function Block({ block }: { block: BlockType }) {
  switch (block.type) {
    case "heading":
      const Tag = `h${block.level}` as keyof JSX.IntrinsicElements;
      return <Tag><InlineContent text={block.content} /></Tag>;

    case "code":
      return <CodeBlock language={block.language} code={block.content} />;

    case "blockquote":
      return (
        <blockquote>
          <InlineContent text={block.content} />
        </blockquote>
      );

    case "list":
      const ListTag = block.ordered ? "ol" : "ul";
      return (
        <ListTag>
          {block.items.map((item, i) => (
            <li key={i}><InlineContent text={item} /></li>
          ))}
        </ListTag>
      );

    case "hr":
      return <hr />;

    case "paragraph":
      return <p><InlineContent text={block.content} /></p>;
  }
}

// ── Inline rendering (bold, italic, code, links) ──
function InlineContent({ text }: { text: string }) {
  const parts = useMemo(() => parseInline(text), [text]);

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "text") return <React.Fragment key={i}>{part.content}</React.Fragment>;
        if (part.type === "bold") return <strong key={i}>{part.content}</strong>;
        if (part.type === "italic") return <em key={i}>{part.content}</em>;
        if (part.type === "code") return <code key={i}>{part.content}</code>;
        if (part.type === "link") return <a key={i} href={part.href} target="_blank" rel="noopener">{part.content}</a>;
        return null;
      })}
    </>
  );
}

type InlinePart =
  | { type: "text"; content: string }
  | { type: "bold"; content: string }
  | { type: "italic"; content: string }
  | { type: "code"; content: string }
  | { type: "link"; content: string; href: string };

function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  // Regex: inline code > bold > italic > link
  const regex = /`([^`]+)`|\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)]+)\)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }

    if (match[1] !== undefined) {
      parts.push({ type: "code", content: match[1] });
    } else if (match[2] !== undefined) {
      parts.push({ type: "bold", content: match[2] });
    } else if (match[3] !== undefined) {
      parts.push({ type: "italic", content: match[3] });
    } else if (match[4] !== undefined && match[5] !== undefined) {
      parts.push({ type: "link", content: match[4], href: match[5] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: "text", content: text }];
}

// ── Code Block with copy button ──
function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre>
        {language && (
          <div className="absolute top-2 left-3 text-[10px] text-text-muted uppercase tracking-wider">
            {language}
          </div>
        )}
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 px-2 py-1 text-[10px] bg-bg-hover border border-border-subtle rounded text-text-secondary hover:text-text-primary opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
        <code className={language ? "mt-4 block" : "block"}>
          {code}
        </code>
      </pre>
    </div>
  );
}
