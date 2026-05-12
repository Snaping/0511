import { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link,
  Image,
  Undo,
  Redo,
  Minus,
  CheckSquare,
} from 'lucide-react';

interface ToolbarProps {
  editor: Editor;
}

const ToolButton = ({
  onClick,
  active,
  disabled,
  children,
  title,
}: {
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title?: string;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`p-2 rounded hover:bg-gray-100 transition-colors ${
      active ? 'bg-gray-100 text-blue-600' : 'text-gray-700'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    {children}
  </button>
);

const Divider = () => <div className="w-px h-6 bg-gray-200 mx-1" />;

export default function Toolbar({ editor }: ToolbarProps) {
  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('输入链接地址', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  };

  const addImage = () => {
    const url = window.prompt('输入图片地址');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  return (
    <div className="border-b border-gray-200 px-2 py-2 flex flex-wrap items-center gap-1">
      <ToolButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="撤销">
        <Undo className="w-4 h-4" />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="重做">
        <Redo className="w-4 h-4" />
      </ToolButton>

      <Divider />

      <ToolButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="粗体"
      >
        <Bold className="w-4 h-4" />
      </ToolButton>
      <ToolButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="斜体"
      >
        <Italic className="w-4 h-4" />
      </ToolButton>
      <ToolButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
        title="下划线"
      >
        <Underline className="w-4 h-4" />
      </ToolButton>
      <ToolButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        title="删除线"
      >
        <Strikethrough className="w-4 h-4" />
      </ToolButton>
      <ToolButton
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        active={editor.isActive('highlight')}
        title="高亮"
      >
        <Highlighter className="w-4 h-4" />
      </ToolButton>
      <ToolButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        title="行内代码"
      >
        <Code className="w-4 h-4" />
      </ToolButton>

      <Divider />

      <ToolButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })}
        title="标题1"
      >
        <Heading1 className="w-4 h-4" />
      </ToolButton>
      <ToolButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title="标题2"
      >
        <Heading2 className="w-4 h-4" />
      </ToolButton>
      <ToolButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        title="标题3"
      >
        <Heading3 className="w-4 h-4" />
      </ToolButton>

      <Divider />

      <ToolButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="无序列表"
      >
        <List className="w-4 h-4" />
      </ToolButton>
      <ToolButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="有序列表"
      >
        <ListOrdered className="w-4 h-4" />
      </ToolButton>
      <ToolButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        active={editor.isActive('taskList')}
        title="任务列表"
      >
        <CheckSquare className="w-4 h-4" />
      </ToolButton>

      <Divider />

      <ToolButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        title="引用"
      >
        <Quote className="w-4 h-4" />
      </ToolButton>
      <ToolButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive('codeBlock')}
        title="代码块"
      >
        <Code className="w-4 h-4" />
      </ToolButton>
      <ToolButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="分隔线"
      >
        <Minus className="w-4 h-4" />
      </ToolButton>

      <Divider />

      <ToolButton
        onClick={setLink}
        active={editor.isActive('link')}
        title="插入链接"
      >
        <Link className="w-4 h-4" />
      </ToolButton>
      <ToolButton onClick={addImage} title="插入图片">
        <Image className="w-4 h-4" />
      </ToolButton>
    </div>
  );
}
