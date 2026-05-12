import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import type { Connection } from '../lib/collab';
import Toolbar from './Toolbar';

const lowlight = createLowlight(common);

interface CollabEditorProps {
  connection: Connection | null;
  onContentChange?: () => void;
  editorRef?: React.MutableRefObject<any>;
}

export default function CollabEditor({ connection, onContentChange, editorRef }: CollabEditorProps) {
  const syncedRef = useRef(false);
  const isApplyingRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder: '开始输入内容...',
      }),
      Highlight,
      Underline,
      Link.configure({
        openOnClick: false,
      }),
      Image.configure({ inline: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content: '',
    onUpdate: () => {
      onContentChange?.();
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editorRef && editor) {
      editorRef.current = editor;
    }
  }, [editor, editorRef]);

  useEffect(() => {
    if (!connection || !editor) return;

    const { doc } = connection;
    const yJson = doc.getMap('editorContent');

    const syncFromYjs = () => {
      const stored = yJson.get('json');
      if (stored && typeof stored === 'object' && (stored as any).type === 'doc') {
        isApplyingRef.current = true;
        (editor.commands as any).setContent(stored as any, false);
        setTimeout(() => { isApplyingRef.current = false; }, 0);
      }
    };

    const syncToYjs = () => {
      if (isApplyingRef.current) return;
      const json = editor.getJSON();
      doc.transact(() => {
        yJson.set('json', json as any);
      });
    };

    if (!syncedRef.current) {
      syncFromYjs();
      syncedRef.current = true;
    }

    const yObserver = () => {
      syncFromYjs();
    };

    yJson.observe(yObserver);

    const unbindUpdate = editor.on('update', ({ transaction }) => {
      if (transaction.docChanged) {
        syncToYjs();
      }
    });

    return () => {
      yJson.unobserve(yObserver);
      (unbindUpdate as any)();
    };
  }, [connection, editor]);

  if (!editor) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <Toolbar editor={editor} />
      <div className="px-8 py-4">
        <EditorContent editor={editor} className="min-h-[500px] max-w-none" />
      </div>
    </div>
  );
}
