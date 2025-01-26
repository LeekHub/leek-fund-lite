import * as vscode from 'vscode';
import type { StockData } from '../utils/fetch';
import { fetchStockData } from '../utils/fetch';
import { LeekTreeItem } from '../utils/leekTreeItem';

export class StockService implements vscode.TreeDataProvider<LeekTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    LeekTreeItem | undefined | null | void
  > = new vscode.EventEmitter<LeekTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    LeekTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private stockCodes: string[] = [];
  private stockData: StockData[] = [];

  constructor() {
    this.stockCodes = vscode.workspace
      .getConfiguration()
      .get('leek-fund-lite.stocks', []);
  }

  async refresh(): Promise<void> {
    this.stockCodes = vscode.workspace
      .getConfiguration()
      .get('leek-fund-lite.stocks', []);

    try {
      this.stockData = await fetchStockData(this.stockCodes);
      this._onDidChangeTreeData.fire();
    } catch (error) {
      console.error(`[LEEK_FUND_LITE] Failed to refresh stock data:`, error);
      vscode.window.showErrorMessage('Failed to refresh stock data');
      this._onDidChangeTreeData.fire();
    }
  }

  getTreeItem(element: LeekTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<LeekTreeItem[]> {
    if (!this.stockCodes.length) {
      return Promise.resolve([new LeekTreeItem('0', '', '', '0', 'stock')]);
    }

    const stockMap = new Map(
      this.stockData.map((stock) => [stock.code, stock])
    );

    return Promise.resolve(
      this.stockCodes.map((code) => {
        const stock = stockMap.get(code);
        if (!stock) {
          return new LeekTreeItem(code, code, '-', '0', 'stock');
        }

        const percent = (
          ((Number(stock.price) - Number(stock.yestclose)) /
            Number(stock.yestclose)) *
          100
        ).toFixed(2);

        return new LeekTreeItem(
          code,
          stock.name,
          stock.price,
          percent,
          'stock'
        );
      })
    );
  }
}
