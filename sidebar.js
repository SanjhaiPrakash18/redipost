// Redipost Sidebar JavaScript
// Enhanced UI interactions, Reddit API calls, post analysis, and OpenRouter AI integration

class RedipostAssistant {
  constructor() {
    this.selectedSubreddit = null;
    this.subredditRules = [];
    this.subredditFlairs = [];
    this.originalPost = { title: '', body: '' };
    this.optimizedPost = { title: '', body: '' };
    this.complianceIssues = [];
    this.semanticFeedback = [];
    this.openRouterApiKey = null;
    this.siteUrl = 'https://redipost.extension';
    this.siteName = 'Redipost Extension';
    this.currentStep = 'draft'; // draft, suggestions, selected, optimized
    this.suggestions = [];
    this.rulesCache = {};
    this.flairsCache = {};
    
    this.initializeElements();
    this.bindEvents();
    this.checkForSelectedText();
    
    // Load API key asynchronously
    this.loadApiKey().then(() => {
      console.log('API key loading completed');
    }).catch(error => {
      console.error('Failed to load API key:', error);
    });
  }

  async loadApiKey() {
    try {
      console.log('Loading API key from storage...');
      const result = await chrome.storage.local.get(['openrouter_api_key']);
      console.log('Storage result:', result);
      
      if (result.openrouter_api_key) {
        this.openRouterApiKey = result.openrouter_api_key;
        console.log('API key loaded successfully:', this.openRouterApiKey ? 'Key present' : 'Key empty');
        console.log('API key starts with:', this.openRouterApiKey?.substring(0, 10) + '...');
      } else {
        console.log('No API key found in storage');
      }
    } catch (error) {
      console.error('Failed to load API key:', error);
    }
  }

  checkForSelectedText() {
    // Check if there's selected text from context menu
    const selectedText = sessionStorage.getItem('redipost_selected_text');
    if (selectedText) {
      this.bodyInput.value = selectedText;
      this.updateCharCount('body');
      this.checkAnalyzeButton();
      sessionStorage.removeItem('redipost_selected_text');
      this.showNotification('Selected text loaded!', 'success');
    }
  }

  showApiKeyDialog() {
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(5px);
    `;
    
    dialog.innerHTML = `
      <div style="background: white; padding: 24px; border-radius: 12px; max-width: 380px; width: 90%; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="font-size: 32px; margin-bottom: 8px; color: var(--primary);">AI</div>
          <h3 style="margin-bottom: 8px; color: var(--gray-800); font-size: 18px;">AI Features Available</h3>
          <p style="font-size: 14px; color: var(--gray-600);">
            Enter your OpenRouter API key to unlock intelligent post optimization and subreddit suggestions.
          </p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--gray-700); font-size: 13px;">
            OpenRouter API Key
          </label>
          <input type="password" id="api-key-input" placeholder="sk-or-v1-..." 
                 style="width: 100%; padding: 12px; border: 2px solid var(--gray-300); border-radius: 8px; font-size: 14px; transition: border-color 0.2s;">
          <div style="font-size: 12px; color: var(--gray-500); margin-top: 4px;">
            Your API key is stored locally and never shared.
          </div>
        </div>
        
        <div style="display: flex; gap: 12px;">
          <button id="save-api-key" style="flex: 1; background: var(--reddit-orange); color: white; border: none; padding: 12px 16px; border-radius: 8px; cursor: pointer; font-weight: 500; font-size: 14px; transition: all 0.2s;">
            Save & Continue
          </button>
          <button id="skip-api-key" style="flex: 1; background: var(--gray-200); color: var(--gray-700); border: none; padding: 12px 16px; border-radius: 8px; cursor: pointer; font-weight: 500; font-size: 14px; transition: all 0.2s;">
            Skip for Now
          </button>
        </div>
        
        <div style="text-align: center; margin-top: 16px;">
          <p style="font-size: 12px; color: var(--gray-500);">
            Don't have an API key? 
            <a href="https://openrouter.ai/keys" target="_blank" style="color: var(--reddit-orange); text-decoration: none;">
              Get one from OpenRouter →
            </a>
          </p>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Focus on input
    setTimeout(() => {
      document.getElementById('api-key-input').focus();
    }, 100);
    
