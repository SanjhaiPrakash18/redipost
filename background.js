// Background service worker for Redipost extension
// Handles extension installation, side panel setup, and Reddit post insertion

chrome.runtime.onInstalled.addListener(() => {
  console.log('Redipost extension installed');
  
  // Set up side panel
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  
  // Set up context menu (optional)
  chrome.contextMenus.create({
    id: 'redipost-analyze',
    title: 'Analyze with Redipost',
    contexts: ['selection']
  });
});

// Handle extension icon click to open side panel
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (error) {
    console.error('Failed to open side panel:', error);
  }
});

// Listen for messages from sidebar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.type);
  
  if (message.type === 'INSERT_POST') {
    handleInsertPost(message.data, sendResponse);
    return true; // Keep message channel open for async response
    
  } else if (message.type === 'NAVIGATE_TO_SUBREDDIT') {
    handleNavigateToSubreddit(message.subreddit, message.data, sendResponse);
    return true; // Keep message channel open for async response
    
  } else if (message.type === 'CHECK_REDDIT_PAGE') {
    handleCheckRedditPage(sendResponse);
    return true;
    
  } else if (message.type === 'OPEN_SIDE_PANEL') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) {
        try {
          await chrome.sidePanel.open({ tabId: tabs[0].id });
          sendResponse({ success: true });
        } catch (error) {
          console.error('Failed to open side panel:', error);
          sendResponse({ success: false, error: error.message });
        }
      }
    });
    return true;
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'redipost-analyze') {
    chrome.sidePanel.open({ tabId: tab.id });
    // Send selected text to sidebar
    setTimeout(() => {
      chrome.runtime.sendMessage({
        type: 'SELECTED_TEXT',
        text: info.selectionText
      });
    }, 1000);
  }
});

