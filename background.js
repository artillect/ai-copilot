browser.runtime.onMessage.addListener((message) => {
  if (message.action === 'groupTabs') {
    groupTabs(message.selectedAPI).catch(error => {
      browser.runtime.sendMessage({ status: 'Error', error: error.message });
    });
  }
});

async function groupTabs(selectedAPI) {
  try {
    const tabs = await browser.tabs.query({ currentWindow: true });
    const tabData = tabs.map(tab => ({
      title: tab.title,
      url: tab.url
    }));
    
    browser.runtime.sendMessage({ status: 'Categorizing tabs...' });
    const groupedTabs = await categorizeTabs(tabData, selectedAPI);
    
    browser.runtime.sendMessage({ status: 'Creating tab groups...' });
    await createTabGroups(groupedTabs, tabs);
    
    browser.runtime.sendMessage({ status: 'Tabs grouped successfully!', output: groupedTabs });
  } catch (error) {
    throw new Error(`Failed to group tabs: ${error.message}`);
  }
}

async function categorizeTabs(tabData, selectedAPI) {
  const SERVER_URL = 'http://localhost:3002/categorize';

  const prompt = `You are an Expert Task Organizer, specializing in categorizing browser tabs based on the user's specific intended tasks. Your goal is to create logical, highly specific task-oriented groups that reflect how a user might be using these tabs together.

Given the following list of browser tabs, organize them into 4-8 logical groups based on the specific tasks they are likely being used for. Follow these steps carefully, thinking out loud for each:

1. For each tab, consider and verbalize:
   - What specific task might the user be performing with this tab?
   - How does this tab's exact content (not just the website) relate to potential user goals?
   - What other tabs might be used alongside this one for a very specific common purpose?
   - List 2-3 potential highly specific group names this tab could belong to.

2. After considering all tabs individually, identify and explain common themes or specific tasks that emerge. Be as granular as possible.

3. Create 4-8 group names that are concise (2-4 words) and descriptive of very specific tasks. Explain your reasoning for each name. Avoid using "or", "and", or slashes in group names. Prioritize specificity over broader categories.

4. For each tab, decide which single group it best fits into and explain your reasoning, focusing on the specific content and likely user intent.

5. Review your group names and consider if any can be made more specific or split into multiple groups. Revise if necessary.

6. Double-check your groupings, verbalizing your thought process to ensure no tab appears in multiple groups and that each group represents a cohesive, specific task.

7. Provide your final grouping as a JSON object where keys are group names and values are arrays of tab indices (0-based).

Example of good vs. poor categorization:

Good: 
"Project Planning": [0, 3, 7]
"Code Debugging": [1, 4]
"Market Research": [2, 5, 6]
"Learning French": [8, 9]

Poor:
"Work Stuff": [0, 1, 2, 3, 4, 5, 6, 7]
"Education": [8, 9]

Tabs:
${tabData.map((tab, index) => `${index}. ${tab.title}`).join('\n')}

Your response must follow this exact format:
1. Individual tab analysis (step 1)
2. Identification of common themes (step 2)
3. Creation and explanation of group names (step 3)
4. Assignment of tabs to groups with reasoning (step 4)
5. Double-checking of groupings (step 5)
6. JSON object with your final grouping in a code block with the following format (step 6)

\`\`\`json
{
  "Group 1": [0, 2, 4],
  "Group 2": [1, 3, 5]
}
\`\`\`

If any tab appears in multiple groups or if you use poor group naming, your entire response will be discarded. Ensure each tab is in exactly one group.
`

  browser.runtime.sendMessage({ status: 'Sending request to local server...' });
  try {
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        selectedAPI: selectedAPI,
        messages: [
          {role: "user", content: prompt}
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Server request failed with status ${response.status}`);
    }

    browser.runtime.sendMessage({ status: 'Processing server response...' });
    const data = await response.json();
    
    let content;
    if (selectedAPI === 'anthropic') {
      content = data.content[0].text;
    } else if (selectedAPI === 'groq') {
      content = data.choices[0].message.content;
    } else {
      throw new Error('Invalid API selected');
    }

    // Updated regex to handle both ``` and ```json
    const jsonMatch = content.match(/```(?:json)?\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from the response');
    }
    return JSON.parse(jsonMatch[1]);
  } catch (error) {
    throw new Error(`Failed to categorize tabs: ${error.message}`);
  }
}

async function createTabGroups(groupedTabs, tabs) {
  try {
    for (const [groupName, tabIndices] of Object.entries(groupedTabs)) {
      // Instead of creating actual tab groups, we'll just update the sidebar
      // You can implement actual tab grouping here if Firefox supports it in the future
      console.log(`Created group: ${groupName} with tabs:`, tabIndices.map(i => tabs[i].title));
    }
  } catch (error) {
    throw new Error(`Failed to create tab groups: ${error.message}`);
  }
}

browser.tabs.onCreated.addListener(handleTabCreated);
browser.tabs.onActivated.addListener(handleTabActivated);
browser.tabs.onRemoved.addListener(handleTabRemoved);

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.title || changeInfo.favIconUrl) {
    browser.runtime.sendMessage({
      action: 'tabUpdated',
      tabId: tabId,
      title: changeInfo.title,
      favIconUrl: changeInfo.favIconUrl
    });
  }
});

async function handleTabCreated(tab) {
  let parentTab = null;
  if (tab.openerTabId) {
    parentTab = await browser.tabs.get(tab.openerTabId);
  }
  const message = {
    action: 'tabCreated',
    tab: tab,
    parentTabId: parentTab ? parentTab.id : null,
    hasParent: !!parentTab
  };
  browser.runtime.sendMessage(message);
}

function handleTabActivated(activeInfo) {
  browser.runtime.sendMessage({
    action: 'tabActivated',
    tabId: activeInfo.tabId
  });
}

function handleTabRemoved(tabId, removeInfo) {
  browser.runtime.sendMessage({
    action: 'tabRemoved',
    tabId: tabId
  });
}