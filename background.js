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

  const prompt = `<context>
You are an Expert Task Organizer, specializing in categorizing browser tabs based on the user's specific intended tasks. Your goal is to create logical, highly specific task-oriented groups that reflect how a user might be using these tabs together. The results will help users better organize their browsing sessions and improve productivity.
You always analyze every tab provided, do not truncate any of the steps. (i.e. NEVER say "(Rest of the analysis for tabs 4-10)")
There is no character limit for your response. Do not say that you are going to do something without actually doing it.
</context>

<instructions>
Given the following list of browser tabs, organize them into 4-8 logical groups based on the specific tasks they are likely being used for. Follow these steps carefully, thinking out loud for each:

1. Individual Tab Analysis:
   <tab_analysis>
   For each of the ${tabData.length} tabs provided below, provide a structured analysis:
   a) Topic identification: [Describe the topic of the tab and any relevant keywords found in the title or URL]
   b) Specific task: [Describe the precise task the user might be performing]
   c) Content relation to user goals: [Explain how the tab's exact content relates to potential user objectives]
   d) Complementary tabs: [List other tabs that might be used alongside this one for a specific common purpose]
   e) Potential group names: [Provide 2-3 highly specific, task-oriented group names this tab could belong to, with brief justifications]
   </tab_analysis>

2. Theme Identification:
   <theme_identification>
   After analyzing all ${tabData.length} tabs individually, identify and explain common themes or specific tasks that emerge:
   - Provide 2-3 sentences for each identified theme
   - Explain how the theme emerged from the tab analysis
   - Specify which tabs contribute to this theme
   - Justify the theme's significance for task-based grouping
   Be as granular and specific as possible in your analysis.
   </theme_identification>

3. Group Name Creation:
   <group_creation>
   Create 4-8 group names that are concise (2-4 words) and descriptive of very specific tasks. For each group name:
   - Provide a clear definition of what the group represents
   - Explain how it differs from other potential groups
   - Justify its specificity and task-orientation
   - Ensure the name uses single words (avoid "or", "and", or slashes)
   - Prioritize specificity over broader categories
   </group_creation>

4. Tab Assignment:
   <tab_assignment>
   For each of the ${tabData.length} tabs, decide which single group it best fits into. Provide:
   - The primary reason for placement in the chosen group
   - One alternative group considered and why it was rejected
   - How this assignment contributes to the overall coherence of the group
   Focus on the specific content and likely user intent.
   </tab_assignment>

5. Review and Refinement:
   <review_process>
   - Review each group name for specificity and task-orientation
   - Consider if any groups can be split or merged to improve categorization
   - Ensure each group has at least 3 tabs, or provide explicit justification for smaller groups
   - Verify that each tab appears in exactly one group
   - Confirm that all tabs are accounted for in the grouping
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
   </summary>
</instructions>

<examples>
Good categorization example:
{
  "Project Roadmap Planning": [0, 3, 7],
  "JavaScript Debugging": [1, 4],
  "Competitor Analysis": [2, 5, 6],
  "French Vocabulary Study": [8, 9]
}

Poor categorization example:
{
  "General Work Tasks": [4, 5, 6, 7],
  "Learning Activities": [8, 9]
}
</examples>

<criteria>
A successful categorization will:
- Have 4-8 groups with clear, specific, task-oriented names
- Place each tab in exactly one group
- Include at least 3 tabs per group (with justified exceptions)
- Accurately reflect the likely tasks or purposes of the tabs
- Account for all provided tabs
</criteria>

Here are the ${tabData.length} tabs that you need to categorize:
${tabData.map((tab, index) => `${index}. ${tab.title} - ${tab.url}`).join('\n')}

Your response must follow this exact format:
1. Individual tab analysis of every single tab(step 1)
2. Identification of common themes (step 2)
3. Creation and explanation of group names (step 3)
4. Assignment of tabs to groups with reasoning (step 4)
5. Review and refinement of groupings (step 5)
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