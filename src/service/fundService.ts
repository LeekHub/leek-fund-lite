import * as vscode from 'vscode';
import { fetchFundData } from '../utils/fetch';
import type { FundData } from '../utils/fetch';
import { LeekTreeItem } from '../utils/leekTreeItem';

export class FundService implements vscode.TreeDataProvider<LeekTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    LeekTreeItem | undefined | null | void
  > = new vscode.EventEmitter<LeekTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    LeekTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private fundCodes: string[] = [];
  private fundData: FundData[] = [];

  constructor() {
    this.fundCodes = vscode.workspace
      .getConfiguration()
      .get('leek-fund-lite.funds', []);
  }

  async refresh(): Promise<void> {
    this.fundCodes = vscode.workspace
      .getConfiguration()
      .get('leek-fund-lite.funds', []);
    try {
      this.fundData = await fetchFundData(this.fundCodes);
      this._onDidChangeTreeData.fire();
    } catch (error) {
      console.error(`[LEEK_FUND_LITE] Failed to refresh fund data:`, error);
      vscode.window.showErrorMessage('Failed to refresh fund data');
      this._onDidChangeTreeData.fire();
    }
  }

  getTreeItem(element: LeekTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<LeekTreeItem[]> {
    if (!this.fundCodes.length) {
      return Promise.resolve([new LeekTreeItem('0', '', '', '0', 'fund')]);
    }

    const fundMap = new Map(this.fundData.map((fund) => [fund.code, fund]));

    return Promise.resolve(
      this.fundCodes.map((code) => {
        const fund = fundMap.get(code);
        if (!fund) {
          return new LeekTreeItem(code, code, '-', '0', 'fund');
        }

        return new LeekTreeItem(
          fund.code,
          fund.name,
          fund.estimatedWorth,
          fund.estimatedWorthPercent,
          'fund'
        );
      })
    );
  }
}
