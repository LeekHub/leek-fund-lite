import { flattenDeep } from 'lodash';
import * as vscode from 'vscode';
import type { FundData } from '../utils/fetch';
import { fetchFundData } from '../utils/fetch';
import { LeekTreeItem } from '../utils/leekTreeItem';
import { logger } from '../utils/logger';
import { FUND_CONFIG_KEY } from '../constants';

export class FundService implements vscode.TreeDataProvider<LeekTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    LeekTreeItem | undefined | null | void
  > = new vscode.EventEmitter<LeekTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    LeekTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private loading = false;
  private fundData: FundData[] = [];

  getCodes(): string[] {
    const fundCodes = vscode.workspace
      .getConfiguration()
      .get(FUND_CONFIG_KEY, []);

    return flattenDeep(fundCodes);
  }

  async addCode(code: string): Promise<void> {
    const config = vscode.workspace.getConfiguration();
    const codes = this.getCodes();
    if (!codes.includes(code)) {
      await config.update(FUND_CONFIG_KEY, [...codes, code], true);
      this.refresh();
      logger.info(`Fund ${code} added`);
    } else {
      logger.info(`Fund ${code} already exists`);
    }
    this.reload();
  }

  async deleteCode(code: string): Promise<void> {
    const config = vscode.workspace.getConfiguration();
    const codes = this.getCodes();
    if (codes.includes(code)) {
      await config.update(
        FUND_CONFIG_KEY,
        codes.filter((c) => c !== code),
        true
      );
      this.refresh();
      logger.info(`Fund ${code} deleted`);
    } else {
      logger.info(`Fund ${code} does not exist`);
    }
    this.reload();
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
      return Promise.resolve([new LeekTreeItem('0', '', '', '0', 'fund')]);
    }

    if (this.loading) {
      this.fundData = await fetchFundData(this.getCodes());
      this.loading = false;
    }

    const fundMap = new Map(this.fundData.map((fund) => [fund.code, fund]));

    return codes.map((code) => {
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
    });
  }
}
