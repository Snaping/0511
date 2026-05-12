import { marked } from 'marked';

export async function summarizeContent(htmlContent: string): Promise<{
  summary: string;
  keyPoints: string[];
  actionItems: string[];
}> {
  const plainText = stripHtml(htmlContent);
  const words = plainText.split(/\s+/).filter(w => w.length > 0);
  const sentences = plainText.split(/[.!?。！？]+/).filter(s => s.trim().length > 0);

  const summary = generateSummary(sentences);
  const keyPoints = extractKeyPoints(plainText, sentences);
  const actionItems = extractActionItems(plainText);

  return { summary, keyPoints, actionItems };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function generateSummary(sentences: string[]): string {
  if (sentences.length === 0) {
    return '文档内容较少，无需总结。';
  }

  const topSentences = sentences
    .map(s => s.trim())
    .filter(s => s.length > 10)
    .slice(0, 3);

  if (topSentences.length === 0) {
    return '文档内容较少，主要包含简短的笔记或待办事项。';
  }

  return `该文档包含${sentences.length}个句子，核心内容为：${topSentences.join('。')}。`;
}

function extractKeyPoints(text: string, sentences: string[]): string[] {
  const keywords = ['重要', '关键', '注意', '必须', '核心', '核心', '主要', '重点', '记住', 'TODO', '关键', 'important', 'key', 'note'];
  const keyPoints: string[] = [];

  sentences.forEach(sentence => {
    const lower = sentence.toLowerCase();
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        keyPoints.push(sentence.trim());
        break;
      }
    }
  });

  if (keyPoints.length === 0 && sentences.length > 0) {
    keyPoints.push(
      ...sentences
        .map(s => s.trim())
        .filter(s => s.length > 15)
        .slice(0, 3)
    );
  }

  return keyPoints.slice(0, 5);
}

function extractActionItems(text: string): string[] {
  const actionKeywords = [
    '需要', '应该', '必须', '计划', '安排', '待办', 'TODO', 'todo',
    'need', 'should', 'must', 'plan', '安排', '要做', 'action', '请',
    '[]', '[ ]', '- [ ]', '待办事项'
  ];

  const lines = text.split(/\n/);
  const actionItems: string[] = [];

  lines.forEach(line => {
    const lower = line.toLowerCase();
    for (const kw of actionKeywords) {
      if (lower.includes(kw.toLowerCase())) {
        const trimmed = line.trim();
        if (trimmed.length > 5 && trimmed.length < 200) {
          actionItems.push(trimmed);
        }
        break;
      }
    }
  });

  return actionItems.slice(0, 10);
}
