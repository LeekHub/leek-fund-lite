import * as vscode from 'vscode';
import { FundService } from './service/fundService';
import { StockService } from './service/stockService';
import { LeekTreeItem } from './utils/leekTreeItem';

export function activate(context: vscode.ExtensionContext) {
  const fundService = new FundService();
  const stockService = new StockService();

  let fundTreeView: vscode.TreeView<LeekTreeItem> | null = null;
  let stockTreeView: vscode.TreeView<LeekTreeItem> | null = null;
  let loopTimer: NodeJS.Timer | null = null;
  let refreshTimer: NodeJS.Timeout | null = null;
  let isViewVisible = false;

  const refresh = () => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }

    refreshTimer = setTimeout(() => {
      fundService.refresh();
      stockService.refresh();
      refreshTimer = null;
    }, 100);
  };

  const updatePolling = () => {
    const interval = vscode.workspace
      .getConfiguration()
      .get('leek-fund-lite.interval', 10000);

    if (isViewVisible) {
      if (!loopTimer) {
        loopTimer = setInterval(refresh, interval);
        console.log('[LEEK_FUND_LITE] Started polling');
      }
    } else {
      if (loopTimer) {
        clearInterval(loopTimer);
        loopTimer = null;
        console.log('[LEEK_FUND_LITE] Stopped polling');
      }
    }
  };

  fundTreeView = vscode.window.createTreeView('leekFundLite.fund', {
    treeDataProvider: fundService,
  });

  stockTreeView = vscode.window.createTreeView('leekFundLite.stock', {
    treeDataProvider: stockService,
  });

  // Watch for view visibility changes
  context.subscriptions.push(
    fundTreeView.onDidChangeVisibility(() => {
      isViewVisible = fundTreeView?.visible || stockTreeView?.visible || false;
      if (isViewVisible) {
        refresh();
      }
      updatePolling();
    }),
    stockTreeView.onDidChangeVisibility(() => {
      isViewVisible = fundTreeView?.visible || stockTreeView?.visible || false;
      updatePolling();
    })
  );

  // Initial visibility check
  isViewVisible = fundTreeView?.visible || stockTreeView?.visible || false;
  if (isViewVisible) {
    refresh();
  }
  updatePolling();

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('leek-fund-lite.refreshFund', async () => {
      console.log('[LEEK_FUND_LITE] Refreshing fund data...');
      await fundService.refresh();
      console.log('[LEEK_FUND_LITE] Fund data refreshed');
    }),
    vscode.commands.registerCommand('leek-fund-lite.refreshStock', async () => {
      console.log('[LEEK_FUND_LITE] Refreshing stock data...');
      await stockService.refresh();
      console.log('[LEEK_FUND_LITE] Stock data refreshed');
    }),
    vscode.commands.registerCommand('leek-fund-lite.addFund', async () => {
      console.log('[LEEK_FUND_LITE] Adding fund...');
      const code = await vscode.window.showInputBox({
        prompt: 'Please input fund code',
        placeHolder: 'e.g. 000001',
      });
      if (code) {
        const config = vscode.workspace.getConfiguration();
        const funds = config.get<string[]>('leek-fund-lite.funds', []);
        if (!funds.includes(code)) {
          await config.update('leek-fund-lite.funds', [...funds, code], true);
          console.log(`[LEEK_FUND_LITE] Fund ${code} added`);
          fundService.refresh();
        }
      }
    }),
    vscode.commands.registerCommand('leek-fund-lite.addStock', async () => {
      console.log('[LEEK_FUND_LITE] Adding stock...');
      const code = await vscode.window.showInputBox({
        prompt: 'Please input stock code',
        placeHolder: 'e.g. sh000001',
      });
      if (code) {
        const config = vscode.workspace.getConfiguration();
        const stocks = config.get<string[]>('leek-fund-lite.stocks', []);
        if (!stocks.includes(code)) {
          await config.update('leek-fund-lite.stocks', [...stocks, code], true);
          console.log(`[LEEK_FUND_LITE] Stock ${code} added`);
          stockService.refresh();
        }
      }
    }),
    vscode.commands.registerCommand(
      'leek-fund-lite.deleteFund',
      async (item) => {
        if (item) {
          console.log('[LEEK_FUND_LITE] Deleting fund...');
          const config = vscode.workspace.getConfiguration();
          const funds = config.get<string[]>('leek-fund-lite.funds', []);
          await config.update(
            'leek-fund-lite.funds',
            funds.filter((code) => code !== item.code),
            true
          );
          console.log(`[LEEK_FUND_LITE] Fund ${item.code} deleted`);
          fundService.refresh();
        }
      }
    ),
    vscode.commands.registerCommand(
      'leek-fund-lite.deleteStock',
      async (item) => {
        if (item) {
          console.log('[LEEK_FUND_LITE] Deleting stock...');
          const config = vscode.workspace.getConfiguration();
          const stocks = config.get<string[]>('leek-fund-lite.stocks', []);
          await config.update(
            'leek-fund-lite.stocks',
            stocks.filter((code) => code !== item.code),
            true
          );
          console.log(`[LEEK_FUND_LITE] Stock ${item.code} deleted`);
          stockService.refresh();
        }
      }
    )
  );

  // Cleanup function
  context.subscriptions.push({
    dispose: () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
      }
      if (loopTimer) {
        clearInterval(loopTimer);
        loopTimer = null;
      }
      if (fundTreeView) {
        fundTreeView.dispose();
        fundTreeView = null;
      }
      if (stockTreeView) {
        stockTreeView.dispose();
        stockTreeView = null;
      }
      console.log('[LEEK_FUND_LITE] Extension is now deactivated');
    },
  });

  console.log('[LEEK_FUND_LITE] Extension is now active!');
}

export function deactivate() {
  // Cleanup is handled by the dispose function registered in subscriptions
}
