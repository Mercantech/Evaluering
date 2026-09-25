import { type ReactNode } from 'react';

type Block =
  | { type: 'h2' | 'h3'; text: string }
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'p'; text: string };

function inlineFormat(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else {
      parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').trim().split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      i += 1;
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', text: line.slice(4).trim() });
      i += 1;
      continue;
    }

    if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', text: line.slice(3).trim() });
      i += 1;
      continue;
    }

    if (line.startsWith('# ')) {
      blocks.push({ type: 'h2', text: line.slice(2).trim() });
      i += 1;
      continue;
    }

    const bullet = /^[-*•]\s+(.+)$/.exec(line);
    if (bullet) {
      const items: string[] = [];
      while (i < lines.length) {
        const itemLine = lines[i].trim();
        const m = /^[-*•]\s+(.+)$/.exec(itemLine);
        if (!m) break;
        items.push(m[1]);
        i += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    const numbered = /^(\d+)[.)]\s+(.+)$/.exec(line);
    if (numbered) {
      const items: string[] = [];
      while (i < lines.length) {
        const itemLine = lines[i].trim();
        const m = /^(\d+)[.)]\s+(.+)$/.exec(itemLine);
        if (!m) break;
        items.push(m[2]);
        i += 1;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    const para: string[] = [line];
    i += 1;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (
        !next ||
        next.startsWith('#') ||
        /^[-*•]\s+/.test(next) ||
        /^\d+[.)]\s+/.test(next)
      ) {
        break;
      }
      para.push(next);
      i += 1;
    }
    blocks.push({ type: 'p', text: para.join(' ') });
  }

  return blocks;
}

export function AiMarkdown({ content }: { content: string }) {
  const blocks = parseBlocks(content);

  return (
    <div className="ai-md">
      {blocks.map((block, index) => {
        if (block.type === 'h2') {
          return (
            <h3 className="ai-md-h2" key={index}>
              {inlineFormat(block.text)}
            </h3>
          );
        }
        if (block.type === 'h3') {
          return (
            <h4 className="ai-md-h3" key={index}>
              {inlineFormat(block.text)}
            </h4>
          );
        }
        if (block.type === 'ul') {
          return (
            <ul className="ai-md-list" key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{inlineFormat(item)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === 'ol') {
          return (
            <ol className="ai-md-list ai-md-list-ordered" key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{inlineFormat(item)}</li>
              ))}
            </ol>
          );
        }
        if (block.type === 'p') {
          return (
            <p className="ai-md-p" key={index}>
              {inlineFormat(block.text)}
            </p>
          );
        }
        return null;
      })}
    </div>
  );
}
