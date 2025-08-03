// Redipost Content Script
// Enhanced script for Reddit page interaction and post insertion

(function() {
  'use strict';

  console.log('Redipost content script loaded');

  class RedditPageHandler {
    constructor() {
      this.isPostPage = false;
      this.currentUrl = window.location.href;
      this.initialize();
    }

    initialize() {
      this.detectPageType();
      this.setupPageObserver();
      
      // Listen for messages from extension
      this.setupMessageListener();
    }

    detectPageType() {
      const url = window.location.href;
      
      // Detect if we're on a Reddit post creation page
      const postPagePatterns = [
        '/submit',
        '/r/[^/]+/submit',
        'reddit.com/submit'
      ];

      this.isPostPage = postPagePatterns.some(pattern => {
        const regex = new RegExp(pattern);
        return regex.test(url);
      }) || this.hasPostForm();

      console.log('Page detection:', {
        url,
        isPostPage: this.isPostPage,
        hasForm: this.hasPostForm()
      });
    }

    hasPostForm() {
      // Enhanced form detection
      const formSelectors = [
        'textarea[placeholder*="Title"]',
        'input[placeholder*="Title"]',
        'textarea[data-testid="post-title"]',
        'input[data-testid="post-title"]',
        '[data-testid="submit-page"]',
        '[data-click-id="subreddit"]',
        'form[data-testid="submit-form"]',
        '.submit-page',
        '[data-testid="text-field"]'
      ];

      return formSelectors.some(selector => document.querySelector(selector));
    }

    setupPageObserver() {
      // Watch for URL changes (SPA navigation)
      let currentUrl = window.location.href;
      
      const observer = new MutationObserver(() => {
        if (window.location.href !== currentUrl) {
          currentUrl = window.location.href;
          console.log('URL changed:', currentUrl);
          
          // Re-detect page type after navigation
          setTimeout(() => {
            this.detectPageType();
          }, 1000);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Also listen for popstate events
      window.addEventListener('popstate', () => {
        setTimeout(() => {
          this.detectPageType();
        }, 500);
      });
    }

    setupMessageListener() {
      // Listen for messages from popup/sidebar
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('Content script received:', message.type);
        
        if (message.type === 'INSERT_CONTENT') {
          this.insertPostContent(message.data)
            .then(result => sendResponse({ success: true, result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          return true; // Keep message channel open
        }
        
        if (message.type === 'GET_PAGE_INFO') {
          sendResponse({
            isPostPage: this.isPostPage,
            hasForm: this.hasPostForm(),
            url: window.location.href
          });
        }
        
        if (message.type === 'SELECTED_TEXT') {
          // Handle selected text from context menu
          this.handleSelectedText(message.text);
        }
      });
    }

    handleSelectedText(text) {
      // If text is selected, we can pre-populate it
      console.log('Selected text received:', text);
      
      // Store selected text for sidebar to use
      sessionStorage.setItem('redipost_selected_text', text);
      
      // Show indicator
      this.showTemporaryNotification('Selected text ready for Redipost', 'info');
    }

    async insertPostContent(postData) {
      console.log('Starting post insertion:', postData);
      
      const results = {
        titleInserted: false,
        bodyInserted: false,
        errors: [],
        fieldsCounts: { title: 0, body: 0 }
      };

      try {
        // Wait for form elements with better timeout handling
        const { titleFields, bodyFields } = await this.waitForFormElements();
        
        results.fieldsCounts.title = titleFields.length;
        results.fieldsCounts.body = bodyFields.length;

        // Insert title
        if (postData.title && titleFields.length > 0) {
          for (const field of titleFields) {
            if (this.insertIntoField(field, postData.title, 'title')) {
              results.titleInserted = true;
              break;
            }
          }
          
          if (!results.titleInserted) {
            results.errors.push('Failed to insert title into any available field');
          }
        }

        // Insert body
        if (postData.body && bodyFields.length > 0) {
          for (const field of bodyFields) {
            if (this.insertIntoField(field, postData.body, 'body')) {
              results.bodyInserted = true;
              break;
            }
          }
          
          if (!results.bodyInserted) {
            results.errors.push('Failed to insert body into any available field');
          }
        }

        // Show comprehensive status
        this.showInsertionStatus(results, postData);
        
        return results;

      } catch (error) {
        console.error('Post insertion failed:', error);
        results.errors.push(error.message);
        this.showTemporaryNotification('❌ Failed to insert post content', 'error');
        return results;
      }
    }

    waitForFormElements(maxWait = 15000) {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkForElements = () => {
          const currentTime = Date.now();
          
          if (currentTime - startTime > maxWait) {
            reject(new Error('Timeout waiting for Reddit form elements'));
            return;
          }

          const titleSelectors = [
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
            'input[aria-label*="title" i]',
            'textarea[aria-label*="title" i]'
          ];

          const bodySelectors = [
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
            'div[contenteditable="true"][data-testid]',
            'textarea[aria-label*="text" i]',
            'div[aria-label*="text" i][contenteditable="true"]'
          ];

          const titleFields = titleSelectors
            .map(sel => document.querySelector(sel))
            .filter(el => el && this.isElementVisible(el));

          const bodyFields = bodySelectors
            .map(sel => document.querySelector(sel))
            .filter(el => el && this.isElementVisible(el));

          console.log('Form elements found:', { 
            titleFields: titleFields.length, 
            bodyFields: bodyFields.length 
          });

          if (titleFields.length > 0 || bodyFields.length > 0) {
            resolve({ titleFields, bodyFields });
          } else {
            setTimeout(checkForElements, 500);
          }
        };

        checkForElements();
      });
    }

    isElementVisible(element) {
      if (!element) return false;
      
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && 
             style.visibility !== 'hidden' && 
             style.opacity !== '0' &&
             element.offsetWidth > 0 && 
             element.offsetHeight > 0;
    }

    insertIntoField(field, content, fieldType) {
      try {
        console.log(`Attempting to insert ${fieldType} into:`, field.tagName, field.className);
        
        // Focus the field first
        field.focus();
        field.click();
        
        // Small delay to ensure focus
        setTimeout(() => {
          if (field.tagName === 'TEXTAREA' || field.tagName === 'INPUT') {
            return this.insertIntoInputField(field, content);
          } else if (field.contentEditable === 'true') {
            return this.insertIntoContentEditable(field, content);
          }
        }, 100);
        
        // Check immediately for input/textarea
        if (field.tagName === 'TEXTAREA' || field.tagName === 'INPUT') {
          return this.insertIntoInputField(field, content);
        } else if (field.contentEditable === 'true') {
          return this.insertIntoContentEditable(field, content);
        }
        
        return false;
      } catch (error) {
        console.error(`Error inserting into ${fieldType}:`, error);
        return false;
      }
    }

    insertIntoInputField(field, content) {
      try {
        // Clear field
        field.value = '';
        field.select();
        
        // Set value using multiple methods
        field.value = content;
        
        // Use React's property setter if available
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          field.tagName === 'INPUT' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype,
          'value'
        );
        
        if (nativeInputValueSetter && nativeInputValueSetter.set) {
          nativeInputValueSetter.set.call(field, content);
        }
        
        // Trigger comprehensive events
        const events = [
          new Event('input', { bubbles: true }),
          new Event('change', { bubbles: true }),
          new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }),
          new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }),
          new Event('blur', { bubbles: true })
        ];
        
        events.forEach(event => field.dispatchEvent(event));
        
        // Additional method: simulate typing
        this.simulateTyping(field, content);
        
        // Verify insertion
        const success = field.value === content || field.value.includes(content);
        console.log(`Input field insertion ${success ? 'successful' : 'failed'}:`, field.value.substring(0, 50));
        
        return success;
      } catch (error) {
        console.error('Input field insertion error:', error);
        return false;
      }
    }

    insertIntoContentEditable(field, content) {
      try {
        // Clear content
        field.innerHTML = '';
        field.textContent = '';
        
        // Method 1: Set textContent
        field.textContent = content;
        
        // Method 2: Use execCommand if available
        if (document.execCommand) {
          field.focus();
          document.execCommand('selectAll', false, null);
          document.execCommand('insertText', false, content);
        }
        
        // Method 3: Create and insert text node
        if (!field.textContent || field.textContent !== content) {
          field.innerHTML = '';
          const textNode = document.createTextNode(content);
          field.appendChild(textNode);
        }
        
        // Method 4: Set innerHTML as fallback
        if (!field.textContent || field.textContent !== content) {
          field.innerHTML = content.replace(/\n/g, '<br>');
        }
        
        // Trigger events
        const events = [
          new Event('input', { bubbles: true }),
          new Event('change', { bubbles: true }),
          new Event('blur', { bubbles: true }),
          new InputEvent('beforeinput', { 
            bubbles: true, 
            inputType: 'insertText', 
            data: content 
          }),
          new InputEvent('input', { 
            bubbles: true, 
            inputType: 'insertText', 
            data: content 
          })
        ];
        
        events.forEach(event => {
          try {
            field.dispatchEvent(event);
          } catch (e) {
            console.warn('Event dispatch failed:', e);
          }
        });
        
        // Verify insertion
        const success = field.textContent.includes(content) || field.innerHTML.includes(content);
        console.log(`ContentEditable insertion ${success ? 'successful' : 'failed'}:`, field.textContent.substring(0, 50));
        
        return success;
      } catch (error) {
        console.error('ContentEditable insertion error:', error);
        return false;
      }
    }

    simulateTyping(field, content) {
      try {
        // Simulate typing for better React compatibility
        field.focus();
        
        for (let i = 0; i < content.length; i++) {
          const char = content[i];
          
          // Dispatch keydown
          field.dispatchEvent(new KeyboardEvent('keydown', {
            bubbles: true,
            key: char,
            char: char,
            charCode: char.charCodeAt(0),
            keyCode: char.charCodeAt(0)
          }));
          
          // Update value
          if (i === 0) {
            field.value = char;
          } else {
            field.value = content.substring(0, i + 1);
          }
          
          // Dispatch input
          field.dispatchEvent(new Event('input', { bubbles: true }));
          
          // Dispatch keyup
          field.dispatchEvent(new KeyboardEvent('keyup', {
            bubbles: true,
            key: char,
            char: char,
            charCode: char.charCodeAt(0),
            keyCode: char.charCodeAt(0)
          }));
        }
      } catch (error) {
        console.warn('Typing simulation failed:', error);
      }
    }

    showInsertionStatus(results, postData) {
      let message = '';
      let type = 'success';
      let details = [];

      // Determine primary message
      if (results.titleInserted && results.bodyInserted) {
        message = 'Post content inserted successfully!';
        details.push('Both title and body inserted');
      } else if (results.titleInserted && !postData.body) {
        message = 'Title inserted successfully!';
        details.push('Title inserted (no body content provided)');
      } else if (results.bodyInserted && !postData.title) {
        message = 'Body inserted successfully!';
        details.push('Body inserted (no title provided)');
      } else if (results.titleInserted && !results.bodyInserted && postData.body) {
        message = 'Title inserted, body field not found';
        type = 'warning';
        details.push(`Title: ✓ Inserted`, `Body: ✗ ${results.fieldsCounts.body} fields found, none worked`);
      } else if (!results.titleInserted && results.bodyInserted && postData.title) {
        message = 'Body inserted, title field not found';
        type = 'warning';
        details.push(`Title: ✗ ${results.fieldsCounts.title} fields found, none worked`, `Body: ✓ Inserted`);
      } else {
        message = '❌ Could not insert content into Reddit fields';
        type = 'error';
        details.push(
          `Title fields found: ${results.fieldsCounts.title}`,
          `Body fields found: ${results.fieldsCounts.body}`,
          'Try refreshing the page or check if you\'re on the submit page'
        );
      }

      // Add error details
      if (results.errors.length > 0) {
        details.push(...results.errors);
      }

      this.showTemporaryNotification(message, type, details);

      // Log comprehensive results
      console.log('Insertion completed:', {
        message,
        type,
        results,
        postData: {
          titleLength: postData.title?.length || 0,
          bodyLength: postData.body?.length || 0
        }
      });
    }

    showTemporaryNotification(message, type = 'info', details = []) {
      // Remove existing notification
      const existing = document.getElementById('redipost-content-notification');
      if (existing) {
        existing.remove();
      }

      const notification = document.createElement('div');
      notification.id = 'redipost-content-notification';
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 20px;
        border-radius: 12px;
        font-family: 'Rethink Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        font-weight: 500;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        max-width: 350px;
        min-width: 280px;
        transform: translateX(450px);
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        line-height: 1.4;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
      `;

      // Color schemes
      const colors = {
        success: { 
          bg: 'linear-gradient(135deg, #28a745, #20c997)', 
          color: 'white',
          border: 'rgba(255, 255, 255, 0.2)'
        },
        warning: { 
          bg: 'linear-gradient(135deg, #ffc107, #fd7e14)', 
          color: '#212529',
          border: 'rgba(0, 0, 0, 0.1)'
        },
        error: { 
          bg: 'linear-gradient(135deg, #dc3545, #e91e63)', 
          color: 'white',
          border: 'rgba(255, 255, 255, 0.2)'
        },
        info: { 
          bg: 'linear-gradient(135deg, #ff4500, #ff6b35)', 
          color: 'white',
          border: 'rgba(255, 255, 255, 0.2)'
        }
      };

      const colorScheme = colors[type] || colors.info;
      notification.style.background = colorScheme.bg;
      notification.style.color = colorScheme.color;
      notification.style.borderColor = colorScheme.border;

      // Build notification content
      let content = `<div style="font-weight: 600; margin-bottom: 8px;">${message}</div>`;
      
      if (details.length > 0) {
        content += `<div style="font-size: 12px; opacity: 0.9; line-height: 1.3;">`;
        details.forEach(detail => {
          content += `<div style="margin-bottom: 4px;">• ${detail}</div>`;
        });
        content += `</div>`;
      }

      notification.innerHTML = content;
      document.body.appendChild(notification);

      // Animate in
      setTimeout(() => {
        notification.style.transform = 'translateX(0)';
      }, 100);

      // Auto-hide based on type
      const hideDelay = type === 'error' ? 8000 : type === 'warning' ? 6000 : 4000;
      
      setTimeout(() => {
        notification.style.transform = 'translateX(450px)';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 400);
      }, hideDelay);

      // Click to dismiss
      notification.addEventListener('click', () => {
        notification.style.transform = 'translateX(450px)';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 400);
      });

      // Add close button for errors and warnings
      if (type === 'error' || type === 'warning') {
        const closeBtn = document.createElement('div');
        closeBtn.style.cssText = `
          position: absolute;
          top: 8px;
          right: 8px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(0,0,0,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 12px;
          opacity: 0.7;
          transition: opacity 0.2s;
        `;
        closeBtn.innerHTML = '×';
        closeBtn.addEventListener('mouseenter', () => closeBtn.style.opacity = '1');
        closeBtn.addEventListener('mouseleave', () => closeBtn.style.opacity = '0.7');
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          notification.click();
        });
        
        notification.appendChild(closeBtn);
        notification.style.paddingRight = '45px';
      }
    }
  }

  // Initialize when DOM is ready
  let pageHandler;
  
  function initializePageHandler() {
    if (pageHandler) return;
    
    pageHandler = new RedditPageHandler();
    console.log('Reddit page handler initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePageHandler);
  } else {
    initializePageHandler();
  }

  // Export for background script access
  window.RedditPageHandler = RedditPageHandler;

  // Expose insertion function globally for background script
  window.insertPostContent = function(postData) {
    if (pageHandler) {
      return pageHandler.insertPostContent(postData);
    }
    
    console.error('Page handler not initialized');
    return Promise.resolve({
      titleInserted: false,
      bodyInserted: false,
      errors: ['Page handler not initialized'],
      fieldsCounts: { title: 0, body: 0 }
    });
  };

})();