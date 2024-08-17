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
    const tabData = await Promise.all(tabs.map(async tab => {
      let parentTitle = null;
      if (tab.openerTabId) {
        try {
          const parentTab = await browser.tabs.get(tab.openerTabId);
          parentTitle = parentTab.title;
        } catch (error) {
          console.error(`Error fetching parent tab for tab ${tab.id}:`, error);
        }
      }
      return {
        title: tab.title,
        url: tab.url,
        parentTitle: parentTitle
      };
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

  const prompt = `<context>
You are an Expert Task Organizer, specializing in categorizing browser tabs based on the user's specific intended tasks. Your goal is to create logical, highly specific task-oriented groups that reflect how a user might be using these tabs together. The results will help users better organize their browsing sessions and improve productivity.
You always analyze every tab provided, do not truncate any of the steps. (i.e. NEVER say "(Rest of the analysis for tabs 4-10)")
There is no character limit for your response. Do not say that you are going to do something without actually doing it.
</context>

<instructions>
Given the following list of browser tabs, organize them into 4-8 logical groups based on the specific tasks they are likely being used for. Follow these steps carefully, thinking out loud for each:

1. Initial Tab Analysis:
   <tab_analysis>
   For each of the ${tabData.length} tabs provided below, provide a brief analysis:
   a) Topic identification: [Describe the main topic and likely user intent]
   b) Category: [Classify as Entertainment, Interest, Task, or Administrative]
   c) Potential group: [Suggest 1-2 specific, task-oriented group names]
   </tab_analysis>

2. Preliminary Grouping:
   <preliminary_grouping>
   Sort tabs into broad categories based on this schema:
   a) Entertainment & Media
   b) General Interests & Learning
   c) Active Projects & Tasks
   d) Research & Development
   e) Tools & Resources
   f) Administration & Settings
   Identify potential sub-groups within these categories.
   </preliminary_grouping>

3. Group Name Refinement:
   <group_refinement>
   Create 4-8 group names that are:
   - Concise (2-3 words max)
   - Highly specific and task-oriented
   - Without repetitive elements (e.g., avoid adding "Center" to every name)
   For each group name:
   - Provide a clear definition
   - Explain how it differs from other groups
   - Justify its specificity and task-orientation
   </group_refinement>

4. Final Tab Assignment:
   <tab_assignment>
   For each tab, assign it to the most appropriate single group. Provide:
   - Primary reason for the assignment
   - How it contributes to the group's coherence
   Ensure groups have at least 3 tabs where possible, with justification for smaller groups.
   </tab_assignment>

5. Review and Ordering:
   <review_process>
   - Arrange groups in this order: Entertainment → Interests → Tasks → Administrative
   - Review each group for specificity and task-orientation
   - Consider splitting or merging groups to improve categorization
   - Verify each tab appears in exactly one group
   - Confirm all tabs are accounted for
   </review_process>

6. Final Grouping:
   <final_output>
   Provide your final grouping as a JSON object where keys are group names and values are arrays of tab indices (0-based). Use this format:
   \`\`\`json
   {
     "Specific Task Group 1": [0, 2, 4],
     "Specific Task Group 2": [1, 3, 5]
   }
   \`\`\`
   </final_output>
   Ensure that you properly surround the JSON object with \`\`\`json and \`\`\`.
   Make sure to include all tabs (${tabData.length} tabs numbered 0-${tabData.length - 1}) once in the final grouping.

7. Categorization Summary:
   <summary>
   Provide a brief paragraph explaining how your final grouping:
   - Reflects specific, task-oriented groups
   - Covers all provided tabs without duplication
   - Balances specificity with reasonable group sizes
   - Represents likely user intentions based on tab content
   - Follows the preferred ordering of entertainment → interests → tasks → administrative
   </summary>
</instructions>

<examples>
Good categorization example:
{
  "Music Discovery": [0, 3, 7],
  "Game Strategy": [1, 4],
  "AI Development": [2, 5, 6],
  "French Learning": [8, 9]
}

Poor categorization example:
{
  "General Entertainment": [0, 1, 3, 4, 7],
  "Work Stuff": [2, 5, 6, 8, 9],
  "Misc": [2]
}
</examples>

<criteria>
A successful categorization will:
- Have 4-8 groups with clear, specific, task-oriented names
- Place each tab in exactly one group
- Include at least 3 tabs per group (with justified exceptions)
- Accurately reflect the likely tasks or purposes of the tabs
- Account for all provided tabs
- Follow the preferred ordering scheme
</criteria>

Here are the ${tabData.length} tabs that you need to categorize:
${tabData.map((tab, index) => `${index}. ${tab.title} - ${tab.url} (Parent: ${tab.parentTitle || 'None'})`).join('\n')}

Your response must follow this exact format:
1. Initial tab analysis (step 1)
2. Preliminary grouping (step 2)
3. Group name refinement (step 3)
4. Final tab assignment (step 4)
5. Review and ordering (step 5)
6. JSON object with your final grouping in a code block (step 6)
7. Categorization summary (step 7)

Ensure each tab is in exactly one group and that your group names are specific and task-oriented.`

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
    console.log(tab.openerTabId);
  }
  const message = {
    action: 'tabCreated',
    tab: tab,
    parentTab: parentTab,
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