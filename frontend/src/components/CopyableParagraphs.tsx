import { Copy } from 'lucide-react';
import { Button } from './Button';

export function splitIntoParagraphs(content: string): string[] {
  const clean = content
    .replace(/```(?:text|markdown)?/gi, '')
    .replace(/```/g, '')
    .replace(/\r\n?/g, '\n')
    .trim();

  if (!clean) return [];

  return clean
    .split(/\n\s*\n+|\n\s*---+\s*\n|(?=^\s*\d{1,2}\s*[.)-]\s+)/gm)
    .map((paragraph) => paragraph
      .replace(/^\s*(?:p[áa]rrafo\s*)?\d{1,2}\s*[.)-]\s*/i, '')
      .replace(/^\s*[•*]\s+/, '')
      .replace(/\s*\n\s*/g, ' ')
      .trim())
    .filter(Boolean);
}

export function CopyableParagraphs({
  content,
  onCopy,
}: {
  content: string;
  onCopy: (text: string) => void;
}) {
  const paragraphs = splitIntoParagraphs(content);

  return (
    <div className="space-y-3">
      {paragraphs.map((paragraph, index) => (
        <div
          key={`${index}-${paragraph.slice(0, 24)}`}
          className="group/paragraph flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3 dark:border-gray-800 dark:bg-gray-800/40"
        >
          <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {paragraph}
          </p>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onCopy(paragraph)}
            className="h-8 w-8 shrink-0 opacity-70 transition-opacity group-hover/paragraph:opacity-100"
            title="Copiar este párrafo"
            aria-label="Copiar este párrafo"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}
