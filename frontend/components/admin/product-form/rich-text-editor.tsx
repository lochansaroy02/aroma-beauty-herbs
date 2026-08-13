"use client";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  BoldIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  RemoveFormattingIcon,
  UnderlineIcon,
} from "lucide-react";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  /** Read once on mount. The editor is uncontrolled after that. */
  initialHtml: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
};

/**
 * Chrome copied from components/ui/textarea.tsx so the editor can't drift away
 * from the rest of the form, plus hand-rolled content typography. No
 * @tailwindcss/typography — it's a big dependency for two fields, and its
 * opinions would fight the base-maia tokens.
 */
const CONTENT_CLASSES = [
  "[&_.tiptap]:min-h-40 [&_.tiptap]:px-3 [&_.tiptap]:py-2 [&_.tiptap]:outline-none",
  "[&_.tiptap_p]:my-2 [&_.tiptap_p:first-child]:mt-0 [&_.tiptap_p:last-child]:mb-0",
  "[&_.tiptap_h3]:font-heading [&_.tiptap_h3]:text-base [&_.tiptap_h3]:font-medium [&_.tiptap_h3]:mt-4",
  "[&_.tiptap_h4]:font-heading [&_.tiptap_h4]:text-sm [&_.tiptap_h4]:font-medium [&_.tiptap_h4]:mt-3",
  "[&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-5 [&_.tiptap_ul]:my-2",
  "[&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-5 [&_.tiptap_ol]:my-2",
  "[&_.tiptap_li]:my-0.5",
  "[&_.tiptap_a]:text-primary [&_.tiptap_a]:underline [&_.tiptap_a]:underline-offset-4",
  "[&_.tiptap_strong]:font-semibold",
  "[&_.tiptap_blockquote]:border-l-2 [&_.tiptap_blockquote]:pl-3 [&_.tiptap_blockquote]:text-muted-foreground",
].join(" ");

function ToolbarButton({
  editor,
  active,
  label,
  onClick,
  children,
}: {
  editor: Editor;
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon-sm"
      variant={active ? "secondary" : "ghost"}
      aria-pressed={active}
      aria-label={label}
      title={label}
      disabled={!editor.isEditable}
      // Without this the click steals focus and the selection collapses before
      // the command runs.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export default function RichTextEditor({
  label,
  initialHtml,
  onChange,
  placeholder,
  disabled = false,
  invalid = false,
}: Props) {
  const id = useId();

  const editor = useEditor({
    // Required: App Router client components still prerender on the server, and
    // ProseMirror touches `document` on first render.
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        // Nothing the sanitiser would strip belongs in the document.
        codeBlock: false,
        code: false,
        horizontalRule: false,
        heading: { levels: [3, 4] },
        link: {
          openOnClick: false,
          autolink: true,
          protocols: ["http", "https", "mailto"],
        },
      }),
    ],
    content: initialHtml,
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
    editorProps: {
      attributes: {
        "aria-labelledby": id,
        ...(placeholder ? { "data-placeholder": placeholder } : {}),
      },
    },
  });

  if (!editor) {
    return (
      <div className="grid gap-2">
        <Label id={id}>{label}</Label>
        <div className="h-48 rounded-4xl border border-input bg-transparent" />
      </div>
    );
  }

  function setLink() {
    if (!editor) return;
    const current = String(editor.getAttributes("link")["href"] ?? "");
    const next = window.prompt("Link URL", current);

    if (next === null) return;

    if (next.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: next.trim() })
      .run();
  }

  return (
    <div className="grid gap-2">
      <Label id={id}>{label}</Label>

      <div
        className={cn(
          "rounded-4xl border border-input bg-transparent shadow-xs transition-[color,box-shadow]",
          "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
          invalid && "border-destructive focus-within:ring-destructive/20",
          disabled && "pointer-events-none opacity-50",
          CONTENT_CLASSES
        )}
      >
        <div
          role="group"
          aria-label={`${label} formatting`}
          className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1.5"
        >
          <ToolbarButton
            editor={editor}
            active={editor.isActive("bold")}
            label="Bold"
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <BoldIcon />
          </ToolbarButton>

          <ToolbarButton
            editor={editor}
            active={editor.isActive("italic")}
            label="Italic"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <ItalicIcon />
          </ToolbarButton>

          <ToolbarButton
            editor={editor}
            active={editor.isActive("underline")}
            label="Underline"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-5" />

          <ToolbarButton
            editor={editor}
            active={editor.isActive("heading", { level: 3 })}
            label="Heading"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <span className="text-xs font-semibold">H3</span>
          </ToolbarButton>

          <ToolbarButton
            editor={editor}
            active={editor.isActive("bulletList")}
            label="Bulleted list"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <ListIcon />
          </ToolbarButton>

          <ToolbarButton
            editor={editor}
            active={editor.isActive("orderedList")}
            label="Numbered list"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrderedIcon />
          </ToolbarButton>

          <ToolbarButton
            editor={editor}
            active={editor.isActive("blockquote")}
            label="Quote"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <QuoteIcon />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-5" />

          <ToolbarButton
            editor={editor}
            active={editor.isActive("link")}
            label="Link"
            onClick={setLink}
          >
            <LinkIcon />
          </ToolbarButton>

          <ToolbarButton
            editor={editor}
            active={false}
            label="Clear formatting"
            onClick={() =>
              editor.chain().focus().unsetAllMarks().clearNodes().run()
            }
          >
            <RemoveFormattingIcon />
          </ToolbarButton>
        </div>

        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
