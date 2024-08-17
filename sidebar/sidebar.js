document.addEventListener('DOMContentLoaded', () => {
  const groupTabsButton = document.getElementById('groupTabs');
  const buttonTextElement = document.getElementById('buttonText');
  const spinnerElement = document.getElementById('spinner');
  const tabGroupsElement = document.getElementById('tabGroups');

  // Load and display current tabs when the sidebar opens
  loadCurrentTabs();

  groupTabsButton.addEventListener('click', () => {
    buttonTextElement.textContent = 'Grouping tabs...';
    spinnerElement.style.display = 'inline-block';
    groupTabsButton.disabled = true;

    const selectedAPI = document.getElementById('apiSelect').value;
    browser.runtime.sendMessage({ action: 'groupTabs', selectedAPI: selectedAPI });
  });

  browser.runtime.onMessage.addListener((message) => {
    if (message.status) {
      buttonTextElement.textContent = message.status;
    }
    if (message.output) {
      spinnerElement.style.display = 'none';
      buttonTextElement.textContent = 'Group Tabs';
      groupTabsButton.disabled = false;
      displayGroupedTabs(message.output);
    }
    if (message.error) {
      spinnerElement.style.display = 'none';
      buttonTextElement.textContent = 'Error: ' + message.error;
      groupTabsButton.disabled = false;
    }
    if (message.action === 'tabCreated') {
      handleNewTab(message.tab, message.parentTabId, message.hasParent);
    } else if (message.action === 'tabActivated') {
      updateActiveTab(message.tabId);
    } else if (message.action === 'tabRemoved') {
      removeTab(message.tabId);
    } else if (message.action === 'tabUpdated') {
      updateTabInfo(message.tabId, message.title, message.favIconUrl);
    }
  });
});

async function loadCurrentTabs() {
  const tabs = await browser.tabs.query({ currentWindow: true });
  const tabGroupsElement = document.getElementById('tabGroups');
  tabGroupsElement.innerHTML = '';

  const groupDiv = createGroup('Unsorted');
  const tabList = groupDiv.querySelector('.tab-list');

  tabs.forEach(tab => {
    const tabItem = createTabElement(tab);
    tabList.appendChild(tabItem);
  });

  tabGroupsElement.appendChild(groupDiv);
}

async function displayGroupedTabs(groupedTabs) {
  const tabGroupsElement = document.getElementById('tabGroups');
  tabGroupsElement.innerHTML = '';

  browser.tabs.query({ currentWindow: true }).then(tabs => {
    for (const [groupName, tabIndices] of Object.entries(groupedTabs)) {
      const groupDiv = createGroup(groupName);
      const tabList = groupDiv.querySelector('.tab-list');

      for (const index of tabIndices) {
        const tab = tabs[index];
        const tabItem = createTabElement(tab);
        tabList.appendChild(tabItem);
      }

      tabGroupsElement.appendChild(groupDiv);
    }
  });
}

function createTabElement(tab) {
  const li = document.createElement('li');
  li.className = 'tab-item';
  li.dataset.tabId = tab.id;
  
  // Create favicon image
  const favicon = document.createElement('img');
  favicon.src = tab.favIconUrl || 'path/to/default-favicon.png';
  favicon.className = 'favicon';
  favicon.width = 16;
  favicon.height = 16;
  
  // Create span for tab title
  const titleSpan = document.createElement('span');
  titleSpan.className = 'tab-title';
  titleSpan.textContent = tab.title;
  
  // Create close button
  const closeButton = document.createElement('button');
  closeButton.className = 'close-tab';
  closeButton.innerHTML = '&times;';
  closeButton.title = 'Close tab';
  
  // Append favicon, title span, and close button to list item
  li.appendChild(favicon);
  li.appendChild(titleSpan);
  li.appendChild(closeButton);

  // Add click event listener to the li element
  li.addEventListener('click', (event) => {
    if (!event.target.classList.contains('close-tab')) {
      event.preventDefault();
      browser.tabs.update(tab.id, { active: true });
    }
  });

  // Add click event listener to the close button
  closeButton.addEventListener('click', (event) => {
    event.stopPropagation();
    browser.tabs.remove(tab.id);
    li.remove();
  });

  return li;
}

function handleNewTab(tab, parentTabId, hasParent) {
  const tabGroupsElement = document.getElementById('tabGroups');
  let targetGroup;

  if (hasParent) {
    targetGroup = Array.from(tabGroupsElement.children).find(group => 
      group.querySelector(`[data-tab-id="${parentTabId}"]`)
    );
  }

  if (!targetGroup) {
    targetGroup = tabGroupsElement.querySelector('.group[data-group-name="Unsorted"]');
    if (!targetGroup) {
      targetGroup = createGroup('Unsorted');
      tabGroupsElement.insertBefore(targetGroup, tabGroupsElement.firstChild);
    }
  }

  const tabList = targetGroup.querySelector('.tab-list');
  const tabItem = createTabElement(tab);
  tabList.appendChild(tabItem);
}

function createGroup(groupName) {
  const groupDiv = document.createElement('div');
  groupDiv.className = 'group';
  groupDiv.dataset.groupName = groupName;

  const groupTitle = document.createElement('div');
  groupTitle.className = 'group-title';
  groupTitle.textContent = groupName;
  groupTitle.addEventListener('click', toggleGroup);
  groupDiv.appendChild(groupTitle);

  const tabList = document.createElement('ul');
  tabList.className = 'tab-list';
  groupDiv.appendChild(tabList);

  return groupDiv;
}

function toggleGroup(event) {
  const group = event.target.closest('.group');
  group.classList.toggle('collapsed');
}

function updateActiveTab(tabId) {
  document.querySelectorAll('.tab-item').forEach(item => {
    if (item.dataset.tabId == tabId) {
      item.classList.add('active-tab');
    } else {
      item.classList.remove('active-tab');
    }
  });
}

function removeTab(tabId) {
  const tabItem = document.querySelector(`[data-tab-id="${tabId}"]`);
  if (tabItem) {
    tabItem.remove();
  }
}

function updateTabInfo(tabId, newTitle, newFavIconUrl) {
  const tabItem = document.querySelector(`[data-tab-id="${tabId}"]`);
  if (tabItem) {
    if (newTitle) {
      const titleSpan = tabItem.querySelector('.tab-title');
      if (titleSpan) {
        titleSpan.textContent = newTitle;
      }
    }
    if (newFavIconUrl) {
      const favicon = tabItem.querySelector('.favicon');
      if (favicon) {
        favicon.src = newFavIconUrl || 'path/to/default-favicon.png';
      }
    }
  }
}