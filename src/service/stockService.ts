import { flattenDeep } from 'lodash';
import * as vscode from 'vscode';
import type { StockData, StockSuggestItem } from '../utils/fetch';
import { fetchStockData, fetchStockList } from '../utils/fetch';
import { LeekTreeItem } from '../utils/leekTreeItem';
import { logger } from '../utils/logger';
import { STOCK_CONFIG_KEY } from '../constants';

export class StockService implements vscode.TreeDataProvider<LeekTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    LeekTreeItem | undefined | null | void
  > = new vscode.EventEmitter<LeekTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    LeekTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private loading = false;
  private stockData: StockData[] = [];
  private stockList: StockSuggestItem[] | null = null;

  getCodes(): string[] {
    const fundCodes = vscode.workspace
      .getConfiguration()
      .get(STOCK_CONFIG_KEY, []);

    return flattenDeep(fundCodes);
  }

  async addCode(code: string): Promise<void> {
    const config = vscode.workspace.getConfiguration();
    const codes = this.getCodes();
    if (!codes.includes(code)) {
      await config.update(STOCK_CONFIG_KEY, [...codes, code], true);
      this.refresh();
      logger.info(`Stock ${code} added`);
    } else {
      logger.info(`Stock ${code} already exists`);
    }
    this.reload();
  }

  async deleteCode(code: string): Promise<void> {
    const config = vscode.workspace.getConfiguration();
    const codes = this.getCodes();
    if (codes.includes(code)) {
      await config.update(
        STOCK_CONFIG_KEY,
        codes.filter((c) => c !== code),
        true
      );
      this.refresh();
      logger.info(`Stock ${code} deleted`);
    } else {
      logger.info(`Stock ${code} does not exist`);
    }
    this.reload();
  }

  private async moveCodeByOffset(
    code: string,
    offset: number
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration();
    const codes = this.getCodes();
    const currentIndex = codes.indexOf(code);
    if (currentIndex === -1) {
      logger.info(`Stock ${code} does not exist`);
      return;
    }

    const targetIndex = currentIndex + offset;
    if (targetIndex < 0 || targetIndex >= codes.length) {
      return;
    }

    const newCodes = [...codes];
    newCodes.splice(currentIndex, 1);
    newCodes.splice(targetIndex, 0, code);

    await config.update(STOCK_CONFIG_KEY, newCodes, true);
    logger.info(`Stock ${code} moved ${offset < 0 ? 'up' : 'down'}`);
    this.refresh();
  }

  async moveCodeUp(code: string): Promise<void> {
    await this.moveCodeByOffset(code, -1);
  }

  async moveCodeDown(code: string): Promise<void> {
    await this.moveCodeByOffset(code, 1);
  }

  async reload(): Promise<void> {
    if (this.loading) {
      return;
    }

    this.loading = true;
    this._onDidChangeTreeData.fire();
  }

  async refresh(): Promise<void> {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: LeekTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<LeekTreeItem[]> {
    const codes = this.getCodes();

    if (!codes.length) {
      return Promise.resolve([new LeekTreeItem('0', '', '', '0', 'stock')]);
    }

    if (this.loading) {
      this.stockData = await fetchStockData(codes);
      this.loading = false;
    }

    const stockMap = new Map(
      this.stockData.map((stock) => [stock.code, stock])
    );

    return codes.map((code) => {
      const stock = stockMap.get(code);
      if (!stock) {
        return new LeekTreeItem(code, code, '-', '0', 'stock');
      }

      const percent = (
        ((Number(stock.price) - Number(stock.yestclose)) /
          Number(stock.yestclose)) *
        100
      ).toFixed(2);

      return new LeekTreeItem(code, stock.name, stock.price, percent, 'stock');
    });
  }

  async getStockList(): Promise<StockSuggestItem[]> {
    if (!this.stockList) {
      this.stockList = await fetchStockList();
    }
    return this.stockList;
  }
}