    // Handle Enter key
    document.getElementById('api-key-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('save-api-key').click();
      }
    });
    
    document.getElementById('save-api-key').addEventListener('click', async () => {
      const apiKey = document.getElementById('api-key-input').value.trim();
      if (apiKey) {
        if (!apiKey.startsWith('sk-or-')) {
          this.showNotification('Invalid API key format. OpenRouter keys start with "sk-or-"', 'error');
          return;
        }
        
        this.openRouterApiKey = apiKey;
        await chrome.storage.local.set({ openrouter_api_key: apiKey });
        dialog.remove();
        this.showNotification('API key saved successfully! AI features are now available.', 'success');
      } else {
        this.showNotification('Please enter a valid API key', 'warning');
      }
    });
    
    document.getElementById('skip-api-key').addEventListener('click', () => {
      dialog.remove();
      this.showNotification('AI features disabled. You can still use basic functionality.', 'info');
    });
  }

  initializeElements() {
    // Input elements
    this.titleInput = document.getElementById('post-title');
    this.bodyInput = document.getElementById('post-body');
    this.titleCount = document.getElementById('title-count');
    this.bodyCount = document.getElementById('body-count');
    
    // Button elements
    this.analyzeBtn = document.getElementById('analyze-btn');
    this.optimizeBtn = document.getElementById('optimize-btn');
    this.openSubredditBtn = document.getElementById('open-subreddit-btn');
    this.backBtn = document.getElementById('back-btn');
    this.copyTitleBtn = document.getElementById('copy-title-btn');
    this.copyBodyBtn = document.getElementById('copy-body-btn');
    
    // Section elements
    this.suggestionsSection = document.getElementById('suggestions-section');
    this.selectedSection = document.getElementById('selected-section');
    this.optimizedSection = document.getElementById('optimized-section');
    this.optimizeAction = document.getElementById('optimize-action');
    
    // Content elements
    this.suggestionsContainer = document.getElementById('suggestions-container');
    this.suggestionsLoading = document.getElementById('suggestions-loading');
    this.rulesLoading = document.getElementById('rules-loading');
    this.optimizationLoading = document.getElementById('optimization-loading');
    this.rulesContent = document.getElementById('rules-content');
    this.selectedSubredditName = document.getElementById('selected-subreddit-name');
    this.openSubredditName = document.getElementById('open-subreddit-name');
    this.optimizedTitle = document.getElementById('optimized-title');
    this.optimizedBody = document.getElementById('optimized-body');
    this.changesSummary = document.getElementById('changes-summary');
  }

  bindEvents() {
    // Character counting with real-time validation
    this.titleInput.addEventListener('input', () => {
      this.updateCharCount('title');
      this.checkAnalyzeButton();
      this.validateInput('title');
    });
    
    this.bodyInput.addEventListener('input', () => {
      this.updateCharCount('body');
      this.checkAnalyzeButton();
      this.validateInput('body');
    });
    
    // Button events
    this.analyzeBtn.addEventListener('click', () => this.analyzePost());
    this.optimizeBtn.addEventListener('click', () => this.optimizePost());
    this.openSubredditBtn.addEventListener('click', () => this.openSubreddit());
    this.backBtn.addEventListener('click', () => this.goBack());
    this.copyTitleBtn.addEventListener('click', () => this.copyToClipboard('title'));
    this.copyBodyBtn.addEventListener('click', () => this.copyToClipboard('body'));
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'Enter' && !this.analyzeBtn.disabled) {
          e.preventDefault();
          this.analyzePost();
        }
      }
    });

    // Auto-save draft
    let saveTimeout;
    const autoSave = () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        this.saveDraft();
      }, 2000);
    };
    
    this.titleInput.addEventListener('input', autoSave);
    this.bodyInput.addEventListener('input', autoSave);
  }

  validateInput(field) {
    const input = field === 'title' ? this.titleInput : this.bodyInput;
    const value = input.value;
    
    // Remove any existing validation indicators
    input.classList.remove('input-warning', 'input-error');
    
    if (field === 'title') {
      if (value.length > 250) {
        input.classList.add('input-warning');
      } else if (value.length > 300) {
        input.classList.add('input-error');
      }
    } else if (field === 'body') {
      if (value.length > 35000) {
        input.classList.add('input-warning');
      } else if (value.length > 40000) {
        input.classList.add('input-error');
      }
    }
  }

  async saveDraft() {
    try {
      await chrome.storage.local.set({
        redipost_draft: {
          title: this.titleInput.value,
          body: this.bodyInput.value,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  }

  async loadDraft() {
    try {
      const result = await chrome.storage.local.get(['redipost_draft']);
      if (result.redipost_draft) {
        const draft = result.redipost_draft;
        const age = Date.now() - draft.timestamp;
        
        // Only load drafts less than 24 hours old
        if (age < 24 * 60 * 60 * 1000) {
          this.titleInput.value = draft.title || '';
          this.bodyInput.value = draft.body || '';
          this.updateCharCount('title');
          this.updateCharCount('body');
          this.checkAnalyzeButton();
          
          if (draft.title || draft.body) {
            this.showNotification('Draft restored', 'info');
          }
        }
      }
    } catch (error) {
      console.error('Failed to load draft:', error);
    }
  }

  updateCharCount(field) {
    if (field === 'title') {
      const count = this.titleInput.value.length;
      this.titleCount.textContent = count;
      this.titleCount.style.color = count > 250 ? 
        (count > 300 ? 'var(--danger)' : 'var(--warning)') : 'var(--gray-500)';
    } else if (field === 'body') {
      const count = this.bodyInput.value.length;
      this.bodyCount.textContent = count;
      this.bodyCount.style.color = count > 35000 ? 
        (count > 40000 ? 'var(--danger)' : 'var(--warning)') : 'var(--gray-500)';
    }
  }

  checkAnalyzeButton() {
    const hasTitle = this.titleInput.value.trim().length > 0;
    const hasBody = this.bodyInput.value.trim().length > 0;
    const wasDisabled = this.analyzeBtn.disabled;
    
    this.analyzeBtn.disabled = !(hasTitle || hasBody);
    
    // Add visual feedback when button becomes enabled
    if (wasDisabled && !this.analyzeBtn.disabled) {
      this.analyzeBtn.style.transform = 'scale(1.05)';
      setTimeout(() => {
        this.analyzeBtn.style.transform = 'scale(1)';
      }, 150);
    }
  }

  async analyzePost() {
    const title = this.titleInput.value.trim();
    const body = this.bodyInput.value.trim();
    
    if (!title && !body) {
      this.showNotification('Please enter a title or body text', 'warning');
      return;
    }

    // Store original post
    this.originalPost = { title, body };
    this.currentStep = 'suggestions';

    // Show suggestions section with loading
    this.showSection(this.suggestionsSection);
    this.showLoading(this.suggestionsLoading, 'Finding the perfect subreddits for your post...');
    this.suggestionsContainer.innerHTML = '';

    try {
      // Clear any previous results
      this.semanticFeedback = [];
      this.complianceIssues = [];

      // Check if AI is available
      if (!this.openRouterApiKey) {
        // Show API key dialog
        this.showApiKeyDialog();
        // Continue with basic analysis
      }

      // Perform parallel analysis
      const analysisPromises = [];
      
      if (this.openRouterApiKey) {
        analysisPromises.push(
          this.performSemanticAnalysis(title, body).catch(err => {
            console.warn('Semantic analysis failed:', err);
            return [];
          })
        );
      }

      analysisPromises.push(
        this.getSubredditSuggestions(title, body).catch(err => {
          console.warn('Subreddit suggestions failed:', err);
          return this.getFallbackSuggestions();
        })
      );

      const [semanticResults, suggestions] = await Promise.all(analysisPromises);
      
      if (semanticResults && semanticResults.length > 0) {
        this.semanticFeedback = semanticResults;
        this.showSemanticFeedback(semanticResults);
      }

      this.displaySuggestions(suggestions);
      
    } catch (error) {
      console.error('Error during analysis:', error);
      this.showNotification('Analysis failed. Using fallback suggestions.', 'warning');
      this.displaySuggestions(this.getFallbackSuggestions());
    } finally {
      this.hideLoading(this.suggestionsLoading);
    }
  }

  showSemanticFeedback(feedback) {
    if (feedback.length === 0) return;
    
    const feedbackHtml = feedback.map(item => `<span class="feedback-item">${item}</span>`).join(' • ');
          this.showNotification(`Post insights: ${feedbackHtml}`, 'info', [], 6000);
  }

  showLoading(element, message = 'Loading...') {
    element.style.display = 'block';
    const messageEl = element.querySelector('p');
    if (messageEl) {
      messageEl.textContent = message;
    }
  }

  hideLoading(element) {
    element.style.display = 'none';
  }

  async makeOpenRouterRequest(messages, maxTokens = 500, model = 'openai/gpt-4o-mini') {
    if (!this.openRouterApiKey) {
      throw new Error('No API key available');
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': this.siteUrl,
        'X-Title': this.siteName
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: maxTokens,
        temperature: 0.7,
        top_p: 0.9
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your OpenRouter API key.');
      } else if (response.status === 402) {
        throw new Error('Insufficient credits. Please add credits to your OpenRouter account.');
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      } else if (response.status === 400) {
        throw new Error(errorData.error?.message || 'Bad request. Please check your input.');
      }
      
      throw new Error(`API Error ${response.status}: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from AI model');
    }
    
    return data;
  }

  async performSemanticAnalysis(title, body) {
    if (!this.openRouterApiKey) return [];
    
    const content = `Title: ${title}\nBody: ${body}`.trim();
    if (!content) return [];

    try {
      const data = await this.makeOpenRouterRequest([
        {
          role: 'system',
          content: `You are a semantic analysis assistant for Reddit posts. Analyze the tone, clarity, engagement potential, and style of the post content. 

Provide 2-3 concise insights about:
- Tone (professional, casual, emotional, etc.)
- Clarity and structure
- Potential engagement issues
- Style suggestions

Return only a JSON array of short, actionable insights (max 60 chars each).`
        },
        {
          role: 'user',
          content: content
        }
      ], 200);

      const feedbackText = data.choices[0]?.message?.content || '[]';
      
      try {
        const parsed = JSON.parse(feedbackText);
        return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
      } catch {
        // If JSON parsing fails, extract insights from text
        const insights = feedbackText.split(/[.,;]/).slice(0, 3).map(s => s.trim()).filter(s => s.length > 10);
        return insights.map(s => s.substring(0, 60));
      }
    } catch (error) {
      console.error('Semantic analysis error:', error);
      this.handleApiError(error, 'semantic analysis');
      return [];
    }
  }

  async getSubredditSuggestions(title, body) {
    const content = `Title: ${title}\nBody: ${body}`.trim();
    
    if (!this.openRouterApiKey) {
      return this.getFallbackSuggestions(content);
    }

    try {
      const data = await this.makeOpenRouterRequest([
        {
          role: 'system',
          content: `You are an expert Reddit analyst specializing in finding the PERFECT subreddits for specific content. Your analysis must be extremely precise and context-aware.

DEEP CONTENT ANALYSIS FRAMEWORK:
1. **Topic Extraction**: Identify the primary subject, secondary topics, and underlying themes
2. **Content Type Classification**: Determine if it's a question, discussion, advice request, story, review, tutorial, etc.
3. **Tone Analysis**: Assess formality level, emotional content, and writing style
4. **Audience Targeting**: Identify who would be most interested and qualified to respond
5. **Community Culture Matching**: Consider which subreddits' culture and rules would welcome this content

ADVANCED MATCHING CRITERIA:
- **Exact Topic Match**: Prefer subreddits that specifically discuss this exact subject
- **Content Format Compatibility**: Ensure the post type is welcome in suggested subreddits
- **Community Activity**: Prioritize subreddits with active discussions on similar topics
- **Rule Compatibility**: Consider which subreddits' rules would allow this content
- **Engagement Potential**: Choose communities where this content would generate meaningful discussion

SPECIALIZED CATEGORY ANALYSIS:
- **Technical Content**: Programming, software, hardware, troubleshooting
- **Creative Content**: Art, writing, music, design, crafts
- **Personal Content**: Stories, experiences, relationships, life events
- **Educational Content**: Learning, teaching, explanations, tutorials
- **Entertainment Content**: Movies, games, books, shows, hobbies
- **Professional Content**: Work, career, business, industry-specific
- **Health & Wellness**: Physical health, mental health, fitness, nutrition
- **Academic Content**: Research, studies, academic discussions

QUALITY REQUIREMENTS:
- Suggest 6-10 highly specific subreddits
- Minimum 5,000 subscribers for engagement potential
- Maximum relevance score of 8+ for primary suggestions
- Include both popular and niche communities when appropriate
- Avoid generic catch-all subreddits unless truly the best match
- Consider seasonal or trending topics if relevant

Return a JSON array with objects containing:
- display_name: subreddit name (without r/)
- public_description: concise description of the subreddit's focus
- subscribers: realistic member count
- over_18: always false
- category: specific topic category (Technical, Creative, Personal, etc.)
- relevance_score: 1-10 rating (8+ for excellent matches)
- content_type_match: how well the post format fits (Question, Discussion, Story, etc.)
- engagement_potential: estimated likelihood of good responses

Be extremely precise. If the content is very specific, suggest specific subreddits. If it's general, suggest appropriate general subreddits.`
        },
        {
          role: 'user',
          content: `Analyze this post content and suggest the most relevant subreddits:

${content}

Provide detailed analysis considering:
- Primary and secondary topics
- Content type and format
- Target audience and expertise level
- Cultural and rule compatibility
- Engagement potential in different communities

Focus on finding communities where this content would be genuinely welcome and generate meaningful discussion.`
        }
      ], 1000);

      const suggestionsText = data.choices[0]?.message?.content || '[]';
      
      let suggestions;
      try {
        console.log('Raw AI response:', suggestionsText);
        
        // Enhanced JSON cleaning
        let cleanedText = suggestionsText.trim();
        
        // Remove markdown code blocks
        if (cleanedText.startsWith('```json')) {
          cleanedText = cleanedText.replace(/```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedText.startsWith('```')) {
          cleanedText = cleanedText.replace(/```\s*/, '').replace(/\s*```$/, '');
        }
        
        // Try to extract JSON if wrapped in other text
        const jsonMatch = cleanedText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          cleanedText = jsonMatch[0];
        }
        
        suggestions = JSON.parse(cleanedText) || [];
        
        if (!Array.isArray(suggestions)) {
          throw new Error('Response is not an array');
        }
        
        console.log('Successfully parsed AI suggestions:', suggestions.length, 'items');
      } catch (error) {
        console.warn('Failed to parse AI suggestions:', error.message);
        console.warn('Raw response was:', suggestionsText);
        return this.getFallbackSuggestions(content);
      }

      // Enhanced validation and filtering
      suggestions = suggestions
        .filter(sub => 
          sub.display_name && 
          typeof sub.display_name === 'string' &&
          sub.display_name.length > 0 &&
          sub.display_name.length < 30 &&
          sub.subscribers >= 5000 && 
          !sub.over_18 &&
          sub.relevance_score >= 6 // Only include reasonably relevant suggestions
        )
        .sort((a, b) => {
          // Sort by relevance score first, then by subscriber count
          const scoreDiff = (b.relevance_score || 5) - (a.relevance_score || 5);
          if (scoreDiff !== 0) return scoreDiff;
          return (b.subscribers || 0) - (a.subscribers || 0);
        })
        .slice(0, 10);

      // Ensure we have quality suggestions
      if (suggestions.length < 4) {
        const fallback = this.getFallbackSuggestions(content);
        suggestions = [...suggestions, ...fallback].slice(0, 8);
      }

      // Add metadata for better user experience
      suggestions.forEach(sub => {
        sub.quality_indicator = sub.relevance_score >= 8 ? 'Excellent Match' : 
                               sub.relevance_score >= 6 ? 'Good Match' : 'Relevant';
      });

      return suggestions;
      
    } catch (error) {
      console.error('Subreddit suggestion error:', error);
      this.handleApiError(error, 'subreddit suggestions');
      return this.getFallbackSuggestions(content);
    }
  }

  handleApiError(error, context) {
    if (error.message.includes('Invalid API key')) {
      this.showNotification(`Invalid API key - ${context} disabled`, 'error');
      setTimeout(() => this.showApiKeyDialog(), 1000);
    } else if (error.message.includes('credits')) {
      this.showNotification(`Insufficient credits - using basic ${context}`, 'warning');
    } else if (error.message.includes('Rate limit')) {
      this.showNotification(`Rate limit reached - please wait a moment`, 'warning');
    } else {
      this.showNotification(`${context} temporarily unavailable`, 'warning');
    }
  }

  getFallbackSuggestions(content = '') {
    const contentLower = content.toLowerCase();
    
    // Enhanced keyword-based suggestions with more comprehensive categories
    const categoryMappings = [
      { 
        keywords: ['question', 'how', 'what', 'why', 'help', 'confused', 'explain', 'help me', 'advice', 'should', 'recommend', 'suggestion', 'opinion', 'need help'], 
        subreddits: [
          { name: 'NoStupidQuestions', desc: 'Ask any question without judgment', members: 3200000, relevance: 9 },
          { name: 'explainlikeimfive', desc: 'Complex topics explained simply', members: 20500000, relevance: 8 },
          { name: 'AskReddit', desc: 'Ask thought-provoking questions', members: 40000000, relevance: 7 },
          { name: 'Advice', desc: 'Get helpful life advice', members: 500000, relevance: 8 },
          { name: 'needadvice', desc: 'Personal advice and guidance', members: 75000, relevance: 9 },
          { name: 'DecidingToBeBetter', desc: 'Self-improvement discussions', members: 900000, relevance: 7 }
        ]
      },
      { 
        keywords: ['tech', 'computer', 'software', 'programming', 'code', 'app', 'chrome', 'extension', 'browser', 'website', 'development', 'coding', 'script', 'api'], 
        subreddits: [
          { name: 'technology', desc: 'Latest tech news and discussions', members: 14000000, relevance: 8 },
          { name: 'programming', desc: 'Programming discussions and help', members: 4500000, relevance: 9 },
          { name: 'techsupport', desc: 'Get help with tech problems', members: 1200000, relevance: 8 },
          { name: 'learnprogramming', desc: 'Learn to code with community help', members: 4000000, relevance: 8 },
          { name: 'webdev', desc: 'Web development discussions', members: 800000, relevance: 8 },
          { name: 'ChromeExtensions', desc: 'Chrome extension development and discussion', members: 15000, relevance: 9 }
        ]
      },
      { 
        keywords: ['game', 'gaming', 'play', 'xbox', 'playstation', 'pc', 'nintendo', 'steam', 'gamer', 'console', 'video game'], 
        subreddits: [
          { name: 'gaming', desc: 'All things gaming', members: 35000000, relevance: 9 },
          { name: 'Games', desc: 'In-depth gaming discussions', members: 2800000, relevance: 8 },
          { name: 'gamingsuggestions', desc: 'Find your next favorite game', members: 85000, relevance: 8 },
          { name: 'tipofmyjoystick', desc: 'Help identifying games', members: 200000, relevance: 7 },
          { name: 'pcgaming', desc: 'PC gaming community', members: 3000000, relevance: 8 }
        ]
      },
      { 
        keywords: ['food', 'recipe', 'cooking', 'baking', 'meal', 'kitchen', 'chef', 'restaurant', 'dining', 'cuisine'], 
        subreddits: [
          { name: 'food', desc: 'Share and discover great food', members: 26000000, relevance: 9 },
          { name: 'recipes', desc: 'Share your favorite recipes', members: 1800000, relevance: 9 },
          { name: 'Cooking', desc: 'Cooking tips and techniques', members: 2200000, relevance: 8 },
          { name: 'MealPrepSunday', desc: 'Meal preparation inspiration', members: 1500000, relevance: 7 },
          { name: 'baking', desc: 'Baking tips and recipes', members: 800000, relevance: 8 }
        ]
      },
      { 
        keywords: ['movie', 'film', 'watch', 'cinema', 'actor', 'director', 'netflix', 'streaming', 'tv show', 'television'], 
        subreddits: [
          { name: 'movies', desc: 'Movie discussions and news', members: 31000000, relevance: 9 },
          { name: 'MovieSuggestions', desc: 'Get personalized movie recommendations', members: 400000, relevance: 8 },
          { name: 'tipofmytongue', desc: 'Help remembering movies', members: 1900000, relevance: 7 },
          { name: 'television', desc: 'TV show discussions', members: 2000000, relevance: 8 },
          { name: 'netflix', desc: 'Netflix content and discussions', members: 1000000, relevance: 7 }
        ]
      },
      { 
        keywords: ['book', 'read', 'author', 'novel', 'literature', 'reading', 'library', 'fiction', 'nonfiction'], 
        subreddits: [
          { name: 'books', desc: 'Book discussions and recommendations', members: 19000000, relevance: 9 },
          { name: 'suggestmeabook', desc: 'Get personalized book recommendations', members: 1700000, relevance: 8 },
          { name: 'booksuggestions', desc: 'Find your next great read', members: 200000, relevance: 8 },
          { name: 'whatsthatbook', desc: 'Help identifying books', members: 180000, relevance: 7 },
          { name: 'bookclub', desc: 'Book club discussions', members: 300000, relevance: 7 }
        ]
      },
      { 
        keywords: ['music', 'song', 'band', 'artist', 'album', 'spotify', 'playlist', 'concert', 'lyrics'], 
        subreddits: [
          { name: 'Music', desc: 'All genres of music discussion', members: 28000000, relevance: 9 },
          { name: 'WeAreTheMusicMakers', desc: 'Community for music creators', members: 1600000, relevance: 8 },
          { name: 'tipofmytongue', desc: 'Help identifying songs', members: 1900000, relevance: 7 },
          { name: 'ifyoulikeblank', desc: 'Music recommendations', members: 400000, relevance: 8 },
          { name: 'spotify', desc: 'Spotify discussions and playlists', members: 200000, relevance: 7 }
        ]
      },
      { 
        keywords: ['relationship', 'dating', 'marriage', 'partner', 'boyfriend', 'girlfriend', 'love', 'romance', 'breakup'], 
        subreddits: [
          { name: 'relationships', desc: 'Relationship advice and discussions', members: 4000000, relevance: 9 },
          { name: 'dating_advice', desc: 'Dating tips and advice', members: 800000, relevance: 8 },
          { name: 'relationship_advice', desc: 'Get help with relationship issues', members: 3000000, relevance: 8 },
          { name: 'dating', desc: 'Dating discussions and experiences', members: 500000, relevance: 7 }
        ]
      },
      { 
        keywords: ['work', 'job', 'career', 'employment', 'office', 'business', 'salary', 'interview', 'resume'], 
        subreddits: [
          { name: 'jobs', desc: 'Job search and career advice', members: 800000, relevance: 9 },
          { name: 'careerguidance', desc: 'Career development discussions', members: 400000, relevance: 8 },
          { name: 'work', desc: 'Workplace discussions and advice', members: 200000, relevance: 8 },
          { name: 'careers', desc: 'Career advice and discussions', members: 300000, relevance: 7 }
        ]
      },
      { 
        keywords: ['health', 'medical', 'doctor', 'symptoms', 'medicine', 'fitness', 'exercise', 'diet', 'nutrition', 'mental health'], 
        subreddits: [
          { name: 'health', desc: 'Health and wellness discussions', members: 2000000, relevance: 8 },
          { name: 'fitness', desc: 'Fitness and exercise advice', members: 12000000, relevance: 8 },
          { name: 'nutrition', desc: 'Nutrition and diet discussions', members: 800000, relevance: 7 },
          { name: 'mentalhealth', desc: 'Mental health support and discussions', members: 1000000, relevance: 8 },
          { name: 'loseit', desc: 'Weight loss support and advice', members: 3000000, relevance: 7 }
        ]
      },
      { 
        keywords: ['finance', 'money', 'investment', 'budget', 'saving', 'debt', 'credit', 'banking', 'financial'], 
        subreddits: [
          { name: 'personalfinance', desc: 'Personal finance advice and discussions', members: 15000000, relevance: 9 },
          { name: 'investing', desc: 'Investment discussions and advice', members: 2000000, relevance: 8 },
          { name: 'Frugal', desc: 'Frugal living tips and advice', members: 1000000, relevance: 7 },
          { name: 'financialindependence', desc: 'Financial independence discussions', members: 500000, relevance: 7 }
        ]
      },
      { 
        keywords: ['travel', 'vacation', 'trip', 'destination', 'hotel', 'flight', 'tourism', 'backpacking'], 
        subreddits: [
          { name: 'travel', desc: 'Travel discussions and advice', members: 3000000, relevance: 9 },
          { name: 'solotravel', desc: 'Solo travel experiences and advice', members: 800000, relevance: 8 },
          { name: 'backpacking', desc: 'Backpacking and budget travel', members: 400000, relevance: 8 },
          { name: 'travelphotos', desc: 'Travel photography and stories', members: 200000, relevance: 7 }
        ]
      }
    ];

    let matchedSubreddits = [];
    let matchScores = {};
    
    // Enhanced matching with scoring
    for (const category of categoryMappings) {
      let categoryScore = 0;
      const matchedKeywords = [];
      
      for (const keyword of category.keywords) {
        if (contentLower.includes(keyword)) {
          categoryScore += 1;
          matchedKeywords.push(keyword);
        }
      }
      
      if (categoryScore > 0) {
        // Add all subreddits from this category with enhanced scoring
        category.subreddits.forEach(sub => {
          const totalScore = categoryScore * (sub.relevance || 5);
          if (!matchScores[sub.name] || matchScores[sub.name] < totalScore) {
            matchScores[sub.name] = totalScore;
          }
          
          if (!matchedSubreddits.find(s => s.name === sub.name)) {
            matchedSubreddits.push({
              ...sub,
              matchedKeywords: matchedKeywords.slice(0, 3) // Store top 3 matched keywords
            });
          }
        });
      }
    }

    // If no matches, use intelligent general subreddits
    if (matchedSubreddits.length === 0) {
      matchedSubreddits = [
        { name: 'AskReddit', desc: 'Ask thought-provoking questions', members: 40000000, relevance: 6 },
        { name: 'NoStupidQuestions', desc: 'Ask any question without judgment', members: 3200000, relevance: 7 },
        { name: 'explainlikeimfive', desc: 'Complex topics explained simply', members: 20500000, relevance: 6 },
        { name: 'LifeProTips', desc: 'Tips to improve your life', members: 21000000, relevance: 5 },
        { name: 'todayilearned', desc: 'Share interesting facts', members: 28000000, relevance: 5 },
        { name: 'casualconversation', desc: 'Friendly, relaxed discussions', members: 1300000, relevance: 6 }
      ];
    }

    // Sort by relevance score and remove duplicates
    const uniqueSubreddits = [];
    const seen = new Set();
    
    matchedSubreddits
      .sort((a, b) => (b.relevance || 5) - (a.relevance || 5))
      .forEach(sub => {
        if (!seen.has(sub.name)) {
          seen.add(sub.name);
          uniqueSubreddits.push({
            display_name: sub.name,
            public_description: sub.desc,
            subscribers: sub.members,
            over_18: false,
            category: this.getCategoryFromKeywords(sub.matchedKeywords || []),
            relevance_score: sub.relevance || 5,
            quality_indicator: sub.relevance >= 8 ? 'Excellent Match' : 
                              sub.relevance >= 6 ? 'Good Match' : 'Relevant'
          });
        }
      });

    return uniqueSubreddits.slice(0, 8);
  }

  getCategoryFromKeywords(keywords) {
    if (keywords.length === 0) return 'General';
    
    const categoryMap = {
      'tech': 'Technology',
      'programming': 'Technology', 
      'game': 'Gaming',
      'food': 'Food & Cooking',
      'movie': 'Entertainment',
      'book': 'Books & Reading',
      'music': 'Music',
      'relationship': 'Relationships',
      'work': 'Career & Work',
      'health': 'Health & Fitness',
      'finance': 'Finance',
      'travel': 'Travel'
    };
    
    for (const keyword of keywords) {
      for (const [key, category] of Object.entries(categoryMap)) {
        if (keyword.includes(key)) {
          return category;
        }
      }
    }
    
    return 'General';
  }

  displaySuggestions(suggestions) {
    this.hideLoading(this.suggestionsLoading);
    
    if (suggestions.length === 0) {
      this.suggestionsContainer.innerHTML = `
        <div class="no-suggestions">
          <div style="text-align: center; padding: 20px;">
            <div style="font-size: 48px; margin-bottom: 12px; opacity: 0.5; color: var(--gray-400);">Search</div>
            <p style="font-weight: 600; margin-bottom: 8px;">No suitable subreddits found</p>
            <p style="font-size: 12px; color: var(--gray-500);">Try different keywords or browse Reddit manually</p>
          </div>
        </div>
      `;
      return;
    }

    // Store suggestions for later use
    this.suggestions = suggestions;

    // Enhanced suggestions display with quality indicators and categories
    const suggestionsHtml = suggestions.map(subreddit => {
      const qualityBadge = subreddit.quality_indicator ? 
        `<div class="quality-badge" style="
          position: absolute; top: 8px; right: 8px; 
          padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;
          background: ${subreddit.quality_indicator.includes('Excellent') ? '#10b981' : 
                       subreddit.quality_indicator.includes('Good') ? '#f59e0b' : '#6b7280'};
          color: white;
        ">${subreddit.quality_indicator}</div>` : '';
      
      const categoryBadge = subreddit.category && subreddit.category !== 'General' ? 
        `<div class="category-badge" style="
          position: absolute; top: 8px; left: 8px; 
          padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;
          background: #3b82f6; color: white;
        ">${subreddit.category}</div>` : '';
      
      const relevanceScore = subreddit.relevance_score ? 
        `<div class="relevance-score" style="
          font-size: 11px; color: var(--gray-600); margin-top: 4px;
        ">Relevance: ${subreddit.relevance_score}/10</div>` : '';

      return `
        <div class="suggestion-pill" data-subreddit="${subreddit.display_name}" 
             style="cursor: pointer; transition: all 0.2s ease; position: relative; padding-top: 24px;">
          ${qualityBadge}
          ${categoryBadge}
          <div class="subreddit-name">r/${subreddit.display_name}</div>
          <div class="member-count">${this.formatNumber(subreddit.subscribers)} members</div>
          <div class="subreddit-desc" style="font-size: 11px; color: var(--gray-600); margin-top: 4px; line-height: 1.2;">
            ${subreddit.public_description.substring(0, 60)}${subreddit.public_description.length > 60 ? '...' : ''}
          </div>
          ${relevanceScore}
        </div>
      `;
    }).join('');

    this.suggestionsContainer.innerHTML = `
      <div class="suggestions-header" style="
        text-align: center; margin-bottom: 16px; padding: 12px; 
        background: linear-gradient(135deg, #ff6b35, #f7931e); 
        border-radius: 8px; color: white;
      ">
        <div style="font-size: 14px; font-weight: 600; margin-bottom: 4px;">
          Found ${suggestions.length} relevant subreddits
        </div>
        <div style="font-size: 11px; opacity: 0.9;">
          Based on AI analysis of your content
        </div>
      </div>
      <div class="suggestions-grid">
        ${suggestionsHtml}
      </div>
      <div style="text-align: center; margin-top: 16px; padding: 12px; background: var(--gray-100); border-radius: 8px;">
        <div style="font-size: 12px; color: var(--gray-600); margin-bottom: 4px;">Pro Tip</div>
        <div style="font-size: 11px; color: var(--gray-500);">
          Click any subreddit to see its rules and get an optimized version of your post
        </div>
      </div>
    `;

    // Add click handlers with enhanced UX
    this.suggestionsContainer.querySelectorAll('.suggestion-pill').forEach(pill => {
      pill.addEventListener('mouseenter', () => {
        pill.style.transform = 'translateY(-2px)';
        pill.style.boxShadow = '0 4px 12px rgba(255, 69, 0, 0.15)';
      });
      
      pill.addEventListener('mouseleave', () => {
        pill.style.transform = 'translateY(0)';
        pill.style.boxShadow = 'none';
      });
      
      pill.addEventListener('click', () => {
        // Visual feedback
        pill.style.transform = 'scale(0.95)';
        setTimeout(() => {
          pill.style.transform = 'scale(1)';
        }, 150);
        
        this.selectSubreddit(pill.dataset.subreddit);
      });
    });

    // Pre-fetch rules for all subreddits in the background
    this.prefetchSubredditRules(suggestions);
  }

  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  async prefetchSubredditRules(suggestions) {
    // Pre-fetch rules and flairs for all subreddits in the background
    // This will make the experience faster when users click on subreddits
    const subredditNames = suggestions.map(s => s.display_name);
    
    // Use Promise.allSettled to not block if some requests fail
    const rulePromises = subredditNames.map(async (subredditName) => {
      try {
        const rules = await this.fetchSubredditRules(subredditName);
        return { subredditName, rules, success: true };
      } catch (error) {
        console.warn(`Failed to pre-fetch rules for r/${subredditName}:`, error);
        return { subredditName, rules: [], success: false };
      }
    });

    const flairPromises = subredditNames.map(async (subredditName) => {
      try {
        const flairs = await this.fetchSubredditFlairs(subredditName);
        return { subredditName, flairs, success: true };
      } catch (error) {
        console.warn(`Failed to pre-fetch flairs for r/${subredditName}:`, error);
        return { subredditName, flairs: [], success: false };
      }
    });

    // Store the results in caches
    this.rulesCache = this.rulesCache || {};
    this.flairsCache = this.flairsCache || {};
    
    Promise.allSettled([...rulePromises, ...flairPromises]).then(results => {
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value.success) {
          if (result.value.rules) {
            this.rulesCache[result.value.subredditName] = result.value.rules;
          }
          if (result.value.flairs) {
            this.flairsCache[result.value.subredditName] = result.value.flairs;
          }
        }
      });
      console.log('Pre-fetched rules for', Object.keys(this.rulesCache).length, 'subreddits');
      console.log('Pre-fetched flairs for', Object.keys(this.flairsCache).length, 'subreddits');
    });
  }

  async fetchSubredditRules(subredditName) {
    console.log(`Fetching rules for r/${subredditName}...`);
    
    // Enhanced endpoint list with better fallback strategy
    const endpoints = [
      `https://www.reddit.com/r/${subredditName}/about/rules.json`,
      `https://www.reddit.com/r/${subredditName}/wiki/rules.json`,
      `https://www.reddit.com/r/${subredditName}/wiki/community_guidelines.json`,
      `https://www.reddit.com/r/${subredditName}/wiki/posting_guidelines.json`,
      `https://www.reddit.com/r/${subredditName}/about.json`
    ];

    let response;
    let data;
    let successfulEndpoint = null;
    
    // Enhanced headers for better compatibility
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
    
    for (let i = 0; i < endpoints.length; i++) {
      const endpoint = endpoints[i];
      try {
        console.log(`Trying endpoint ${i + 1}/${endpoints.length}:`, endpoint);
        
        // Add progressive delay between requests to avoid rate limiting
        if (i > 0) {
          const delay = Math.min(1000 * i, 3000); // Progressive delay up to 3 seconds
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        response = await fetch(endpoint, {
          method: 'GET',
          headers,
          mode: 'cors',
          credentials: 'omit',
          cache: 'no-cache'
        });

        console.log(`Response status for ${endpoint}:`, response.status);
        
        if (response.ok) {
          data = await response.json();
          successfulEndpoint = endpoint;
          console.log('Response data structure:', Object.keys(data));
          break;
        } else if (response.status === 403) {
          console.warn(`Access forbidden for ${endpoint} - trying alternative method`);
          // Try alternative method for 403 errors
          const altResponse = await this.tryAlternativeRuleFetch(subredditName);
          if (altResponse && altResponse.length > 0) {
            console.log('Successfully fetched rules via alternative method');
            return altResponse;
          }
        } else if (response.status === 404) {
          console.warn(`Endpoint not found: ${endpoint}`);
        } else {
          console.warn(`Endpoint ${endpoint} returned status ${response.status}`);
        }
      } catch (err) {
        console.warn(`Failed to fetch from ${endpoint}:`, err.message);
        continue;
      }
    }

    if (data) {
      console.log(`Successfully fetched data from: ${successfulEndpoint}`);
      
      // Enhanced data structure parsing
      let rules = null;
      
      // Try different data structures in order of preference
      if (data.rules && Array.isArray(data.rules)) {
        console.log('Found rules in data.rules');
        rules = data.rules;
      } else if (data.data && data.data.rules && Array.isArray(data.data.rules)) {
        console.log('Found rules in data.data.rules');
        rules = data.data.rules;
      } else if (data.data && data.data.children && Array.isArray(data.data.children)) {
        console.log('Found rules in data.data.children');
        rules = data.data.children;
      } else if (data.content_html || data.content_md) {
        console.log('Found rules in wiki format, attempting to parse');
        rules = this.parseWikiRules(data.content_html || data.content_md);
      } else if (data.data && data.data.description) {
        // Some subreddits have rules in the description
        console.log('Attempting to extract rules from description');
        rules = this.extractRulesFromDescription(data.data.description);
      }
      
      if (rules && rules.length > 0) {
        console.log(`Successfully extracted ${rules.length} rules`);
        return this.normalizeRules(rules);
      }
    }
    
    // Final fallback: try to scrape from the subreddit page
    console.log('Attempting final fallback: scraping from subreddit page');
    const scrapedRules = await this.scrapeRulesFromPage(subredditName);
    if (scrapedRules && scrapedRules.length > 0) {
      console.log(`Successfully scraped ${scrapedRules.length} rules from page`);
      return scrapedRules;
    }
    
    console.log('No rules found in any endpoint or fallback method');
    return [];
  }

  async tryAlternativeRuleFetch(subredditName) {
    try {
      // Try to fetch the subreddit page and extract rules from HTML
      const response = await fetch(`https://www.reddit.com/r/${subredditName}/`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        mode: 'cors',
        credentials: 'omit'
      });

      if (response.ok) {
        const html = await response.text();
        return this.extractRulesFromHTML(html, subredditName);
      }
    } catch (error) {
      console.warn('Alternative rule fetch failed:', error);
    }
    return null;
  }

  extractRulesFromHTML(html, subredditName) {
    try {
      // Create a temporary DOM parser
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Look for rules in various locations
      const ruleSelectors = [
        '[data-testid="rules"]',
        '.rules',
        '.community-rules',
        '.subreddit-rules',
        '[class*="rule"]',
        '[class*="Rule"]'
      ];

      for (const selector of ruleSelectors) {
        const ruleElements = doc.querySelectorAll(selector);
        if (ruleElements.length > 0) {
          const rules = [];
          ruleElements.forEach((element, index) => {
            const text = element.textContent?.trim();
            if (text && text.length > 10) {
              rules.push({
                short_name: `Rule ${index + 1}`,
                description: text,
                violation_reason: '',
                created_utc: Date.now() / 1000
              });
            }
          });
          if (rules.length > 0) {
            console.log(`Extracted ${rules.length} rules from HTML using selector: ${selector}`);
            return rules;
          }
        }
      }

      // If no rules found, create a fallback rule
      return [{
        short_name: 'Community Guidelines',
        description: `Please check the rules for r/${subredditName} directly on Reddit. This subreddit may have specific posting guidelines that should be followed.`,
        violation_reason: '',
        created_utc: Date.now() / 1000
      }];
    } catch (error) {
      console.warn('Failed to extract rules from HTML:', error);
      return null;
    }
  }

  parseWikiRules(content) {
    // Enhanced parsing of wiki format rules
    const rules = [];
    const lines = content.split('\n');
    let currentRule = null;
    let ruleNumber = 1;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Look for rule headers (various formats)
      if (trimmedLine.match(/^#+\s*rule\s*\d+/i) || 
          trimmedLine.match(/^#+\s*\d+\./i) ||
          trimmedLine.match(/^#+\s*[a-z]/i)) {
        
        if (currentRule) {
          rules.push(currentRule);
        }
        
        currentRule = {
          short_name: trimmedLine.replace(/^#+\s*/, '').replace(/^rule\s*\d+\s*:\s*/i, ''),
          description: '',
          violation_reason: '',
          created_utc: Date.now() / 1000
        };
        ruleNumber++;
      } else if (currentRule && trimmedLine) {
        // Add content to current rule
        if (!currentRule.description) {
          currentRule.description = trimmedLine;
        } else {
          currentRule.description += ' ' + trimmedLine;
        }
      }
    }

    // Add the last rule
    if (currentRule) {
      rules.push(currentRule);
    }

    return rules;
  }

  extractRulesFromDescription(description) {
    // Extract rules from subreddit description
    const rules = [];
    const sentences = description.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    sentences.forEach((sentence, index) => {
      const trimmed = sentence.trim();
      if (trimmed.length > 20) { // Only meaningful sentences
        rules.push({
          short_name: `Guideline ${index + 1}`,
          description: trimmed,
          kind: 'all'
        });
      }
    });
    
    return rules;
  }

  normalizeRules(rules) {
    // Normalize rule format for consistency
    return rules.map((rule, index) => ({
      short_name: rule.short_name || rule.title || `Rule ${index + 1}`,
      description: rule.description || rule.text || rule.content || '',
      kind: rule.kind || 'all',
      created_utc: rule.created_utc || Date.now() / 1000,
      violation_reason: rule.violation_reason || rule.short_name
    }));
  }

  async scrapeRulesFromPage(subredditName) {
    try {
      console.log(`Scraping rules from r/${subredditName} page...`);
      
      const response = await fetch(`https://www.reddit.com/r/${subredditName}/`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        mode: 'cors',
        credentials: 'omit'
      });

      if (!response.ok) {
        console.warn(`Failed to fetch subreddit page: ${response.status}`);
        return [];
      }

      const html = await response.text();
      return this.extractRulesFromHTML(html, subredditName);
      
    } catch (error) {
      console.error('Error scraping rules from page:', error);
      return [];
    }
  }

  async fetchSubredditFlairs(subredditName) {
    try {
      const response = await fetch(`https://www.reddit.com/r/${subredditName}/api/link_flair.json`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'max-age=0'
        },
        mode: 'cors',
        credentials: 'omit'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.choices && Array.isArray(data.choices)) {
          return data.choices.map(flair => ({
            text: flair.flair_text,
            id: flair.flair_template_id,
            color: flair.flair_css_class || 'default'
          }));
        }
      } else if (response.status === 403) {
        console.warn(`Access forbidden for flairs in r/${subredditName}`);
      }
    } catch (error) {
      console.warn(`Failed to fetch flairs for r/${subredditName}:`, error);
    }
    
    return [];
  }

  async selectSubreddit(subredditName) {
    this.selectedSubreddit = subredditName;
    this.selectedSubredditName.textContent = subredditName;
    this.openSubredditName.textContent = subredditName;
    this.currentStep = 'selected';
    // Defensive: always initialize subredditRules as array
    this.subredditRules = Array.isArray(this.subredditRules) ? this.subredditRules : [];

    // Only hide suggestions section, keep rules and optimized visible
    this.suggestionsSection.style.display = 'none';
    this.selectedSection.style.display = 'block';
    this.optimizedSection.style.display = 'none';
    this.openSubredditBtn.style.display = 'none';
    this.optimizeAction.style.display = 'none';

    this.showLoading(this.rulesLoading, `Loading r/${subredditName} rules...`);
    this.rulesContent.innerHTML = '';

    try {
      // Load subreddit rules and flairs in parallel
      const [rules, flairs] = await Promise.all([
        this.loadSubredditRules(subredditName),
        this.loadSubredditFlairs(subredditName)
      ]);

      // Show optimize button after data is loaded
      this.optimizeAction.style.display = 'block';
      this.openSubredditBtn.style.display = 'block';
      
    } catch (error) {
      console.error('Error loading subreddit data:', error);
      this.showNotification('Failed to load subreddit data. You can still optimize your post manually.', 'warning');
      this.hideLoading(this.rulesLoading);
      this.optimizeAction.style.display = 'block';
      this.openSubredditBtn.style.display = 'block';
    }
  }

  async loadSubredditRules(subredditName) {
    console.log('Loading subreddit rules for:', subredditName);
    // Defensive: always initialize subredditRules as array
    this.subredditRules = [];
    
    try {
      // Check if rules are already cached
      if (this.rulesCache && this.rulesCache[subredditName]) {
        console.log('Using cached rules for:', subredditName);
        this.subredditRules = this.rulesCache[subredditName];
        this.displayRules();
        return;
      }

      // Fetch rules using the extracted method
      this.subredditRules = await this.fetchSubredditRules(subredditName);
      
      // Cache the rules for future use
      if (!this.rulesCache) this.rulesCache = {};
      this.rulesCache[subredditName] = this.subredditRules;

      console.log('Final subreddit rules:', this.subredditRules);
      console.log('Rules length:', this.subredditRules.length);
      this.displayRules();
      
    } catch (error) {
      console.error('Failed to load rules:', error);
      this.subredditRules = [];
      this.displayFallbackRules(subredditName);
    }
  }

  async loadSubredditFlairs(subredditName) {
    console.log('Loading subreddit flairs for:', subredditName);
    // Defensive: always initialize subredditFlairs as array
    this.subredditFlairs = [];
    
    try {
      // Check if flairs are already cached
      if (this.flairsCache && this.flairsCache[subredditName]) {
        console.log('Using cached flairs for:', subredditName);
        this.subredditFlairs = this.flairsCache[subredditName];
        return;
      }

      // Fetch flairs using the extracted method
      this.subredditFlairs = await this.fetchSubredditFlairs(subredditName);
      
      // Cache the flairs for future use
      if (!this.flairsCache) this.flairsCache = {};
      this.flairsCache[subredditName] = this.subredditFlairs;

      console.log('Final subreddit flairs:', this.subredditFlairs);
      console.log('Flairs length:', this.subredditFlairs.length);
      
    } catch (error) {
      console.error('Failed to load flairs:', error);
      this.subredditFlairs = [];
    }
  }

  displayRules(addressedRules = []) {
    this.hideLoading(this.rulesLoading);

    if (this.subredditRules.length === 0) {
      this.rulesContent.innerHTML = `
        <div class="no-rules">
          <div style="text-align: center; padding: 20px;">
            <div style="font-size: 32px; margin-bottom: 8px;">📋</div>
            <p style="font-weight: 500; margin-bottom: 4px;">No specific rules found</p>
            <small style="color: var(--gray-500);">Check the subreddit directly for posting guidelines</small>
          </div>
        </div>
      `;
      return;
    }

    const rulesHtml = this.subredditRules.map((rule, index) => {
      const isAddressed = addressedRules.includes(index + 1);
      return `
        <div class="rule-item" style="animation: slideInRule 0.3s ease-out ${index * 0.1}s both; ${isAddressed ? 'border-left: 4px solid var(--success); background: linear-gradient(135deg, var(--success-light), transparent);' : ''}">
          <div class="rule-number" style="${isAddressed ? 'background: var(--success); color: white;' : ''}">${index + 1}</div>
          <div class="rule-content">
            <div class="rule-title" style="${isAddressed ? 'color: var(--success); font-weight: 600;' : ''}">
              ${rule.short_name || `Rule ${index + 1}`}
              ${isAddressed ? '<span style="margin-left: 8px; font-size: 12px; color: var(--success);">Addressed</span>' : ''}
            </div>
            <div class="rule-description">${rule.description || rule.description_html || 'No description provided'}</div>
            ${rule.violation_reason ? `<div class="rule-violation" style="font-size: 11px; color: var(--warning); margin-top: 4px;">Warning: ${rule.violation_reason}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    this.rulesContent.innerHTML = `
      ${rulesHtml}
      <style>
        @keyframes slideInRule {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      </style>
    `;
  }

  displayFallbackRules(subredditName) {
    this.hideLoading(this.rulesLoading);
    this.rulesContent.innerHTML = `
      <div class="no-rules">
        <div style="text-align: center; padding: 20px;">
          <div style="font-size: 32px; margin-bottom: 8px;">🔗</div>
          <p style="font-weight: 500; margin-bottom: 8px;">Unable to load rules for r/${subredditName}</p>
          <p style="font-size: 12px; color: var(--gray-500); margin-bottom: 12px;">
            This might be due to privacy settings or network issues
          </p>
          <a href="https://www.reddit.com/r/${subredditName}/about/rules" 
             target="_blank" 
             style="display: inline-block; padding: 8px 16px; background: var(--reddit-orange); color: white; text-decoration: none; border-radius: 6px; font-size: 12px; font-weight: 500;">
            View Rules on Reddit →
          </a>
        </div>
      </div>
    `;
  }

  async checkRuleCompliance(subredditName) {
    if (!this.openRouterApiKey || this.subredditRules.length === 0) {
      this.complianceIssues = [];
      return;
    }

    const content = `Title: ${this.originalPost.title}\nBody: ${this.originalPost.body}`.trim();
    if (!content) {
      this.complianceIssues = [];
      return;
    }

    try {
      const rulesText = this.subredditRules
        .map((rule, index) => `${index + 1}. ${rule.short_name || `Rule ${index + 1}`}: ${rule.description || 'No description'}`)
        .join('\n');

      const data = await this.makeOpenRouterRequest([
        {
          role: 'system',
          content: `You are an expert Reddit rule compliance analyst. Your job is to thoroughly analyze posts against subreddit rules and identify ALL potential violations with high accuracy.

COMPLIANCE ANALYSIS FRAMEWORK:
1. **Rule-by-Rule Analysis**: Check each rule individually against the content
2. **Context Consideration**: Evaluate content in the context of the subreddit's purpose
3. **Severity Assessment**: Determine the seriousness of each potential violation
4. **Specific Identification**: Point out exactly what content violates which rules
5. **Recommendation Generation**: Provide actionable suggestions for compliance

VIOLATION CATEGORIES:
- **HIGH**: Clear rule violations that will likely result in post removal
- **MEDIUM**: Potential violations that may be flagged or cause issues
- **LOW**: Minor concerns that could be improved for better compliance

ANALYSIS REQUIREMENTS:
- Be thorough but fair - don't flag minor issues as major violations
- Consider the intent and context of the content
- Look for both explicit and implicit rule violations
- Consider formatting, tone, and content restrictions
- Evaluate title and body separately when relevant

Return a JSON object with:
{
  "issues": [
    {
      "rule_number": 1,
      "rule_name": "Rule Name",
      "issue": "Specific description of the violation",
      "severity": "high|medium|low",
      "content_section": "title|body|both",
      "suggestion": "How to fix this issue"
    }
  ],
  "compliance_score": 85,
  "overall_assessment": "Brief summary of compliance status",
  "recommendations": ["General improvement suggestion 1", "Suggestion 2"]
}

Be precise and actionable in your analysis.`
        },
        {
          role: 'user',
          content: `SUBREDDIT: r/${subredditName}

SUBREDDIT RULES:
${rulesText}

POST TO ANALYZE:
Title: ${this.originalPost.title}
Body: ${this.originalPost.body}

TASK: Perform a comprehensive rule compliance analysis. Identify all potential violations, assess their severity, and provide specific recommendations for improvement.

Focus on:
- Content that directly violates stated rules
- Formatting or structural requirements
- Tone and community guidelines
- Any content that might be flagged by moderators

Respond with ONLY the JSON object. No additional text.`
        }
      ], 600);

      try {
        const result = JSON.parse(data.choices[0]?.message?.content || '{}');
        this.complianceIssues = result.issues || [];
        
        // Enhanced notification system
        if (this.complianceIssues.length > 0) {
          const highPriorityIssues = this.complianceIssues.filter(issue => issue.severity === 'high');
          const mediumPriorityIssues = this.complianceIssues.filter(issue => issue.severity === 'medium');
          
          if (highPriorityIssues.length > 0) {
            this.showNotification(`${highPriorityIssues.length} critical rule violation(s) detected`, 'error');
          } else if (mediumPriorityIssues.length > 0) {
            this.showNotification(`${mediumPriorityIssues.length} potential rule issue(s) found`, 'warning');
          } else {
            this.showNotification(`${this.complianceIssues.length} minor compliance suggestion(s)`, 'info');
          }
        } else {
          this.showNotification('Post appears to comply with subreddit rules', 'success');
        }
        
        // Store compliance score for optimization
        this.complianceScore = result.compliance_score || 0;
        this.complianceAssessment = result.overall_assessment || '';
        
      } catch (parseError) {
        console.error('Failed to parse compliance check result:', parseError);
        this.complianceIssues = [];
      }

    } catch (error) {
      console.error('Rule compliance check error:', error);
      this.complianceIssues = [];
      this.handleApiError(error, 'rule compliance check');
    }
  }

  async optimizePost() {
    this.currentStep = 'optimized';
    this.optimizedSection.style.display = 'block';
    this.showLoading(this.optimizationLoading, 'Optimizing your post for maximum engagement...');

    try {
      // Ensure API key is loaded
      if (!this.openRouterApiKey) {
        console.log('API key not loaded yet, attempting to load...');
        await this.loadApiKey();
        
        if (!this.openRouterApiKey) {
          console.log('Still no API key after loading attempt');
          // Show API key dialog
          this.showApiKeyDialog();
          this.hideLoading(this.optimizationLoading);
          this.optimizedSection.style.display = 'none';
          return;
        } else {
          console.log('API key loaded successfully during optimization');
        }
      }

      const optimized = await this.performPostOptimization();
      this.optimizedPost = optimized;
      
      // Extract which rules were addressed from the compliance summary
      const addressedRules = this.extractAddressedRules(optimized.ruleComplianceSummary);
      
      // Update rules display to highlight addressed rules
      this.displayRules(addressedRules);
      
      this.displayOptimizedPost(optimized);
    } catch (error) {
      console.error('Error optimizing post:', error);
      this.showNotification('Failed to optimize post. Showing original content.', 'warning');
      // Show original post as fallback
      this.optimizedPost = {
        title: this.originalPost.title,
        body: this.originalPost.body,
        changes: ['Optimization failed - showing original content'],
        suggestion: 'Try checking your internet connection and API key'
      };
      this.displayOptimizedPost(this.optimizedPost);
    } finally {
      this.hideLoading(this.optimizationLoading);
    }
  }

  extractAddressedRules(complianceSummary) {
    if (!complianceSummary) return [];
    
    // Extract rule numbers from the compliance summary
            // Format: "Rule 1: [rule name] - [how post complies]. Rule 2: [rule name] - [how post complies]..."
    const ruleMatches = complianceSummary.match(/Rule (\d+):/g);
    if (!ruleMatches) return [];
    
    return ruleMatches.map(match => {
      const ruleNumber = match.match(/\d+/)[0];
      return parseInt(ruleNumber);
    });
  }

  async performPostOptimization() {
    console.log('Starting enhanced post optimization...');
    console.log('API key available:', !!this.openRouterApiKey);
    console.log('Subreddit rules count:', this.subredditRules?.length || 0);
    
    if (!this.openRouterApiKey) {
      console.log('No API key found, falling back to basic optimization');
      return this.performBasicOptimization();
    }

    // Check if we have rules to optimize against
    if (!this.subredditRules || this.subredditRules.length === 0) {
      console.warn('No subreddit rules available for AI optimization');
      const basicResult = this.performBasicOptimization();
      basicResult.changes.unshift('AI optimization skipped - subreddit rules could not be loaded');
      return basicResult;
    }

    console.log('Proceeding with AI optimization...');
    
    try {
      // Enhanced rules formatting with better structure
      const rulesText = this.subredditRules
        .map((rule, index) => {
          const ruleName = rule.short_name || `Rule ${index + 1}`;
          const ruleDesc = rule.description || 'No description available';
          return `${index + 1}. ${ruleName}: ${ruleDesc}`;
        })
        .join('\n\n');

      const complianceContext = this.complianceIssues.length > 0 
        ? `\n\nDETECTED COMPLIANCE ISSUES:\n${this.complianceIssues.map(i => `- ${i.issue} (${i.severity} priority)`).join('\n')}`
        : '';

      const flairContext = this.subredditFlairs.length > 0 
        ? `\n\nAVAILABLE FLAIRS:\n${this.subredditFlairs.map(f => `- ${f.text}`).join('\n')}`
        : 'No flairs available';

      console.log('Making enhanced OpenRouter request...');
      const data = await this.makeOpenRouterRequest([
        {
          role: 'system',
          content: `You are an expert Reddit content optimizer specializing in rule compliance and community engagement. Your mission is to transform posts to be PERFECTLY compliant with subreddit rules while maintaining authenticity and engagement potential.

CORE OPTIMIZATION PRINCIPLES:
1. **RULE COMPLIANCE FIRST** - Every rule must be strictly followed
2. **AUTHENTIC HUMAN VOICE** - Write like a real Reddit user, not AI
3. **COMMUNITY CULTURE FIT** - Match the subreddit's tone and style
4. **ENGAGEMENT OPTIMIZATION** - Make content compelling within rule constraints
5. **CONTENT PRESERVATION** - Keep the original message and intent intact

RULE COMPLIANCE STRATEGY:
- **Prohibited Content**: Completely remove or replace any content that violates "no X" rules
- **Format Requirements**: Follow exact formatting rules (titles, flairs, tags, etc.)
- **Tone Guidelines**: Adjust language to match community expectations
- **Content Restrictions**: Respect limits on links, images, self-promotion, etc.
- **Context Requirements**: Add necessary context or disclaimers if required

WRITING STYLE GUIDELINES:
- Use casual, conversational language
- Avoid overly formal or academic tone unless appropriate
- Include natural transitions and flow
- Maintain the original poster's voice and personality
- Use appropriate Reddit formatting (bold, italics, lists, etc.)

CRITICAL CONSTRAINTS:
- NEVER remove the entire body - always preserve meaningful content
- If content must be redacted, use [REDACTED] but explain why
- Only suggest flairs from the provided list
- Flair selection should be based on post content, topic, and community context
- Consider the post's primary subject matter and tone
- Match flair to the most relevant category or topic
- If no suitable flair exists, return null
- Prioritize flairs that clearly indicate the post's purpose or category
- Ensure title meets character limits (max 300 chars)
- Maintain readability and clarity

Return ONLY a valid JSON object with this structure:
{
  "title": "optimized title (max 300 chars)",
  "body": "optimized body text",
  "changes": ["specific change 1", "specific change 2"],
  "engagement_tips": ["tip 1", "tip 2", "tip 3"],
  "flair_suggestion": "suggested flair or null",
  "rule_compliance_summary": "detailed compliance explanation",
  "confidence_score": 1-10 rating of optimization quality
}

The response must be parseable JSON with no markdown formatting or additional text.`
        },
        {
          role: 'user',
          content: `SUBREDDIT: r/${this.selectedSubreddit}

SUBREDDIT RULES (MUST FOLLOW ALL):
${rulesText}${complianceContext}${flairContext}

ORIGINAL POST:
Title: ${this.originalPost.title}
Body: ${this.originalPost.body}

TASK: Optimize this post for maximum rule compliance and engagement while maintaining the original message and authentic human voice.

ANALYSIS REQUIRED:
- Identify any rule violations in the original content
- Determine necessary changes for compliance
- Optimize for better engagement within rule constraints
- Ensure natural, human-like writing style
- Suggest appropriate flair based on content analysis and available options

Respond with ONLY the JSON object. No additional text or formatting.`
        }
      ], 1200);

      let result;
      try {
        const rawContent = data.choices[0]?.message?.content || '{}';
        console.log('Raw AI response:', rawContent);
        
        // Enhanced JSON extraction
        let jsonContent = rawContent;
        
        // Try multiple extraction methods
        const jsonBlockMatch = rawContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonBlockMatch) {
          jsonContent = jsonBlockMatch[1];
          console.log('Extracted JSON from markdown block');
        } else {
          const jsonObjectMatch = rawContent.match(/\{[\s\S]*\}/);
          if (jsonObjectMatch) {
            jsonContent = jsonObjectMatch[0];
            console.log('Extracted JSON object from text');
          }
        }
        
        result = JSON.parse(jsonContent);
        console.log('Successfully parsed AI result');
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError);
        console.log('Raw AI response:', data.choices[0]?.message?.content);
        return this.performBasicOptimization();
      }

      // Validate and process the result
      let optimizedTitle = result.title || this.originalPost.title;
      let optimizedBody = result.body || this.originalPost.body;
      const changes = Array.isArray(result.changes) ? result.changes : [];
      const engagementTips = Array.isArray(result.engagement_tips) ? result.engagement_tips : [];
      const flairSuggestion = result.flair_suggestion || null;
      const ruleComplianceSummary = result.rule_compliance_summary || '';
      const confidenceScore = result.confidence_score || 5;

      // Safety checks
      if (!optimizedBody || !optimizedBody.trim()) {
        optimizedBody = this.originalPost.body;
        changes.unshift('AI optimization attempted to remove the body - original restored');
      }

      if (optimizedTitle.length > 300) {
        optimizedTitle = optimizedTitle.substring(0, 297) + '...';
        changes.push('Title truncated to meet Reddit character limit');
      }

      // Apply additional rule-based optimizations
      const additionalChanges = this.applyBasicOptimizations(optimizedTitle, optimizedBody);
      
      const finalResult = {
        title: additionalChanges.title,
        body: additionalChanges.body,
        changes: [...changes, ...additionalChanges.changes],
        engagementTips,
        flairSuggestion,
        ruleComplianceSummary,
        confidenceScore,
        aiOptimized: true
      };
      
      console.log('Final optimization result:', finalResult);
      return finalResult;

    } catch (error) {
      console.error('Post optimization error:', error);
      this.handleApiError(error, 'post optimization');
      return this.performBasicOptimization();
    }
  }

  performBasicOptimization() {
    const result = this.applyBasicOptimizations(this.originalPost.title, this.originalPost.body);
    
    return {
      title: result.title,
      body: result.body,
      changes: result.changes.length > 0 ? result.changes : ['No changes needed - your post looks good!'],
      engagementTips: [
        'Engage with commenters to boost visibility',
        'Post during peak hours for your target audience',
        'Use clear, specific language in your title'
      ],
      flairSuggestion: null,
      aiOptimized: false
    };
  }

  applyBasicOptimizations(title, body) {
    const changes = [];
    let optimizedTitle = title;
    let optimizedBody = body;

    // Title optimizations
    if (optimizedTitle) {
      // Fix ALL CAPS
      if (optimizedTitle === optimizedTitle.toUpperCase() && optimizedTitle.length > 10) {
        optimizedTitle = this.toTitleCase(optimizedTitle);
        changes.push('Fixed ALL CAPS title formatting');
      }

      // Remove excessive punctuation
      if (/[!]{3,}/.test(optimizedTitle)) {
        optimizedTitle = optimizedTitle.replace(/[!]{3,}/g, '!');
        changes.push('Reduced excessive exclamation marks');
      }

      // Add question mark to questions
      if (/\b(how|what|why|when|where|which|who)\b/i.test(optimizedTitle) && !optimizedTitle.includes('?')) {
        optimizedTitle = optimizedTitle.trim() + '?';
        changes.push('Added question mark to question');
      }

      // Trim and clean
      const originalTitleLength = optimizedTitle.length;
      optimizedTitle = optimizedTitle.trim().replace(/\s+/g, ' ');
      if (optimizedTitle.length !== originalTitleLength) {
        changes.push('Cleaned up title spacing');
      }
    }

    // Body optimizations
    if (optimizedBody) {
      // Fix paragraph spacing  
      const paragraphs = optimizedBody.split('\n').filter(p => p.trim());
      if (paragraphs.length > 1) {
        optimizedBody = paragraphs.join('\n\n');
        changes.push('Improved paragraph spacing');
      }

      // Remove excessive line breaks
      if (/\n{4,}/.test(optimizedBody)) {
        optimizedBody = optimizedBody.replace(/\n{3,}/g, '\n\n');
        changes.push('Reduced excessive line breaks');
      }
    }

    // Rule-specific optimizations
    this.subredditRules.forEach((rule) => {
      const ruleText = (rule.short_name + ' ' + (rule.description || '')).toLowerCase();
      
      // Common rule patterns
      if (ruleText.includes('flair') && !optimizedTitle.includes('[') && !optimizedTitle.includes('(')) {
        // Don't auto-add flair without knowing which one
        changes.push('Consider adding appropriate flair after posting');
      }
      
      if (ruleText.includes('no personal') && (/\bmy\b|\bi\b/gi.test(optimizedTitle))) {
        changes.push('Consider making title less personal if rules require it');
      }
    });

    return { title: optimizedTitle, body: optimizedBody, changes };
  }

  toTitleCase(str) {
    return str.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  }

  displayOptimizedPost(optimized) {
    this.optimizedTitle.textContent = optimized.title;
    this.optimizedBody.textContent = optimized.body || 'No body content';
    
    let summaryHtml = `
      <div class="optimization-summary">
    `;
    
    // Add rule compliance summary FIRST and make it most prominent
    if (optimized.ruleComplianceSummary) {
      summaryHtml += `
        <div class="rule-compliance" style="margin-bottom: 20px; padding: 16px; background: linear-gradient(135deg, var(--success-light), #e8f5e8); border-radius: 12px; border: 2px solid var(--success); box-shadow: var(--shadow-md);">
          <h4 style="color: var(--success); margin-bottom: 12px; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px; color: var(--success);">✓</span>
            Rule Compliance Verified
          </h4>
          <div style="font-size: 13px; color: var(--gray-700); line-height: 1.5; margin: 0;">
            ${optimized.ruleComplianceSummary}
          </div>
        </div>
      `;
    } else if (optimized.aiOptimized) {
      // Show a warning if AI optimization was used but no compliance summary was generated
      summaryHtml += `
        <div class="rule-compliance" style="margin-bottom: 20px; padding: 16px; background: linear-gradient(135deg, var(--warning-light), #fff8e1); border-radius: 12px; border: 2px solid var(--warning); box-shadow: var(--shadow-md);">
          <h4 style="color: var(--warning); margin-bottom: 12px; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px; color: var(--warning);">!</span>
            Rule Compliance Status
          </h4>
          <div style="font-size: 13px; color: var(--gray-700); line-height: 1.5; margin: 0;">
            Post has been optimized for better engagement and formatting. Please review the subreddit rules above to ensure your post complies with all community guidelines.
          </div>
        </div>
      `;
    } else {
      // Show info for basic optimization
      summaryHtml += `
        <div class="rule-compliance" style="margin-bottom: 20px; padding: 16px; background: linear-gradient(135deg, var(--info-light), #e1f5fe); border-radius: 12px; border: 2px solid var(--info); box-shadow: var(--shadow-md);">
          <h4 style="color: var(--info); margin-bottom: 12px; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px; color: var(--info);">i</span>
            Basic Optimization Applied
          </h4>
          <div style="font-size: 13px; color: var(--gray-700); line-height: 1.5; margin: 0;">
            Basic formatting and engagement improvements have been applied. For AI-powered rule compliance optimization, please set up your OpenRouter API key.
          </div>
        </div>
      `;
    }
    
    // Then show the changes section
    summaryHtml += `
        <div class="changes-section">
          <h4 style="color: var(--gray-800); margin-bottom: 8px; font-size: 14px;">
            ${optimized.aiOptimized ? 'AI Optimizations' : 'Basic Optimizations'}
          </h4>
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${optimized.changes.map(change => `
              <li style="margin-bottom: 6px; padding-left: 16px; position: relative; font-size: 12px; color: var(--gray-600);">
                <span style="position: absolute; left: 0; color: var(--success);">✓</span>
                ${change}
              </li>
            `).join('')}
          </ul>
        </div>
    `;
    
    if (optimized.engagementTips && optimized.engagementTips.length > 0) {
      summaryHtml += `
        <div class="engagement-tips" style="margin-top: 16px;">
          <h4 style="color: var(--gray-800); margin-bottom: 8px; font-size: 14px;">Engagement Tips</h4>
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${optimized.engagementTips.map(tip => `
              <li style="margin-bottom: 6px; padding-left: 16px; position: relative; font-size: 12px; color: var(--gray-600);">
                <span style="position: absolute; left: 0; color: var(--info);">•</span>
                ${tip}
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }
    
    if (optimized.flairSuggestion) {
      summaryHtml += `
        <div class="flair-suggestion" style="margin-top: 16px; padding: 12px; background: var(--info-light); border-radius: 8px; border-left: 4px solid var(--info);">
          <h4 style="color: var(--info); margin-bottom: 8px; font-size: 14px; font-weight: 600;">Suggested Flair</h4>
          <p style="font-size: 12px; color: var(--gray-700); margin: 0 0 8px 0;">
            Recommended flair for this post: <strong>${optimized.flairSuggestion}</strong>
          </p>
          <div style="font-size: 11px; color: var(--gray-600);">
            This flair was selected based on your content and the subreddit's available options.
          </div>
        </div>
      `;
    }
    
    summaryHtml += '</div>';
    
    this.changesSummary.innerHTML = summaryHtml;
    this.hideLoading(this.optimizationLoading);
  }

  showComparisonModal() {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(5px);
    `;
    
    modal.innerHTML = `
      <div style="background: white; padding: 24px; border-radius: 12px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin: 0; color: var(--gray-800);">Before & After Comparison</h3>
          <button id="close-modal" style="background: none; border: none; font-size: 20px; cursor: pointer; color: var(--gray-500);">×</button>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div>
            <h4 style="color: var(--gray-700); margin-bottom: 12px; font-size: 14px;">Original Post</h4>
            <div style="background: var(--gray-100); padding: 12px; border-radius: 8px; margin-bottom: 12px;">
              <div style="font-weight: 500; color: var(--gray-800); margin-bottom: 8px; font-size: 13px;">Title:</div>
              <div style="font-size: 12px; color: var(--gray-600); line-height: 1.4;">${this.originalPost.title}</div>
            </div>
            <div style="background: var(--gray-100); padding: 12px; border-radius: 8px;">
              <div style="font-weight: 500; color: var(--gray-800); margin-bottom: 8px; font-size: 13px;">Body:</div>
              <div style="font-size: 12px; color: var(--gray-600); line-height: 1.4; max-height: 150px; overflow-y: auto;">
                ${this.originalPost.body || 'No body content'}
              </div>
            </div>
          </div>
          
          <div>
            <h4 style="color: var(--success); margin-bottom: 12px; font-size: 14px;">Optimized Post</h4>
            <div style="background: rgba(40, 167, 69, 0.1); padding: 12px; border-radius: 8px; margin-bottom: 12px; border: 1px solid rgba(40, 167, 69, 0.2);">
              <div style="font-weight: 500; color: var(--gray-800); margin-bottom: 8px; font-size: 13px;">Title:</div>
              <div style="font-size: 12px; color: var(--gray-600); line-height: 1.4;">${this.optimizedPost.title}</div>
            </div>
            <div style="background: rgba(40, 167, 69, 0.1); padding: 12px; border-radius: 8px; border: 1px solid rgba(40, 167, 69, 0.2);">
              <div style="font-weight: 500; color: var(--gray-800); margin-bottom: 8px; font-size: 13px;">Body:</div>
              <div style="font-size: 12px; color: var(--gray-600); line-height: 1.4; max-height: 150px; overflow-y: auto;">
                ${this.optimizedPost.body || 'No body content'}
              </div>
            </div>
          </div>
        </div>
        
        <div style="margin-top: 20px; text-align: center;">
          <button id="use-original" style="background: var(--gray-200); color: var(--gray-700); border: none; padding: 10px 20px; border-radius: 6px; margin-right: 12px; cursor: pointer;">
            Use Original
          </button>
          <button id="use-optimized" style="background: var(--success); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
            Use Optimized
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('close-modal').addEventListener('click', () => modal.remove());
    document.getElementById('use-original').addEventListener('click', () => {
      this.optimizedPost = { ...this.originalPost, changes: ['Using original post'] };
      this.displayOptimizedPost(this.optimizedPost);
      modal.remove();
      this.showNotification('Using original post', 'info');
    });
    document.getElementById('use-optimized').addEventListener('click', () => {
      modal.remove();
      this.showNotification('Using optimized post', 'success');
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  showSection(section) {
    // Hide all sections
    const sections = [this.suggestionsSection, this.selectedSection];
    sections.forEach(s => {
      s.style.display = 'none';
      s.classList.remove('section-reveal');
    });
    
    // Show the requested section with animation
    section.style.display = 'block';
    section.classList.add('section-reveal');
    
    // Scroll to top of section
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Remove animation class after animation completes
    setTimeout(() => {
      section.classList.remove('section-reveal');
    }, 300);
  }



  async checkCurrentPage() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'CHECK_REDDIT_PAGE' }, (response) => {
        resolve(response || { isRedditPage: false, isSubmitPage: false });
      });
    });
  }

  sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Message error:', chrome.runtime.lastError);
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response);
        }
      });
    });
  }

  async saveToHistory(success = true, reason = '') {
    try {
      const historyItem = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        subreddit: this.selectedSubreddit,
        originalTitle: this.originalPost.title,
        originalBody: this.originalPost.body,
        optimizedTitle: this.optimizedPost.title,
        optimizedBody: this.optimizedPost.body,
        changes: this.optimizedPost.changes,
        success,
        reason
      };

      const result = await chrome.storage.local.get(['redipost_history']);
      const history = result.redipost_history || [];
      
      // Keep only last 50 items
      history.unshift(historyItem);
      const trimmedHistory = history.slice(0, 50);
      
      await chrome.storage.local.set({ redipost_history: trimmedHistory });
    } catch (error) {
      console.error('Failed to save to history:', error);
    }
  }

  async copyToClipboard(type) {
    try {
      let text = '';
      if (type === 'title') {
        text = this.optimizedPost.title;
      } else if (type === 'body') {
        text = this.optimizedPost.body;
      }
      
      if (!text) {
        this.showNotification('No content to copy', 'warning');
        return;
      }
      
      await navigator.clipboard.writeText(text);
      this.showNotification(`${type === 'title' ? 'Title' : 'Body'} copied to clipboard!`, 'success');
      
      // Visual feedback on button
      const btn = type === 'title' ? this.copyTitleBtn : this.copyBodyBtn;
      const originalText = btn.innerHTML;
              btn.innerHTML = '<span class="copy-icon">Copied</span>';
      btn.style.background = 'var(--success)';
      btn.style.borderColor = 'var(--success)';
      btn.style.color = 'white';
      
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = '';
        btn.style.borderColor = '';
        btn.style.color = '';
      }, 2000);
      
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      this.showNotification('Failed to copy to clipboard', 'error');
    }
  }

  async openSubreddit() {
    if (!this.selectedSubreddit) {
      this.showNotification('No subreddit selected', 'error');
      return;
    }
    
    try {
      const url = `https://www.reddit.com/r/${this.selectedSubreddit}/submit`;
      await chrome.tabs.create({ url });
      this.showNotification(`Opened r/${this.selectedSubreddit} in new tab`, 'success');
    } catch (error) {
      console.error('Failed to open subreddit:', error);
      this.showNotification('Failed to open subreddit', 'error');
    }
  }

  goBack() {
    this.selectedSubreddit = null;
    this.subredditRules = [];
    this.subredditFlairs = [];
    this.complianceIssues = [];
    this.optimizedPost = { title: '', body: '' };
    this.currentStep = 'suggestions';
    this.showSection(this.suggestionsSection);
    
    // Reset optimized section visibility
    this.optimizedSection.style.display = 'none';
    this.optimizeAction.style.display = 'none';
  }

  showNotification(message, type = 'info', details = [], duration = 4000) {
    // Remove any existing notifications
    const existing = document.getElementById('redipost-sidebar-notification');
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement('div');
    notification.id = 'redipost-sidebar-notification';
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

    // Color schemes with gradients
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
    let content = `<div style="font-weight: 600; margin-bottom: ${details.length > 0 ? '8px' : '0'};">${message}</div>`;
    
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

    // Auto-hide
    const hideDelay = type === 'error' ? Math.max(duration, 6000) : 
                     type === 'warning' ? Math.max(duration, 5000) : duration;
    
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

    // Add close button for errors and detailed notifications
    if (type === 'error' || details.length > 0) {
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

// Initialize the assistant when the sidebar loads
document.addEventListener('DOMContentLoaded', () => {
  const assistant = new RedipostAssistant();
  
  // Load draft after initialization
  setTimeout(() => assistant.loadDraft(), 500);
  
  // Add keyboard shortcuts info
  console.log('Redipost keyboard shortcuts: Ctrl/Cmd + Enter to analyze post');
});