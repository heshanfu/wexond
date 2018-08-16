import { remote } from 'electron';
import { observer } from 'mobx-react';
import { resolve } from 'path';
import React from 'react';

import { PageMenuMode } from '../../../../enums';
import { Tab } from '../../../../models';
import {
  createTab,
  getCurrentWorkspace,
  getIpcTab,
  getTabById,
} from '../../../../utils';
import store from '../../../store';
import StyledPage from './styles';
import { Page } from '../../../../interfaces';

@observer
export default class extends React.Component<{ page: Page }, {}> {
  private lastURL = '';

  private lastHistoryItemID = -1;

  private webview: Electron.WebviewTag;

  private tab: Tab;

  private onURLChange: any;

  private listeners: { name: string; callback: any }[] = [];

  public componentDidMount() {
    const { page } = this.props;
    const { id } = page;
    const tab = getTabById(id);

    this.tab = tab;

    this.addWebviewListener('did-stop-loading', this.onDidStopLoading);
    this.addWebviewListener('did-start-loading', this.onDidStartLoading);
    this.addWebviewListener('page-title-updated', this.onPageTitleUpdated);
    this.addWebviewListener('load-commit', this.onLoadCommit);
    this.webview.addEventListener('load-commit', this.onceLoadCommit);
    this.addWebviewListener('page-favicon-updated', this.onPageFaviconUpdated);
    this.addWebviewListener('dom-ready', this.onDomReady);
    this.addWebviewListener('enter-html-full-screen', this.onFullscreenEnter);
    this.addWebviewListener('leave-html-full-screen', this.onFullscreenLeave);
    this.addWebviewListener('new-window', this.onNewWindow);
    this.addWebviewListener('did-navigate', this.onDidNavigate);
    this.addWebviewListener('will-navigate', this.onWillNavigate);
    this.addWebviewListener('ipc-message', this.onIpcMessage);
  }

  public componentWillUnmount() {
    for (const listener of this.listeners) {
      this.webview.removeEventListener(listener.name, listener.callback);
    }

    this.listeners = [];

    clearInterval(this.onURLChange);

    store.isFullscreen = false;
  }

  public onceLoadCommit = () => {
    // Custom event: fires when webview URL changes.
    this.onURLChange = setInterval(() => {
      if (this.webview.getWebContents()) {
        const url = this.webview.getURL();
        if (url !== this.tab.url) {
          this.tab.url = url;
          this.emitEvent(
            'tabs',
            'onUpdated',
            this.tab.id,
            {
              url,
            },
            getIpcTab(this.tab),
          );
          this.updateData();
          store.isBookmarked = !!store.bookmarks.find(x => x.url === url);
        }
      }
    }, 30);

    this.webview.removeEventListener('load-commit', this.onceLoadCommit);
  };

  public addWebviewListener(name: string, callback: any) {
    this.webview.addEventListener(name, callback);
    this.listeners.push({ name, callback });
  }

  public emitEvent = (scope: string, name: string, ...data: any[]) => {
    this.webview
      .getWebContents()
      .send(`api-emit-event-${scope}-${name}`, ...data);

    const backgroundPages = remote.getGlobal('backgroundPages');

    Object.keys(backgroundPages).forEach(key => {
      const webContents = remote.webContents.fromId(
        backgroundPages[key].webContentsId,
      );
      webContents.send(`api-emit-event-${scope}-${name}`, ...data);
    });
  };

  public onIpcMessage = (e: Electron.IpcMessageEvent, args: any[]) => {
    if (e.channel === 'api-tabs-getCurrent') {
      this.webview
        .getWebContents()
        .send('api-tabs-getCurrent', getIpcTab(this.tab));
    }
  };

  public onWillNavigate = (e: Electron.WillNavigateEvent) => {
    this.emitEvent('webNavigation', 'onBeforeNavigate', {
      tabId: this.tab.id,
      url: e.url,
      frameId: 0,
      timeStamp: Date.now(),
      processId: -1,
      parentFrameId: -1,
    });
  };

  public onDidStartLoading = () => {
    this.emitEvent('webNavigation', 'onCommitted', {
      tabId: this.tab.id,
      url: this.webview.getURL(),
      frameId: 0,
      timeStamp: Date.now(),
      processId: this.webview.getWebContents().getOSProcessId(),
    });

    this.emitEvent(
      'tabs',
      'onUpdated',
      this.tab.id,
      {
        status: 'loading',
      },
      getIpcTab(this.tab),
    );
  };

  public onDidNavigate = (e: Electron.DidNavigateEvent) => {
    this.emitEvent('webNavigation', 'onCompleted', {
      tabId: this.tab.id,
      url: e.url,
      frameId: 0,
      timeStamp: Date.now(),
      processId: this.webview.getWebContents().getOSProcessId(),
    });

    this.emitEvent(
      'tabs',
      'onUpdated',
      this.tab.id,
      {
        status: 'complete',
      },
      getIpcTab(this.tab),
    );
  };

