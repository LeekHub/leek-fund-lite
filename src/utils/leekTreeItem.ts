import * as vscode from 'vscode';

function padRight(text: string, length: number): string {
  return text + ' '.repeat(Math.max(length - text?.length || 0, 0));
}

function padLeft(text: string, length: number): string {
  return ' '.repeat(Math.max(length - text?.length || 0, 0)) + text;
}

export class LeekTreeItem extends vscode.TreeItem {
  constructor(
    public readonly code: string,
    public readonly name: string,
    public readonly price: string,
    public readonly percent: string,
    public readonly type: 'fund' | 'stock'
  ) {
    super(name);

    const percentNum = parseFloat(percent) || 0;
    const icon = percentNum >= 0 ? '🔴' : '🟢';

    if (code === '0') {
      this.label = 'No ' + type + ' code configured';
      this.contextValue = undefined;
      return;
    }

    this.label = `${padRight(icon, 4)}${padRight(
      (percentNum >= 0 ? ' ' : '') + percentNum.toFixed(2) + '%',
      10
    )}${padLeft((parseFloat(price) || 0).toFixed(4), 16)}${padLeft('', 12)} ${
      name || '-'
    }`;
    this.description = '';
    this.contextValue = type === 'fund' ? 'fundItem' : 'stockItem';
  }
}
