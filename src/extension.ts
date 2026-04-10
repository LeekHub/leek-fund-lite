import * as vscode from 'vscode';
import { APP_NAME } from './constants';
import { FundService } from './service/fundService';
import { StockService } from './service/stockService';
import { SyncService } from './service/syncService';
import { LeekTreeItem } from './utils/leekTreeItem';
import { logger } from './utils/logger';

export function activate(context: vscode.ExtensionContext) {
  const fundService = new FundService();
  const stockService = new StockService();
  const syncService = new SyncService(context, fundService, stockService);

  let fundTreeView: vscode.TreeView<LeekTreeItem> | null = null;
  let stockTreeView: vscode.TreeView<LeekTreeItem> | null = null;
  let loopTimer: NodeJS.Timer | null = null;
  let refreshTimer: NodeJS.Timeout | null = null;
  let isViewVisible = false;

  const outputChannel = vscode.window.createOutputChannel(APP_NAME, {
    log: true,
  });
  logger.initOutputChannel(outputChannel);

  const updateGitHubContext = async () => {
    const hasToken = await syncService.hasGitHubToken();
    await vscode.commands.executeCommand(
      'setContext',
      'leekFundLite.githubLoggedIn',
      hasToken
    );
  };

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
  updateGitHubContext();

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
      const originalItems = stockList.map((item) => ({
        label: `${item.code} | ${item.name}`,
      }));
      qp.items = originalItems;
      let code: string | undefined;
      qp.onDidChangeSelection((e) => {
        if (e[0].label) {
          code = e[0].label.split('|')[0].trim();
        }
      });
      qp.onDidChangeValue((value) => {
        const trimmedValue = value.trim();
        if (trimmedValue) {
          code = trimmedValue;
          const filteredItems = originalItems.filter((item) =>
            item.label.toLowerCase().includes(trimmedValue.toLowerCase())
          );
          const customItem = {
            label: `${trimmedValue} | 自定义代码`,
          };
          if (!filteredItems.some((item) => item.label.startsWith(trimmedValue + ' |'))) {
            qp.items = [customItem, ...filteredItems];
          } else {
            qp.items = filteredItems;
          }
        } else {
          qp.items = originalItems;
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
      'leek-fund-lite.moveStockUp',
      async (item: LeekTreeItem) => item && stockService.moveCodeUp(item.code)
    ),
    vscode.commands.registerCommand(
      'leek-fund-lite.moveStockDown',
      async (item: LeekTreeItem) => item && stockService.moveCodeDown(item.code)
    ),
    vscode.commands.registerCommand(
      'leek-fund-lite.deleteStock',
      async (item: LeekTreeItem) => item && stockService.deleteCode(item.code)
    ),
    vscode.commands.registerCommand('leek-fund-lite.githubActions', async () => {
      try {
        const hasToken = await syncService.hasGitHubToken();
        const actions: vscode.QuickPickItem[] = hasToken
          ? [
              { label: 'Upload', description: 'Upload local data to GitHub Gist' },
              { label: 'Download', description: 'Download data from GitHub Gist' },
              { label: 'Logout', description: 'Clear saved GitHub token' },
            ]
          : [
              { label: 'Login', description: 'Save GitHub personal token' },
              { label: 'Upload', description: 'Upload local data to GitHub Gist' },
              { label: 'Download', description: 'Download data from GitHub Gist' },
            ];

        const selected = await vscode.window.showQuickPick(actions, {
          title: 'GitHub',
          ignoreFocusOut: true,
        });

        if (!selected) {
          return;
        }

        if (selected.label === 'Login') {
          const saved = await syncService.githubLogin();
          if (saved) {
            await updateGitHubContext();
          }
          return;
        }

        if (selected.label === 'Logout') {
          await syncService.githubLogout();
          await updateGitHubContext();
          return;
        }

        if (selected.label === 'Upload') {
          await syncService.githubUpload();
          await updateGitHubContext();
          return;
        }

        if (selected.label === 'Download') {
          await syncService.githubDownload();
          await updateGitHubContext();
        }
      } catch (error) {
        logger.error('GitHub actions failed', error);
        vscode.window.showErrorMessage(
          error instanceof Error ? error.message : 'GitHub actions failed'
        );
      }
    }),
    vscode.commands.registerCommand('leek-fund-lite.githubLogin', async () => {
      try {
        const saved = await syncService.githubLogin();
        if (saved) {
          await updateGitHubContext();
        }
      } catch (error) {
        logger.error('GitHub login failed', error);
        vscode.window.showErrorMessage(
          error instanceof Error ? error.message : 'GitHub login failed'
        );
      }
    }),
    vscode.commands.registerCommand('leek-fund-lite.githubLogout', async () => {
      try {
        await syncService.githubLogout();
        await updateGitHubContext();
      } catch (error) {
        logger.error('GitHub logout failed', error);
        vscode.window.showErrorMessage(
          error instanceof Error ? error.message : 'GitHub logout failed'
        );
      }
    }),
    vscode.commands.registerCommand('leek-fund-lite.githubUpload', async () => {
      try {
        await syncService.githubUpload();
      } catch (error) {
        logger.error('GitHub upload failed', error);
        vscode.window.showErrorMessage(
          error instanceof Error ? error.message : 'GitHub upload failed'
        );
      }
    }),
    vscode.commands.registerCommand('leek-fund-lite.githubDownload', async () => {
      try {
        await syncService.githubDownload();
      } catch (error) {
        logger.error('GitHub download failed', error);
        vscode.window.showErrorMessage(
          error instanceof Error ? error.message : 'GitHub download failed'
        );
      }
    })
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
