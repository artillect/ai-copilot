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
You explain your reasoning for every part of each step out loud, you must do this for transparency and to ensure that you are not lying about your reasoning.
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
   Avoid splitting off tabs into separate groups unless there are enough tabs that are similar enough to constitute a new group.
   Try to keep children with their parent tab, splitting off separate topics if there are enough children that are similar enough to constitute a new group (one tab is not enough to constitute a new group).
   Identify potential sub-groups within these categories, and weigh the contents of the tabs over their platform in your grouping.
   </preliminary_grouping>

3. Group Refinement:
   <group_refinement>
   Refine the group names to be more specific and task-oriented.
   Create 4-8 group names that are:
   - Concise (2-3 words max)
   - Highly specific and task-oriented
   - Without repetitive elements (e.g., avoid adding "Center" to every name)
   - Balanced with reasonable group sizes
   For each group:
   - Explain whether it should be combined with another group if it is similar in some way
   - Explain whether it should be split off into a separate group if it is too large
   - Carefully make adjustments to the grouping to make sure that similar tabs are grouped together
   - Do not rely too heavily on your initial grouping, you must make adjustments to properly balance everything.
   - Provide a clear definition of the group
   - Explain how it differs from other groups
   - Justify its specificity and task-orientation
   Ensure that the groups reflect likely user intentions based on tab content.
   </group_refinement>

4. Group Assignment:
   <group_assignment>
   Go through each tab one by one and assign it to the single most appropriate group. Provide:
   - Primary reason for the assignment
   - How it contributes to the group's coherence
   - How it relates to the other tabs in the group
   Ensure groups have at least 3 tabs where possible, with justification for smaller groups.
   Balance specificity with reasonable group sizes. 
   Prefer to group tabs together if they are similar in some way (i.e. a bunch of unrelated youtube videos, reddit posts, news articles, etc.) rather than splitting them up.
   </group_assignment>

5. Review and Ordering:
   <review_process>
   - Arrange groups in this order: Entertainment → Interests → Tasks → Administrative
   - Review each group for specificity and task-orientation
   - Consider splitting or merging groups to improve categorization
   - Rename groups to more accurately describe the tabs in the group
   - Make any final changes to the grouping
   - Verify each tab appears only once in the final grouping
   - Confirm all tabs are accounted for
   - Ensure the grouping covers all provided tabs without duplication
   </review_process>

6. Final Grouping:
   <final_output>
   Translate the final groups you refined in step 5 directly into a JSON object with the following structure:
   
   {
     "groups": ["Group Name 1", "Group Name 2", ...],
     "tabs": {"0": "Group Name 1", "1": "Group Name 2", ...}
   }

   Follow these rules:
   - The "groups" array should contain all unique group names from your final refined list in step 5.
   - The "tabs" object should have keys representing tab indices (0-${tabData.length - 1}) and values representing the group name each tab is assigned to.
   - Ensure each tab index (0-${tabData.length - 1}) appears exactly once in the "tabs" object.
   - Use the exact group names from your final refined list in step 5.
   - Include all refinements and adjustments you made in step 5.

   Use this format:
   \`\`\`json
   {
     "groups": ["Group Name 1", "Group Name 2", "Group Name 3"],
     "tabs": {
       "0": "Group Name 1",
       "1": "Group Name 2",
       "2": "Group Name 1",
       "3": "Group Name 3"
     }
   }
   \`\`\`
   Surround the JSON object with \`\`\`json and \`\`\`.

   Before finalizing, verify that:
   - All ${tabData.length} tabs are included in the "tabs" object.
   - Each tab index appears only once in the "tabs" object.
   - All group names in the "tabs" object are present in the "groups" array.
   - The groups and their contents accurately reflect your final refined grouping from step 5.

   If you notice any discrepancies with your step 5 refinements, do not alter the JSON. Instead, note the discrepancy after the JSON object.
   </final_output>
   </instructions>

<examples>
Good categorization example:
{
  "groups": ["Music Discovery", "Game Strategy", "AI Development", "French Learning"],
  "tabs": {
    "0": "Music Discovery",
    "1": "Game Strategy",
    "2": "AI Development",
    "3": "Music Discovery",
    "4": "Game Strategy",
    "5": "AI Development",
    "6": "AI Development",
    "7": "Music Discovery",
    "8": "French Learning",
    "9": "French Learning"
  }
}

Poor categorization example:
{
  "groups": ["General Entertainment", "Work Stuff", "Misc"],
  "tabs": {
    "0": "General Entertainment",
    "1": "General Entertainment",
    "2": "Work Stuff",
    "3": "General Entertainment",
    "4": "General Entertainment",
    "5": "Work Stuff",
    "6": "Work Stuff",
    "7": "General Entertainment",
    "8": "Misc",
    "9": "Work Stuff"
  }
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
- Balance specificity with reasonable group sizes
- Represent likely user intentions based on tab content
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

    const jsonMatch = content.match(/```(?:json)?\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from the response');
    }
    const parsedJson = JSON.parse(jsonMatch[1]);

    // Convert the new JSON structure to the old format
    const groupedTabs = {};
    for (const groupName of parsedJson.groups) {
      groupedTabs[groupName] = [];
    }
    for (const [tabIndex, groupName] of Object.entries(parsedJson.tabs)) {
      groupedTabs[groupName].push(parseInt(tabIndex));
    }

    return groupedTabs;
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