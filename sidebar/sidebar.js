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
      handleNewTab(message.tab, message.parentTab, message.hasParent);
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
    setupDragAndDrop();
  });
}

function createTabElement(tab) {
  const li = document.createElement('li');
  li.className = 'tab-item';
  li.dataset.tabId = tab.id;
  li.draggable = true;
  
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

function handleNewTab(tab, parentTab, hasParent) {
  const tabGroupsElement = document.getElementById('tabGroups');
  let targetGroup;

  if (hasParent) {
    targetGroup = Array.from(tabGroupsElement.children).find(group => 
      group.querySelector(`[data-tab-id="${parentTab.id}"]`)
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
  setupDragAndDrop();
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

  groupDiv.addEventListener('dragover', dragOver);
  groupDiv.addEventListener('dragenter', dragEnter);
  groupDiv.addEventListener('dragleave', dragLeave);
  groupDiv.addEventListener('drop', drop);

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

function setupDragAndDrop() {
  const tabItems = document.querySelectorAll('.tab-item');
  const groups = document.querySelectorAll('.group');

  tabItems.forEach(tabItem => {
    tabItem.addEventListener('dragstart', dragStart);
    tabItem.addEventListener('dragend', dragEnd);
  });

  groups.forEach(group => {
    group.addEventListener('dragover', dragOver);
    group.addEventListener('dragenter', dragEnter);
    group.addEventListener('dragleave', dragLeave);
    group.addEventListener('drop', drop);
  });
}

function dragStart(e) {
  e.dataTransfer.setData('text/plain', e.target.dataset.tabId);
  e.target.classList.add('dragging');
  setTimeout(() => e.target.style.display = 'none', 0);
}

function dragEnd(e) {
  e.target.classList.remove('dragging');
  e.target.style.display = '';
  removePlaceholder();
}

function dragOver(e) {
  e.preventDefault();
  const tabItem = e.target.closest('.tab-item');
  if (tabItem && !tabItem.classList.contains('placeholder')) {
    const rect = tabItem.getBoundingClientRect();
    const midpoint = (rect.top + rect.bottom) / 2;
    const placeholder = createPlaceholder();
    
    if (e.clientY < midpoint) {
      tabItem.parentNode.insertBefore(placeholder, tabItem);
    } else {
      tabItem.parentNode.insertBefore(placeholder, tabItem.nextSibling);
    }
  }
}

function dragEnter(e) {
  e.preventDefault();
  const group = e.target.closest('.group');
  if (group && group.querySelector('.tab-list').children.length === 0) {
    const placeholder = createPlaceholder();
    group.querySelector('.tab-list').appendChild(placeholder);
  }
}

function dragLeave(e) {
  if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget)) {
    removePlaceholder();
  }
}

function drop(e) {
  e.preventDefault();
  const group = e.target.closest('.group');
  if (group) {
    const tabList = group.querySelector('.tab-list');
    const tabId = e.dataTransfer.getData('text');
    const draggedTab = document.querySelector(`[data-tab-id="${tabId}"]`);
    
    if (draggedTab) {
      const placeholder = tabList.querySelector('.placeholder');
      if (placeholder) {
        tabList.insertBefore(draggedTab, placeholder);
        placeholder.remove();
      } else {
        tabList.appendChild(draggedTab);
      }
    }
  }
}

function createPlaceholder() {
  removePlaceholder();
  const placeholder = document.createElement('li');
  placeholder.className = 'tab-item placeholder';
  placeholder.style.height = '34px';
  return placeholder;
}

function removePlaceholder() {
  const placeholder = document.querySelector('.placeholder');
  if (placeholder) {
    placeholder.remove();
  }
}