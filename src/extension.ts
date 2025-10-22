import * as vscode from 'vscode';
import { APP_NAME } from './constants';
import { FundService } from './service/fundService';
import { StockService } from './service/stockService';
import { LeekTreeItem } from './utils/leekTreeItem';
import { logger } from './utils/logger';

export function activate(context: vscode.ExtensionContext) {
  const fundService = new FundService();
  const stockService = new StockService();

  let fundTreeView: vscode.TreeView<LeekTreeItem> | null = null;
  let stockTreeView: vscode.TreeView<LeekTreeItem> | null = null;
  let loopTimer: NodeJS.Timer | null = null;
  let refreshTimer: NodeJS.Timeout | null = null;
  let isViewVisible = false;

  const outputChannel = vscode.window.createOutputChannel(APP_NAME, {
    log: true,
  });
  logger.initOutputChannel(outputChannel);

  const refresh = () => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }

    refreshTimer = setTimeout(() => {
      fundService.reload();
      stockService.reload();
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
        logger.info('Started polling');
      }
    } else {
      if (loopTimer) {
        clearInterval(loopTimer);
        loopTimer = null;
        logger.info('Stopped polling');
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
      logger.info('Refreshing fund data...');
      await fundService.reload();
      logger.info('Fund data refreshed');
    }),
    vscode.commands.registerCommand('leek-fund-lite.refreshStock', async () => {
      logger.info('Refreshing stock data...');
      await stockService.reload();
      logger.info('Stock data refreshed');
    }),
    vscode.commands.registerCommand('leek-fund-lite.addFund', async () => {
      logger.info('Adding fund...');
      const code = await vscode.window.showInputBox({
        prompt: 'Please input fund code',
        placeHolder: 'e.g. 000001',
      });
      if (code) {
        await fundService.addCode(code);
      }
    }),
    vscode.commands.registerCommand('leek-fund-lite.addStock', async () => {
      logger.info('Adding stock...');
      const qp = vscode.window.createQuickPick();
      qp.placeholder = 'Please input stock code or name';
      qp.show();
      const stockList = await stockService.getStockList();
      qp.items = stockList.map((item) => ({
        label: `${item.code} | ${item.name}`,
      }));
      let code: string | undefined;
      qp.onDidChangeSelection((e) => {
        if (e[0].label) {
          code = e[0].label.split('|')[0].trim();
        }
      });
      qp.onDidAccept(async () => {
        if (code) {
          await stockService.addCode(code);
        }
        qp.hide();
        qp.dispose();
      });
    }),
    vscode.commands.registerCommand(
      'leek-fund-lite.deleteFund',
      async (item: LeekTreeItem) => item && fundService.deleteCode(item.code)
    ),
    vscode.commands.registerCommand(
      'leek-fund-lite.deleteStock',
      async (item: LeekTreeItem) => item && stockService.deleteCode(item.code)
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
      logger.info('Extension is now deactivated');
    },
  });

  logger.info('Extension is now active!');
}

export function deactivate() {
  // Cleanup is handled by the dispose function registered in subscriptions
}