  public onDomReady = () => {
    this.webview.getWebContents().on('context-menu', this.onContextMenu);
    this.emitEvent('webNavigation', 'onDOMContentLoaded', {
      tabId: this.tab.id,
      url: this.webview.getURL(),
      frameId: 0,
      timeStamp: Date.now(),
      processId: this.webview.getWebContents().getOSProcessId(),
    });
  };

  public onNewWindow = (e: Electron.NewWindowEvent) => {
    let tab: Tab;

    if (e.disposition === 'new-window' || e.disposition === 'foreground-tab') {
      tab = createTab({ url: e.url, active: true });
    } else if (e.disposition === 'background-tab') {
      tab = createTab({ url: e.url, active: false });
    }

    this.emitEvent('webNavigation', 'onCreatedNavigationTarget', {
      sourceTabId: this.tab.id,
      sourceProcessId: this.webview.getWebContents().getOSProcessId(),
      sourceFrameId: 0,
      timeStamp: Date.now(),
      url: e.url,
      tabId: tab,
    });
  };

  public onContextMenu = (
    e: Electron.Event,
    params: Electron.ContextMenuParams,
  ) => {
    store.pageMenuVisible = true;

    store.webviewContextMenuParams = params;

    if (params.linkURL && params.hasImageContents) {
      store.pageMenuData.mode = PageMenuMode.ImageAndURL;
    } else if (params.linkURL) {
      store.pageMenuData.mode = PageMenuMode.URL;
    } else if (params.hasImageContents) {
      store.pageMenuData.mode = PageMenuMode.Image;
    } else {
      store.pageMenuData.mode = PageMenuMode.Normal;
    }

    // Calculate new menu position
    // using cursor x, y and
    // width, height of the menu.
    const x = store.mouse.x;
    const y = store.mouse.y;

    // By default it opens menu from upper left corner.
    let left = x;
    let top = y;

    const width = 3 * 64;
    const height = store.pageMenu.getHeight();

    // Open menu from right corner.
    if (left + width > window.innerWidth) {
      left = x - width;
    }

    // Open menu from bottom corner.
    if (top + height > window.innerHeight) {
      top = y - height;
    }

    if (top < 0) {
      top = 96;
    }

    // Set the new position.
    store.pageMenuData.x = left;
    store.pageMenuData.y = top;
  };

  public onDidStopLoading = () => {
    store.refreshNavigationState();
    this.tab.loading = false;
  };

  public onLoadCommit = async ({
    url,
    isMainFrame,
  }: Electron.LoadCommitEvent) => {
    this.tab.loading = true;

    if (url !== this.lastURL && isMainFrame && !url.startsWith('wexond://')) {
      // TODO: nedb
      /*database.transaction('rw', database.history, async () => {
        const id = await database.history.add({
          title: this.tab.title,
          url,
          favicon: this.tab.favicon,
          date: new Date().toString(),
        });

        this.lastHistoryItemID = id;
      });*/

      this.lastURL = url;
    }
  };

  public onPageFaviconUpdated = ({
    favicons,
  }: Electron.PageFaviconUpdatedEvent) => {
    const request = new XMLHttpRequest();
    request.onreadystatechange = async () => {
      if (request.readyState === 4) {
        if (request.status === 404) {
          this.tab.favicon = '';
        } else {
          this.tab.favicon = favicons[0];
          // TODO: nedb
          // database.addFavicon(favicons[0]);
        }
      }
      this.updateData();
    };

    this.emitEvent(
      'tabs',
      'onUpdated',
      this.tab.id,
      {
        favIconUrl: favicons[0],
      },
      getIpcTab(this.tab),
    );

    request.open('GET', favicons[0], true);
    request.send(null);
  };

  public updateData = () => {
    if (this.lastURL === this.tab.url) {
      if (this.lastHistoryItemID !== -1) {
        // TODO: nedb
        /*database.transaction('rw', database.history, async () => {
          database.history
            .where('id')
            .equals(this.lastHistoryItemID)
            .modify({
              title: this.tab.title,
              url: this.webview.getURL(),
              favicon: this.tab.favicon,
            });
        });*/
      }
    }
  };

  public onPageTitleUpdated = ({ title }: Electron.PageTitleUpdatedEvent) => {
    const { page } = this.props;
    const { id } = page;
    const tab = getTabById(id);

    tab.title = title;
    this.updateData();

    this.emitEvent(
      'tabs',
      'onUpdated',
      this.tab.id,
      {
        title,
      },
      getIpcTab(this.tab),
    );
  };

  public onFullscreenEnter = () => {
    store.isHTMLFullscreen = true;
  };

  public onFullscreenLeave = () => {
    store.isHTMLFullscreen = false;
  };

  public render() {
    const { page } = this.props;
    const { url, id } = page;

    return (
      <StyledPage selected={getCurrentWorkspace().selectedTab === id}>
        <webview
          src={url}
          style={{
            height: '100%',
          }}
          ref={(r: Electron.WebviewTag) => {
            page.webview = r;
            this.webview = r;
          }}
          preload={`file://${resolve(
            remote.app.getAppPath(),
            'build/webview-preload.js',
          )}`}
          allowFullScreen
        />
      </StyledPage>
    );
  }
}