async function handleInsertPost(postData, sendResponse) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) {
      sendResponse({ success: false, error: 'No active tab found' });
      return;
    }

    const tab = tabs[0];
    
    // Check if we're on a Reddit page
    if (!tab.url.includes('reddit.com')) {
      sendResponse({ success: false, error: 'Not on a Reddit page' });
      return;
    }

    // Execute content script to insert post data
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: insertPostContent,
      args: [postData]
    });

    const result = results[0]?.result;
    if (result && (result.titleInserted || result.bodyInserted)) {
      sendResponse({ 
        success: true, 
        message: 'Post content inserted successfully',
        details: result
      });
    } else {
      sendResponse({ 
        success: false, 
        error: 'Failed to insert post content',
        details: result
      });
    }
  } catch (error) {
    console.error('Failed to insert post:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleNavigateToSubreddit(subreddit, postData, sendResponse) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) {
      sendResponse({ success: false, error: 'No active tab found' });
      return;
    }

    const tab = tabs[0];
    const subredditUrl = `https://www.reddit.com/r/${subreddit}/submit`;
    
    console.log(`Navigating to: ${subredditUrl}`);
    
    // Navigate to subreddit submission page
    await chrome.tabs.update(tab.id, { url: subredditUrl });
    
    // Wait for page to load then insert content
    const insertWithRetry = async (attempt = 1, maxAttempts = 8) => {
      try {
        // Wait longer for the page to fully load, especially for Reddit's dynamic content
        const waitTime = 3000 + (attempt * 1500);
        console.log(`Waiting ${waitTime}ms before attempt ${attempt}...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: insertPostContent,
          args: [postData]
        });

        const result = results[0]?.result;
        console.log(`Insertion attempt ${attempt} result:`, result);
        
        if (result && (result.titleInserted || result.bodyInserted)) {
          sendResponse({ 
            success: true, 
            message: `Successfully navigated to r/${subreddit} and inserted post`,
            details: result
          });
        } else if (attempt < maxAttempts) {
          console.log(`Insertion attempt ${attempt} failed, retrying... (${result?.errors?.join(', ') || 'Unknown error'})`);
          insertWithRetry(attempt + 1, maxAttempts);
        } else {
          sendResponse({ 
            success: false, 
            error: 'Failed to insert post after navigation - form fields not found',
            details: result
          });
        }
      } catch (error) {
        console.error(`Insertion attempt ${attempt} failed with error:`, error);
        if (attempt < maxAttempts) {
          console.log(`Retrying in ${2000 + (attempt * 1000)}ms...`);
          setTimeout(() => insertWithRetry(attempt + 1, maxAttempts), 2000 + (attempt * 1000));
        } else {
          console.error('Failed to insert post after multiple attempts:', error);
          sendResponse({ success: false, error: error.message });
        }
      }
    };
    
    insertWithRetry();
    
  } catch (error) {
    console.error('Failed to navigate to subreddit:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleCheckRedditPage(sendResponse) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) {
      sendResponse({ isRedditPage: false, isSubmitPage: false });
      return;
    }

    const tab = tabs[0];
    
    // Check if tab.url exists before using includes
    if (!tab.url) {
      console.warn('Tab URL is undefined');
      sendResponse({ isRedditPage: false, isSubmitPage: false, error: 'Tab URL is undefined' });
      return;
    }
    
    const isRedditPage = tab.url.includes('reddit.com');
    const isSubmitPage = tab.url.includes('/submit');
    
    sendResponse({ 
      isRedditPage, 
      isSubmitPage, 
      url: tab.url 
    });
  } catch (error) {
    console.error('Failed to check Reddit page:', error);
    sendResponse({ isRedditPage: false, isSubmitPage: false, error: error.message });
  }
}

// Enhanced function to inject into Reddit page
function insertPostContent(postData) {
  try {
    console.log('Inserting post content:', postData);
    
    const results = {
      titleInserted: false,
      bodyInserted: false,
      errors: [],
      attempts: []
    };

    // Wait for page elements to be ready
    const waitForElements = (maxWait = 30000) => {
      return new Promise((resolve) => {
        const startTime = Date.now();
        
        const checkElements = () => {
          const currentTime = Date.now();
          if (currentTime - startTime > maxWait) {
            console.log('Timeout waiting for Reddit form elements');
            resolve({ titleInput: null, bodyInput: null, timedOut: true });
            return;
          }

          // Check if page is ready (Reddit often loads content dynamically)
          const pageReady = document.readyState === 'complete' && 
                           !document.querySelector('.loading') &&
                           !document.querySelector('[data-testid="loading"]');
          
          if (!pageReady) {
            console.log('Page not ready yet, waiting...');
            setTimeout(checkElements, 500);
            return;
          }

          // Enhanced selectors for different Reddit layouts
          const titleSelectors = [
            'faceplate-textarea-input[name="title"]',
            'textarea[name="title"]',
            '#innerTextArea',
            'textarea[aria-labelledby="fp-input-label"]',
            'textarea[placeholder*="Title"]',
            'input[placeholder*="Title"]',
            'textarea[data-testid="post-title"]',
            'input[data-testid="post-title"]',
            'input[name="title"]',
            'textarea[name="title"]',
            '[data-click-id="title-field"]',
            '.Post__title textarea',
            '.Post__title input',
            '[data-testid="title-field"]',
            'textarea[placeholder*="title" i]',
            'input[placeholder*="title" i]',
            'textarea[aria-label*="title" i]',
            'input[aria-label*="title" i]',
            '.title-field textarea',
            '.title-field input',
            '[role="textbox"][aria-label*="title" i]',
            // New Reddit selectors
            '[data-testid="title-field"] textarea',
            '[data-testid="title-field"] input',
            '.RichTextEditor__root textarea',
            '.RichTextEditor__root input',
            '[data-testid="post-title-field"]',
            '[data-testid="post-title-field"] textarea',
            '[data-testid="post-title-field"] input',
            '.PostForm__title textarea',
            '.PostForm__title input',
            '[data-testid="title-input"]',
            '[data-testid="title-input"] textarea',
            '[data-testid="title-input"] input',
            // Generic form selectors
            'form textarea[placeholder*="title" i]',
            'form input[placeholder*="title" i]',
            'form textarea[name*="title" i]',
            'form input[name*="title" i]'
          ];

          const bodySelectors = [
            'div[contenteditable="true"][name="body"]',
            'div[aria-label="Post body text field"]',
            'div[role="textbox"][contenteditable="true"]',
            'textarea[placeholder*="Text"]',
            'div[data-testid="richtext-editor"]',
            '.public-DraftEditor-content',
            'textarea[name="text"]',
            '.md-editor textarea',
            '.Post__body textarea',
            '[data-click-id="text-field"]',
            '.notranslate[contenteditable="true"]',
            '[data-testid="text-field"]',
            '.RichEditor-editor',
            'textarea[placeholder*="text" i]',
            'textarea[placeholder*="body" i]',
            'textarea[placeholder*="content" i]',
            'textarea[aria-label*="text" i]',
            'textarea[aria-label*="body" i]',
            'textarea[aria-label*="content" i]',
            '.text-field textarea',
            '.body-field textarea',
            '.content-field textarea',
            '[role="textbox"][aria-label*="text" i]',
            '[role="textbox"][aria-label*="body" i]',
            '[role="textbox"][aria-label*="content" i]',
            '.DraftEditor-root',
            '.DraftEditor-editorContainer',
            '[contenteditable="true"]:not([data-testid="title-field"])',
            // New Reddit selectors
            '[data-testid="text-field"] textarea',
            '[data-testid="text-field"] div[contenteditable="true"]',
            '.RichTextEditor__root textarea',
            '.RichTextEditor__root div[contenteditable="true"]',
            '[data-testid="post-text-field"]',
            '[data-testid="post-text-field"] textarea',
            '[data-testid="post-text-field"] div[contenteditable="true"]',
            '.PostForm__body textarea',
            '.PostForm__body div[contenteditable="true"]',
            '[data-testid="text-input"]',
            '[data-testid="text-input"] textarea',
            '[data-testid="text-input"] div[contenteditable="true"]',
            // Generic form selectors
            'form textarea[placeholder*="text" i]',
            'form textarea[placeholder*="body" i]',
            'form textarea[placeholder*="content" i]',
            'form textarea[name*="text" i]',
            'form textarea[name*="body" i]',
            'form textarea[name*="content" i]',
            // Additional contenteditable selectors
            'div[contenteditable="true"]:not([data-testid="title-field"])',
            '[contenteditable="true"]:not([data-testid="title-field"]):not([data-testid="text-field"])'
          ];

          let titleInput = null;
          let bodyInput = null;

          // Debug: log which selectors match for title
          for (const selector of titleSelectors) {
            const el = document.querySelector(selector);
            if (el) {
              console.log(`Title selector matched: ${selector}`);
              if (!titleInput) titleInput = el;
            }
          }

          // Debug: log which selectors match for body
          for (const selector of bodySelectors) {
            const el = document.querySelector(selector);
            if (el) {
              console.log(`Body selector matched: ${selector}`);
              if (!bodyInput) bodyInput = el;
            }
          }

          // Fallback: Try to find fields by looking at the largest textarea/input
          if (!titleInput || !bodyInput) {
            console.log('Trying fallback field detection...');
            
            // Find the largest textarea (likely the body field)
            const allTextareas = Array.from(document.querySelectorAll('textarea'));
            if (allTextareas.length > 0 && !bodyInput) {
              // Sort by size (height * width) to find the largest one
              const sortedTextareas = allTextareas.sort((a, b) => {
                const aSize = a.offsetHeight * a.offsetWidth;
                const bSize = b.offsetHeight * b.offsetWidth;
                return bSize - aSize;
              });
              
              const largestTextarea = sortedTextareas[0];
              console.log('Largest textarea found:', {
                placeholder: largestTextarea.placeholder,
                className: largestTextarea.className,
                'data-testid': largestTextarea.getAttribute('data-testid'),
                size: largestTextarea.offsetHeight * largestTextarea.offsetWidth
              });
              
              // If it's not already assigned as title, assign as body
              if (!bodyInput && largestTextarea !== titleInput) {
                bodyInput = largestTextarea;
                console.log('Assigned largest textarea as body input');
              }
            }
            
            // Find input fields (likely title field)
            const allInputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'));
            if (allInputs.length > 0 && !titleInput) {
              // Look for input with title-related attributes
              const titleInputCandidate = allInputs.find(input => 
                input.placeholder?.toLowerCase().includes('title') ||
                input.getAttribute('aria-label')?.toLowerCase().includes('title') ||
                input.getAttribute('data-testid')?.toLowerCase().includes('title') ||
                input.name?.toLowerCase().includes('title')
              );
              
              if (titleInputCandidate) {
                titleInput = titleInputCandidate;
                console.log('Found title input via fallback:', {
                  placeholder: titleInput.placeholder,
                  'data-testid': titleInput.getAttribute('data-testid')
                });
              }
            }
          }

          // Additional debugging
          if (!titleInput && !bodyInput) {
            console.log('No form fields found. Available elements:');
            const allTextareas = document.querySelectorAll('textarea');
            const allInputs = document.querySelectorAll('input');
            const allContentEditable = document.querySelectorAll('[contenteditable="true"]');
            const allForms = document.querySelectorAll('form');
            
            console.log('Forms found:', allForms.length);
            allForms.forEach((form, index) => {
              console.log(`Form ${index}:`, {
                action: form.action,
                method: form.method,
                className: form.className,
                id: form.id,
                'data-testid': form.getAttribute('data-testid')
              });
            });
            
            console.log('Textareas found:', allTextareas.length);
            allTextareas.forEach((el, index) => {
              console.log(`Textarea ${index}:`, {
                placeholder: el.placeholder,
                name: el.name,
                id: el.id,
                className: el.className,
                'data-testid': el.getAttribute('data-testid'),
                'aria-label': el.getAttribute('aria-label'),
                'data-click-id': el.getAttribute('data-click-id'),
                value: el.value.substring(0, 50) + (el.value.length > 50 ? '...' : '')
              });
            });
            
            console.log('Inputs found:', allInputs.length);
            allInputs.forEach((el, index) => {
              console.log(`Input ${index}:`, {
                type: el.type,
                placeholder: el.placeholder,
                name: el.name,
                id: el.id,
                className: el.className,
                'data-testid': el.getAttribute('data-testid'),
                'aria-label': el.getAttribute('aria-label'),
                'data-click-id': el.getAttribute('data-click-id'),
                value: el.value.substring(0, 50) + (el.value.length > 50 ? '...' : '')
              });
            });
            
            console.log('Contenteditable elements found:', allContentEditable.length);
            allContentEditable.forEach((el, index) => {
              console.log(`Contenteditable ${index}:`, {
                className: el.className,
                id: el.id,
                'data-testid': el.getAttribute('data-testid'),
                'aria-label': el.getAttribute('aria-label'),
                'data-click-id': el.getAttribute('data-click-id'),
                textContent: el.textContent.substring(0, 50) + (el.textContent.length > 50 ? '...' : '')
              });
            });
            
            // Also check for any elements with "title" or "text" in their attributes
            const titleRelatedElements = document.querySelectorAll('[placeholder*="title" i], [aria-label*="title" i], [data-testid*="title" i]');
            const textRelatedElements = document.querySelectorAll('[placeholder*="text" i], [aria-label*="text" i], [data-testid*="text" i]');
            
            console.log('Title-related elements:', titleRelatedElements.length);
            titleRelatedElements.forEach((el, index) => {
              console.log(`Title-related ${index}:`, {
                tagName: el.tagName,
                className: el.className,
                placeholder: el.placeholder,
                'aria-label': el.getAttribute('aria-label'),
                'data-testid': el.getAttribute('data-testid')
              });
            });
            
            console.log('Text-related elements:', textRelatedElements.length);
            textRelatedElements.forEach((el, index) => {
              console.log(`Text-related ${index}:`, {
                tagName: el.tagName,
                className: el.className,
                placeholder: el.placeholder,
                'aria-label': el.getAttribute('aria-label'),
                'data-testid': el.getAttribute('data-testid')
              });
            });
          }

          if (titleInput || bodyInput) {
            resolve({ titleInput, bodyInput, timedOut: false });
          } else {
            setTimeout(checkElements, 500);
          }
        };
        
        checkElements();
      });
    };

    return waitForElements().then(({ titleInput, bodyInput, timedOut }) => {
      if (timedOut) {
        results.errors.push('Timeout waiting for Reddit form elements');
        showNotification('Reddit form not found - please try again', 'warning');
        return results;
      }

      // Insert title
      if (titleInput && postData.title) {
        try {
          const titleSuccess = insertIntoField(titleInput, postData.title, 'title');
          results.titleInserted = titleSuccess;
          results.attempts.push(`Title: ${titleSuccess ? 'Success' : 'Failed'}`);
          
          if (titleSuccess) {
            console.log('Title inserted successfully');
          } else {
            results.errors.push('Failed to insert title');
          }
        } catch (error) {
          results.errors.push(`Title insertion error: ${error.message}`);
          console.error('Title insertion error:', error);
        }
      }

      // Insert body
      if (bodyInput && postData.body) {
        try {
          const bodySuccess = insertIntoField(bodyInput, postData.body, 'body');
          results.bodyInserted = bodySuccess;
          results.attempts.push(`Body: ${bodySuccess ? 'Success' : 'Failed'}`);
          
          if (bodySuccess) {
            console.log('Body inserted successfully');
          } else {
            results.errors.push('Failed to insert body');
          }
        } catch (error) {
          results.errors.push(`Body insertion error: ${error.message}`);
          console.error('Body insertion error:', error);
        }
      }

      // Show status notification
      showInsertionStatus(results, postData);
      
      return results;
    });

  } catch (error) {
    console.error('Failed to insert post content:', error);
    showNotification('Failed to insert content', 'error');
    return { 
      titleInserted: false, 
      bodyInserted: false, 
      errors: [error.message],
      attempts: []
    };
  }

  // Helper function to insert content into form fields
  function insertIntoField(field, content, fieldType) {
    if (!field) return false;
    // Special handling for faceplate-textarea-input
    if (field.tagName && field.tagName.toLowerCase() === 'faceplate-textarea-input') {
      field.value = content;
      // Dispatch input and change events if needed
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    try {
      // Clear the field first
      field.focus();
      
      if (field.tagName === 'TEXTAREA' || field.tagName === 'INPUT') {
        // For input/textarea elements
        field.value = '';
        field.value = content;
        
        // Trigger comprehensive events for React/Reddit's JS
        const events = [
          new Event('focus', { bubbles: true }),
          new Event('input', { bubbles: true }),
          new Event('change', { bubbles: true }),
          new Event('blur', { bubbles: true }),
          new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }),
          new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' })
        ];
        
        events.forEach(event => {
          field.dispatchEvent(event);
        });
        
        // Additional React-specific events
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'value'
        ) || Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
        );
        
        if (nativeInputValueSetter && nativeInputValueSetter.set) {
          nativeInputValueSetter.set.call(field, content);
          field.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        return field.value === content;
        
      } else if (field.contentEditable === 'true' || field.classList.contains('public-DraftEditor-content')) {
        // For contenteditable elements (rich text editors)
        field.innerHTML = '';
        field.textContent = content;
        
        // Create a text node and insert it
        const textNode = document.createTextNode(content);
        field.appendChild(textNode);
        
        // Trigger events
        const events = [
          new Event('focus', { bubbles: true }),
          new Event('input', { bubbles: true }),
          new Event('change', { bubbles: true }),
          new Event('blur', { bubbles: true })
        ];
        
        events.forEach(event => {
          field.dispatchEvent(event);
        });
        
        return field.textContent.includes(content);
      }
      
      return false;
    } catch (error) {
      console.error(`Error inserting into ${fieldType} field:`, error);
      return false;
    }
  }

  function showInsertionStatus(results, postData) {
    let message = '';
    let type = 'success';

    if (results.titleInserted && results.bodyInserted) {
              message = 'Post content inserted successfully!';
    } else if (results.titleInserted && !postData.body) {
              message = 'Title inserted successfully!';
    } else if (results.bodyInserted && !postData.title) {
              message = 'Body inserted successfully!';
    } else if (results.titleInserted && !results.bodyInserted && postData.body) {
              message = 'Title inserted, but body field not found';
      type = 'warning';
    } else if (!results.titleInserted && results.bodyInserted && postData.title) {
              message = 'Body inserted, but title field not found';
      type = 'warning';
    } else {
      message = '❌ Could not find Reddit post fields';
      type = 'error';
    }

    showNotification(message, type);

    // Log detailed results for debugging
    console.log('Insertion results:', results);
  }

  function showNotification(message, type = 'info') {
    // Remove any existing notifications
    const existing = document.getElementById('redipost-insertion-notification');
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement('div');
    notification.id = 'redipost-insertion-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 20px;
      border-radius: 8px;
      font-family: 'Rethink Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      font-weight: 500;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      max-width: 320px;
      transform: translateX(400px);
      transition: transform 0.3s ease;
      line-height: 1.4;
    `;

    // Set colors based on type
    const colors = {
      success: { bg: '#28a745', color: 'white' },
      warning: { bg: '#ffc107', color: '#212529' },
      error: { bg: '#dc3545', color: 'white' },
      info: { bg: '#ff4500', color: 'white' }
    };

    const colorScheme = colors[type] || colors.info;
    notification.style.background = colorScheme.bg;
    notification.style.color = colorScheme.color;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);

    // Remove after 5 seconds
    setTimeout(() => {
      notification.style.transform = 'translateX(400px)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 5000);
  }
}