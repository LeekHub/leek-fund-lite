import * as vscode from 'vscode';

function padRight(text: string, length: number): string {
  return text + ' '.repeat(Math.max(length - text?.length || 0, 0));
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

    const percentNum = parseFloat(percent);
    const icon = percentNum >= 0 ? '📈' : '📉';

    if (code === '0') {
      this.label = 'No ' + type + ' code configured';
      this.contextValue = undefined;
      return;
    }

    this.label = `${padRight(icon, 4)}${padRight(
      percentNum + '%',
      11
    )}${padRight(String(price || '-'), 15)}「${name || '-'}」`;
    this.description = '';
    this.contextValue = type === 'fund' ? 'fundItem' : 'stockItem';
  }
}
